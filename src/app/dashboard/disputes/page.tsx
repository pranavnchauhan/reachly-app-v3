"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Send } from "lucide-react";

interface Dispute {
  id: string;
  lead_id: string;
  reason: string;
  evidence: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  leads: { company_name: string; contact_name: string };
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [revealedLeads, setRevealedLeads] = useState<{ id: string; company_name: string }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: disputeData }, { data: niches }] = await Promise.all([
        supabase.from("disputes").select("*, leads(company_name, contact_name)").eq("client_id", user.id).order("created_at", { ascending: false }),
        supabase.from("client_niches").select("id").eq("client_id", user.id),
      ]);

      setDisputes(disputeData ?? []);

      if (niches?.length) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, company_name")
          .in("client_niche_id", niches.map((n) => n.id))
          .eq("status", "revealed");
        setRevealedLeads(leads ?? []);
      }

      // Check URL for pre-selected lead
      const params = new URLSearchParams(window.location.search);
      const leadParam = params.get("lead");
      if (leadParam) {
        setLeadId(leadParam);
        setShowForm(true);
      }
    }
    load();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("disputes").insert({
      client_id: user.id,
      lead_id: leadId,
      reason,
      evidence: evidence || null,
      status: "pending",
    });

    if (!error) {
      setShowForm(false);
      setReason("");
      setEvidence("");
      setLeadId("");
      // Reload disputes
      const { data } = await supabase.from("disputes").select("*, leads(company_name, contact_name)").eq("client_id", user.id).order("created_at", { ascending: false });
      setDisputes(data ?? []);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Disputes</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <AlertTriangle className="w-4 h-4" />
          New Dispute
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4 mb-6">
          <h2 className="font-semibold">Submit a Dispute</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Lead</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select a lead...</option>
              {revealedLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Why is this lead uncontactable or invalid?" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Evidence (optional)</label>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Bounce-back screenshot URL, invalid phone, etc." />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
              <Send className="w-4 h-4" /> {loading ? "Submitting..." : "Submit Dispute"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-background transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!disputes.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted">No disputes filed. You can dispute a lead if the contact is unreachable.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{dispute.leads?.company_name ?? "Unknown"}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  dispute.status === "pending" ? "bg-warning/10 text-warning" :
                  dispute.status === "approved" ? "bg-success/10 text-success" :
                  "bg-danger/10 text-danger"
                }`}>{dispute.status}</span>
              </div>
              <p className="text-sm text-muted">{dispute.reason}</p>
              {dispute.admin_notes && (
                <p className="text-sm mt-2 bg-background rounded-lg p-3">
                  <span className="font-medium">Admin:</span> {dispute.admin_notes}
                </p>
              )}
              <p className="text-xs text-muted mt-2">Filed {new Date(dispute.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

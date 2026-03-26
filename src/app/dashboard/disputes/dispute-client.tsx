"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle, Send, Mail, Phone, Linkedin, Upload, X, Check,
  Clock, CheckCircle, XCircle, Shield, FileText,
} from "lucide-react";

interface ChannelEvidence {
  channel: string;
  issue: string;
  detail: string;
  screenshot_url: string | null;
}

interface Dispute {
  id: string;
  lead_id: string;
  reason: string;
  evidence: string | null;
  status: string;
  admin_notes: string | null;
  channels_provided: string[] | null;
  channel_evidence: ChannelEvidence[] | null;
  created_at: string;
  resolved_at: string | null;
  leads: { company_name: string; contact_name: string };
}

interface RevealedLead {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
}

const ISSUE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  email: [
    { value: "bounced", label: "Email bounced back" },
    { value: "wrong_person", label: "Wrong person responded" },
    { value: "doesnt_exist", label: "Email address doesn't exist" },
    { value: "no_response", label: "No response after 3+ attempts" },
  ],
  phone: [
    { value: "wrong_number", label: "Wrong number / not in service" },
    { value: "wrong_person", label: "Wrong person answered" },
    { value: "no_answer", label: "No answer after 3+ attempts" },
    { value: "disconnected", label: "Number disconnected" },
  ],
  linkedin: [
    { value: "doesnt_exist", label: "Profile doesn't exist / 404" },
    { value: "wrong_person", label: "Wrong person's profile" },
    { value: "no_response", label: "No response after 3+ attempts" },
    { value: "profile_inactive", label: "Profile is inactive / closed" },
  ],
};

const CHANNEL_ICONS: Record<string, React.ElementType> = { email: Mail, phone: Phone, linkedin: Linkedin };
const CHANNEL_LABELS: Record<string, string> = { email: "Email", phone: "Phone", linkedin: "LinkedIn" };

export function DisputeClient({
  initialDisputes,
  revealedLeads,
  clientId,
}: {
  initialDisputes: Dispute[];
  revealedLeads: RevealedLead[];
  clientId: string;
}) {
  const [disputes, setDisputes] = useState(initialDisputes);
  const [showForm, setShowForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedLead, setSelectedLead] = useState<RevealedLead | null>(null);
  const [evidence, setEvidence] = useState<Record<string, { issue: string; detail: string; screenshot_url: string | null }>>({});
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const supabase = createClient();

  // Check URL for pre-selected lead
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadParam = params.get("lead");
    if (leadParam) {
      setSelectedLeadId(leadParam);
      setShowForm(true);
    }
  }, []);

  // When lead selection changes, determine channels and reset evidence
  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLead(null);
      setEvidence({});
      return;
    }
    const lead = revealedLeads.find((l) => l.id === selectedLeadId);
    setSelectedLead(lead || null);
    if (lead) {
      const channels: Record<string, { issue: string; detail: string; screenshot_url: string | null }> = {};
      if (lead.contact_email) channels.email = { issue: "", detail: "", screenshot_url: null };
      if (lead.contact_phone) channels.phone = { issue: "", detail: "", screenshot_url: null };
      if (lead.contact_linkedin) channels.linkedin = { issue: "", detail: "", screenshot_url: null };
      setEvidence(channels);
    }
  }, [selectedLeadId, revealedLeads]);

  async function handleScreenshotUpload(channel: string, file: File) {
    setUploading(channel);
    const ext = file.name.split(".").pop();
    const path = `${clientId}/${selectedLeadId}/${channel}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("dispute-evidence")
      .upload(path, file, { upsert: true });

    if (!error) {
      const { data: urlData } = supabase.storage.from("dispute-evidence").getPublicUrl(path);
      setEvidence((prev) => ({
        ...prev,
        [channel]: { ...prev[channel], screenshot_url: urlData.publicUrl },
      }));
    }
    setUploading(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const channelEvidence: ChannelEvidence[] = Object.entries(evidence).map(([channel, ev]) => ({
      channel,
      issue: ev.issue,
      detail: ev.detail,
      screenshot_url: ev.screenshot_url,
    }));

    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: selectedLeadId,
        clientId,
        channelEvidence,
        summary: summary || null,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setSelectedLeadId("");
      setSummary("");
      setEvidence({});
      // Reload page to get fresh data from server
      window.location.reload();
    } else {
      const { error } = await res.json();
      alert(error || "Failed to submit dispute");
    }
    setLoading(false);
  }

  const channels = Object.keys(evidence);
  const allChannelsFilled = channels.length > 0 && channels.every((ch) => evidence[ch].issue && evidence[ch].detail);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Disputes</h1>
          <p className="text-sm text-muted mt-0.5">Challenge a lead when all contact channels fail</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors">
            <AlertTriangle className="w-4 h-4" /> New Dispute
          </button>
        )}
      </div>

      {/* Guarantee notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Our 0% Bounce Guarantee</p>
          <p className="text-sm text-muted mt-0.5">
            We guarantee that at least one of the provided contact channels (email, phone, LinkedIn) will reach the right person.
            If <strong>all provided channels</strong> fail, submit a dispute with evidence for each and we&apos;ll refund your credit.
          </p>
        </div>
      </div>

      {/* Dispute Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Submit a Dispute</h2>
            <button type="button" onClick={() => { setShowForm(false); setSelectedLeadId(""); }}
              className="w-8 h-8 rounded-lg hover:bg-background flex items-center justify-center">
              <X className="w-4 h-4 text-muted" />
            </button>
          </div>

          {/* Lead selection */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Select Lead</label>
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm">
              <option value="">Choose a revealed lead...</option>
              {revealedLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.company_name} — {lead.contact_name}</option>
              ))}
            </select>
          </div>

          {/* Per-channel evidence */}
          {selectedLead && channels.length > 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Evidence required for all {channels.length} channels</p>
                <p className="text-xs text-muted">You must provide evidence that every provided contact method has failed.</p>
              </div>

              {channels.map((channel) => {
                const Icon = CHANNEL_ICONS[channel] || Mail;
                const ev = evidence[channel];
                const contactValue = channel === "email" ? selectedLead.contact_email
                  : channel === "phone" ? selectedLead.contact_phone
                  : selectedLead.contact_linkedin;

                return (
                  <div key={channel} className="bg-background/50 border border-border/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{CHANNEL_LABELS[channel]}</p>
                        <p className="text-xs text-muted">{contactValue}</p>
                      </div>
                      {ev.issue && ev.detail ? (
                        <Check className="w-4 h-4 text-success ml-auto" />
                      ) : (
                        <span className="text-xs text-warning ml-auto">Required</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">What happened?</label>
                        <select
                          value={ev.issue}
                          onChange={(e) => setEvidence((prev) => ({ ...prev, [channel]: { ...prev[channel], issue: e.target.value } }))}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select issue...</option>
                          {(ISSUE_OPTIONS[channel] || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Describe what happened</label>
                        <textarea
                          value={ev.detail}
                          onChange={(e) => setEvidence((prev) => ({ ...prev, [channel]: { ...prev[channel], detail: e.target.value } }))}
                          required
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={
                            channel === "email" ? "Paste the bounce-back message or describe the failure..."
                            : channel === "phone" ? "Describe what happened when you called..."
                            : "Describe what you see when visiting the profile..."
                          }
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Screenshot (recommended)</label>
                        {ev.screenshot_url ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-success" />
                            <span className="text-success">Uploaded</span>
                            <button
                              type="button"
                              onClick={() => setEvidence((prev) => ({ ...prev, [channel]: { ...prev[channel], screenshot_url: null } }))}
                              className="text-xs text-muted hover:text-danger"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-background/50 transition-colors">
                            <Upload className="w-4 h-4 text-muted" />
                            <span className="text-sm text-muted">
                              {uploading === channel ? "Uploading..." : "Drop or click to upload"}
                            </span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleScreenshotUpload(channel, file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {selectedLead && channels.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Additional notes (optional)</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Any additional context..."
              />
            </div>
          )}

          {/* Submit */}
          {selectedLead && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !allChannelsFilled}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {loading ? "Submitting..." : "Submit Dispute"}
              </button>
              {!allChannelsFilled && channels.length > 0 && (
                <p className="text-xs text-warning">Complete evidence for all {channels.length} channels to submit</p>
              )}
            </div>
          )}
        </form>
      )}

      {/* Dispute List */}
      {!disputes.length ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="font-semibold mb-1">No disputes filed</p>
          <p className="text-sm text-muted">If all contact channels for a lead fail, you can submit a dispute for a credit refund.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <div key={dispute.id} className={`bg-card border rounded-2xl p-5 ${
              dispute.status === "pending" ? "border-warning/30" : dispute.status === "approved" ? "border-success/30" : "border-border"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{dispute.leads?.company_name ?? "Unknown"}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                  dispute.status === "pending" ? "bg-warning/10 text-warning" :
                  dispute.status === "approved" ? "bg-success/10 text-success" :
                  "bg-danger/10 text-danger"
                }`}>
                  {dispute.status === "pending" ? <Clock className="w-3 h-3" /> :
                   dispute.status === "approved" ? <CheckCircle className="w-3 h-3" /> :
                   <XCircle className="w-3 h-3" />}
                  {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                </span>
              </div>

              {dispute.channel_evidence && dispute.channel_evidence.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {dispute.channel_evidence.map((ev, i) => {
                    const Icon = CHANNEL_ICONS[ev.channel] || Mail;
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Icon className="w-3.5 h-3.5 mt-0.5 text-muted flex-shrink-0" />
                        <div>
                          <span className="font-medium">{CHANNEL_LABELS[ev.channel] || ev.channel}:</span>{" "}
                          <span className="text-muted">{ev.issue.replace(/_/g, " ")} — {ev.detail}</span>
                          {ev.screenshot_url && (
                            <a href={ev.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs ml-1 hover:underline">
                              View screenshot
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted mt-1">{dispute.reason}</p>
              )}

              {dispute.admin_notes && (
                <div className="mt-3 bg-background rounded-xl p-3">
                  <p className="text-sm"><span className="font-medium">Admin response:</span> {dispute.admin_notes}</p>
                </div>
              )}

              {dispute.status === "approved" && (
                <p className="text-xs text-success mt-2 font-medium">1 credit has been refunded to your account</p>
              )}

              <p className="text-xs text-muted mt-2">Filed {new Date(dispute.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

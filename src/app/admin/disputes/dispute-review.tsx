"use client";

import { useState } from "react";
import {
  CheckCircle, XCircle, Clock, Mail, Phone, Linkedin,
  ExternalLink, AlertTriangle, CreditCard, Image as ImageIcon,
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
  client_id: string;
  reason: string;
  evidence: string | null;
  status: string;
  admin_notes: string | null;
  channels_provided: string[] | null;
  channel_evidence: ChannelEvidence[] | null;
  created_at: string;
  resolved_at: string | null;
  leads: {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string | null;
    contact_phone: string | null;
    contact_linkedin: string | null;
  };
  profiles: {
    id: string;
    full_name: string;
    email: string;
    company_id: string | null;
  };
}

const CHANNEL_ICONS: Record<string, React.ElementType> = { email: Mail, phone: Phone, linkedin: Linkedin };
const CHANNEL_LABELS: Record<string, string> = { email: "Email", phone: "Phone", linkedin: "LinkedIn" };

export function DisputeReview({ initialDisputes }: { initialDisputes: Dispute[] }) {
  const [disputes, setDisputes] = useState(initialDisputes);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const filtered = filter === "all" ? disputes : disputes.filter((d) => d.status === filter);
  const pendingCount = disputes.filter((d) => d.status === "pending").length;

  async function resolveDispute(disputeId: string, action: "approve" | "reject") {
    setProcessing(disputeId);
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return;

    const notes = adminNotes[disputeId] || "";

    const res = await fetch("/api/admin/resolve-dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId,
        action,
        adminNotes: notes,
        leadId: dispute.lead_id,
        clientId: dispute.client_id,
        companyId: dispute.profiles?.company_id,
        companyName: dispute.leads?.company_name,
        clientName: dispute.profiles?.full_name,
        clientEmail: dispute.profiles?.email,
      }),
    });

    if (res.ok) {
      setDisputes(disputes.map((d) =>
        d.id === disputeId
          ? { ...d, status: action === "approve" ? "approved" : "rejected", admin_notes: notes, resolved_at: new Date().toISOString() }
          : d
      ));
    }
    setProcessing(null);
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f ? "bg-primary text-white" : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            {f === "pending" ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="font-semibold mb-1">
            {filter === "pending" ? "No pending disputes" : "No disputes found"}
          </p>
          <p className="text-sm text-muted">
            {filter === "pending" ? "All caught up!" : "Try changing the filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((dispute) => {
            const isPending = dispute.status === "pending";
            return (
              <div key={dispute.id} className={`bg-card border rounded-2xl overflow-hidden ${
                isPending ? "border-warning/40" : dispute.status === "approved" ? "border-success/30" : "border-border"
              }`}>
                {/* Header */}
                <div className="p-5 border-b border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{dispute.leads?.company_name}</h3>
                      <p className="text-sm text-muted">{dispute.leads?.contact_name}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 ${
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
                  <p className="text-xs text-muted">
                    Filed by <strong>{dispute.profiles?.full_name}</strong> ({dispute.profiles?.email}) on{" "}
                    {new Date(dispute.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                {/* Contact channels provided */}
                <div className="p-5 border-b border-border/50 bg-background/30">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contact Channels Provided</h4>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {dispute.leads?.contact_email && (
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> {dispute.leads.contact_email}</span>
                    )}
                    {dispute.leads?.contact_phone && (
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary" /> {dispute.leads.contact_phone}</span>
                    )}
                    {dispute.leads?.contact_linkedin && (
                      <a href={dispute.leads.contact_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                        <Linkedin className="w-3.5 h-3.5" /> LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Evidence per channel */}
                <div className="p-5">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Client Evidence</h4>
                  {dispute.channel_evidence && dispute.channel_evidence.length > 0 ? (
                    <div className="space-y-3">
                      {dispute.channel_evidence.map((ev, i) => {
                        const Icon = CHANNEL_ICONS[ev.channel] || Mail;
                        return (
                          <div key={i} className="bg-background/50 border border-border/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-4 h-4 text-primary" />
                              <span className="font-semibold text-sm">{CHANNEL_LABELS[ev.channel]}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger">{ev.issue.replace(/_/g, " ")}</span>
                            </div>
                            <p className="text-sm text-muted">{ev.detail}</p>
                            {ev.screenshot_url && (
                              <a href={ev.screenshot_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline">
                                <ImageIcon className="w-3.5 h-3.5" /> View screenshot
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{dispute.reason}</p>
                  )}
                </div>

                {/* Admin response (if already resolved) */}
                {!isPending && dispute.admin_notes && (
                  <div className="px-5 pb-5">
                    <div className="bg-background rounded-xl p-4">
                      <p className="text-sm"><span className="font-medium">Your response:</span> {dispute.admin_notes}</p>
                    </div>
                  </div>
                )}

                {/* Action buttons (pending only) */}
                {isPending && (
                  <div className="p-5 border-t border-border/50 bg-background/30">
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-muted mb-1.5">Admin Notes (sent to client)</label>
                      <textarea
                        value={adminNotes[dispute.id] || ""}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [dispute.id]: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Optional: explain your decision..."
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => resolveDispute(dispute.id, "approve")}
                        disabled={processing === dispute.id}
                        className="flex items-center gap-2 px-5 py-2.5 bg-success text-white rounded-xl text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" />
                        {processing === dispute.id ? "Processing..." : "Approve & Refund 1 Credit"}
                      </button>
                      <button
                        onClick={() => resolveDispute(dispute.id, "reject")}
                        disabled={processing === dispute.id}
                        className="flex items-center gap-2 px-5 py-2.5 border border-danger text-danger rounded-xl text-sm font-semibold hover:bg-danger/5 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

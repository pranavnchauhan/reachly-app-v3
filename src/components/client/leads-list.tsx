"use client";

import { useState } from "react";
import { Eye, Mail, Linkedin, Globe, Phone, Building2, MapPin, Lock, ChevronRight, AlertTriangle, Flame } from "lucide-react";
import type { MatchedSignal, ApproachStrategy, GeneratedEmail } from "@/types/database";

interface Lead {
  id: string;
  company_name: string;
  company_website: string | null;
  company_industry: string;
  company_size: string | null;
  company_location: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_linkedin: string | null;
  contact_summary: string | null;
  signals_matched: MatchedSignal[];
  justification: string;
  approach_strategies: ApproachStrategy[];
  email_templates: GeneratedEmail[];
  status: string;
  published_at: string | null;
}

export function ClientLeadsList({
  initialLeads,
  creditBalance,
  clientId,
}: {
  initialLeads: Lead[];
  creditBalance: number;
  clientId: string;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [credits, setCredits] = useState(creditBalance);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [revealing, setRevealing] = useState<string | null>(null);

  async function revealLead(leadId: string) {
    if (credits < 1) return;
    setRevealing(leadId);

    const res = await fetch("/api/leads/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, clientId }),
    });

    if (res.ok) {
      const { lead } = await res.json();
      const updated = leads.map((l) => l.id === leadId ? { ...l, ...lead, status: "revealed" } : l);
      setLeads(updated);
      setCredits(credits - 1);
      if (selectedLead?.id === leadId) setSelectedLead({ ...selectedLead, ...lead, status: "revealed" });
    }
    setRevealing(null);
  }

  const published = leads.filter((l) => l.status === "published");
  const revealed = leads.filter((l) => ["revealed", "disputed", "refunded"].includes(l.status));

  return (
    <div className="space-y-6">
      {/* New Leads */}
      {published.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">New Leads ({published.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {published.map((lead) => (
              <div key={lead.id}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {lead.signals_matched?.[0]?.source_url ? (
                    <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5" /> HOT
                    </span>
                  ) : null}
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">new</span>
                </div>
                <h3 className="font-semibold">{lead.company_name}</h3>
                <p className="text-xs text-muted mt-1">{lead.company_industry !== "Unknown" ? lead.company_industry : ""} {lead.company_location && `| ${lead.company_location}`}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.signals_matched?.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{s.signal_name}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 text-muted">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-xs">Contact hidden — reveal for 1 credit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revealed Leads */}
      {revealed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Revealed Leads ({revealed.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {revealed.map((lead) => (
              <div key={lead.id}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <h3 className="font-semibold">{lead.company_name}</h3>
                <p className="text-sm mt-1">
                  <span className="font-medium">{lead.contact_name}</span>
                  <span className="text-muted"> — {lead.contact_title}</span>
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {lead.contact_email && <span className="flex items-center gap-1 text-primary"><Mail className="w-3 h-3" /> Email</span>}
                  {lead.contact_linkedin && <span className="flex items-center gap-1 text-primary"><Linkedin className="w-3 h-3" /> LinkedIn</span>}
                  {lead.contact_phone && <span className="flex items-center gap-1 text-primary"><Phone className="w-3 h-3" /> Phone</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.signals_matched?.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{s.signal_name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!published.length && !revealed.length && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-12 text-center">
          <Eye className="w-10 h-10 text-muted mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No leads yet</h2>
          <p className="text-sm text-muted">Your leads will appear here once they&apos;re ready.</p>
        </div>
      )}

      {/* Lead Detail Overlay */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {selectedLead.signals_matched?.[0]?.source_url && (
                    <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3" /> HOT
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedLead.status === "published" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
                  }`}>{selectedLead.status}</span>
                </div>
                <button onClick={() => setSelectedLead(null)} className="text-muted hover:text-foreground text-sm">Close</button>
              </div>
              <h2 className="text-xl font-bold">{selectedLead.company_name}</h2>

              {selectedLead.status === "published" ? (
                <div className="mt-4">
                  <button
                    onClick={() => revealLead(selectedLead.id)}
                    disabled={credits < 1 || revealing === selectedLead.id}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    {revealing === selectedLead.id ? "Revealing..." : `Reveal Contact (1 credit) — ${credits} remaining`}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted mt-1">{selectedLead.contact_name} — {selectedLead.contact_title}</p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Company Info */}
              <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Company</h4>
                <div className="space-y-1.5 text-sm">
                  {selectedLead.company_website && (
                    <a href={selectedLead.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                      <Globe className="w-3.5 h-3.5" /> {selectedLead.company_website}
                    </a>
                  )}
                  {selectedLead.company_industry !== "Unknown" && <p className="flex items-center gap-1.5 text-muted"><Building2 className="w-3.5 h-3.5" /> {selectedLead.company_industry}</p>}
                  {selectedLead.company_size && <p className="text-muted">{selectedLead.company_size} employees</p>}
                  {selectedLead.company_location && <p className="flex items-center gap-1.5 text-muted"><MapPin className="w-3.5 h-3.5" /> {selectedLead.company_location}</p>}
                </div>
              </div>

              {/* Contact (only if revealed) */}
              {selectedLead.status !== "published" && (
                <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Contact</h4>
                  <div className="space-y-1.5 text-sm">
                    <p className="font-medium">{selectedLead.contact_name} — {selectedLead.contact_title}</p>
                    {selectedLead.contact_email && (
                      <a href={`mailto:${selectedLead.contact_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                        <Mail className="w-3.5 h-3.5" /> {selectedLead.contact_email}
                      </a>
                    )}
                    {selectedLead.contact_phone && <p className="flex items-center gap-1.5 text-muted"><Phone className="w-3.5 h-3.5" /> {selectedLead.contact_phone}</p>}
                    {selectedLead.contact_linkedin && (
                      <a href={selectedLead.contact_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                        <Linkedin className="w-3.5 h-3.5" /> LinkedIn Profile
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Background (only if revealed) */}
              {selectedLead.status !== "published" && selectedLead.contact_summary && (
                <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Contact Background</h4>
                  <p className="text-sm text-muted leading-relaxed">{selectedLead.contact_summary}</p>
                </div>
              )}

              {/* Why This Lead */}
              <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Why This Lead</h4>
                <p className="text-sm leading-relaxed">{selectedLead.justification}</p>
              </div>

              {/* Signals */}
              <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Signals</h4>
                <div className="space-y-2">
                  {selectedLead.signals_matched?.map((s, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.signal_name}</span>
                        <span className="text-xs text-accent">{Math.round(s.confidence * 100)}%</span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{s.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approach Strategies (only if revealed) */}
              {selectedLead.status !== "published" && selectedLead.approach_strategies?.length > 0 && (
                <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Approach Strategies</h4>
                  <div className="space-y-3">
                    {selectedLead.approach_strategies.map((s, i) => (
                      <div key={i}>
                        <h5 className="text-sm font-semibold">{s.name}</h5>
                        <p className="text-xs text-muted mt-0.5">{s.description}</p>
                        <ul className="mt-1.5 space-y-0.5">
                          {s.talking_points?.map((p, j) => (
                            <li key={j} className="text-xs text-muted flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />{p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Templates (only if revealed) */}
              {selectedLead.status !== "published" && selectedLead.email_templates?.length > 0 && (
                <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Email Templates</h4>
                  <div className="space-y-3">
                    {selectedLead.email_templates.map((e, i) => (
                      <div key={i}>
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{e.approach}</span>
                        <p className="text-sm font-medium mt-1.5">Subject: {e.subject}</p>
                        <div className="mt-1.5 bg-card/50 rounded-lg p-3 border border-border/20">
                          <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{e.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispute button for revealed leads */}
              {selectedLead.status === "revealed" && (
                <div className="pt-2">
                  <a href={`/dashboard/disputes?lead=${selectedLead.id}`}
                    className="flex items-center gap-1.5 text-sm text-warning hover:underline">
                    <AlertTriangle className="w-3.5 h-3.5" /> Dispute this lead
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

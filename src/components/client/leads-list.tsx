"use client";

import { useState } from "react";
import {
  Eye, Mail, Linkedin, Globe, Phone, Building2, MapPin, Lock,
  ChevronRight, ChevronDown, AlertTriangle, Flame, Send, Copy,
  Check, X, Users, Target, MessageSquare, Sparkles, ExternalLink,
} from "lucide-react";
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

type TabId = "overview" | "signals" | "strategies" | "emails";

function Collapsible({ title, badge, children, defaultOpen = false }: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-background/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{badge}</span>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border/30">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function buildMailtoUrl(email: string, template: GeneratedEmail, contactName: string, companyName: string): string {
  const subject = template.subject
    .replace(/\{\{company\}\}/g, companyName)
    .replace(/\{\{contact_name\}\}/g, contactName);
  const body = template.body
    .replace(/\{\{company\}\}/g, companyName)
    .replace(/\{\{contact_name\}\}/g, contactName);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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

  function openLead(lead: Lead) {
    setSelectedLead(lead);
    setActiveTab("overview");
  }

  const published = leads.filter((l) => l.status === "published");
  const revealed = leads.filter((l) => ["revealed", "disputed", "refunded"].includes(l.status));

  const tabs: { id: TabId; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "overview", label: "Overview", icon: Users, show: true },
    { id: "signals", label: "Signals", icon: Target, show: true },
    { id: "strategies", label: "Strategies", icon: Sparkles, show: selectedLead?.status !== "published" },
    { id: "emails", label: "Emails", icon: MessageSquare, show: selectedLead?.status !== "published" },
  ];

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
                onClick={() => openLead(lead)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {lead.signals_matched?.[0]?.source_url && (
                    <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5" /> HOT
                    </span>
                  )}
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
                onClick={() => openLead(lead)}
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

      {/* ═══════ LEAD DETAIL MODAL ═══════ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="p-5 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {selectedLead.signals_matched?.[0]?.source_url && (
                    <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="w-3 h-3" /> HOT
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedLead.status === "published" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
                  }`}>{selectedLead.status === "published" ? "New" : "Revealed"}</span>
                </div>
                <button onClick={() => setSelectedLead(null)} className="w-8 h-8 rounded-lg hover:bg-background flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
              <h2 className="text-xl font-bold">{selectedLead.company_name}</h2>
              {selectedLead.status !== "published" && (
                <p className="text-sm text-muted mt-0.5">{selectedLead.contact_name} — {selectedLead.contact_title}</p>
              )}

              {/* Reveal CTA */}
              {selectedLead.status === "published" && (
                <button
                  onClick={() => revealLead(selectedLead.id)}
                  disabled={credits < 1 || revealing === selectedLead.id}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <Eye className="w-4 h-4" />
                  {revealing === selectedLead.id ? "Revealing..." : `Reveal Contact (1 credit) — ${credits} remaining`}
                </button>
              )}

              {/* Tabs */}
              <div className="flex gap-1 mt-4 -mb-5 border-b-0">
                {tabs.filter((t) => t.show).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === tab.id
                        ? "bg-background border border-border border-b-card text-foreground -mb-px"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === "signals" && selectedLead.signals_matched?.length > 0 && (
                      <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{selectedLead.signals_matched.length}</span>
                    )}
                    {tab.id === "emails" && selectedLead.email_templates?.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{selectedLead.email_templates.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-5 overflow-y-auto flex-1">

              {/* ─── TAB: Overview ─── */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Company */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Company</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedLead.company_website && (
                        <a href={selectedLead.company_website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline col-span-2">
                          <Globe className="w-4 h-4" /> {selectedLead.company_website.replace(/^https?:\/\//, "")}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {selectedLead.company_industry !== "Unknown" && (
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <Building2 className="w-4 h-4" /> {selectedLead.company_industry}
                        </div>
                      )}
                      {selectedLead.company_size && (
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <Users className="w-4 h-4" /> {selectedLead.company_size} employees
                        </div>
                      )}
                      {selectedLead.company_location && (
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <MapPin className="w-4 h-4" /> {selectedLead.company_location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact (revealed only) */}
                  {selectedLead.status !== "published" && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contact</h4>
                      <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                        <p className="font-semibold">{selectedLead.contact_name}</p>
                        <p className="text-sm text-muted">{selectedLead.contact_title}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {selectedLead.contact_email && (
                            <a href={`mailto:${selectedLead.contact_email}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors">
                              <Mail className="w-3.5 h-3.5" /> {selectedLead.contact_email}
                            </a>
                          )}
                          {selectedLead.contact_phone && (
                            <a href={`tel:${selectedLead.contact_phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm hover:bg-success/20 transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {selectedLead.contact_phone}
                            </a>
                          )}
                          {selectedLead.contact_linkedin && (
                            <a href={selectedLead.contact_linkedin} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm hover:bg-accent/20 transition-colors">
                              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact Background (revealed only) */}
                  {selectedLead.status !== "published" && selectedLead.contact_summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Background</h4>
                      <p className="text-sm text-muted leading-relaxed">{selectedLead.contact_summary}</p>
                    </div>
                  )}

                  {/* Published: locked contact preview */}
                  {selectedLead.status === "published" && (
                    <div className="bg-background/50 border border-border/30 rounded-xl p-6 text-center">
                      <Lock className="w-8 h-8 text-muted mx-auto mb-2" />
                      <p className="text-sm font-medium">Contact details are locked</p>
                      <p className="text-xs text-muted mt-1">Reveal this lead to see full contact info, strategies, and email templates.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: Signals ─── */}
              {activeTab === "signals" && (
                <div className="space-y-4">
                  {/* Why This Lead */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Why This Lead</h4>
                    <p className="text-sm leading-relaxed">{selectedLead.justification}</p>
                  </div>

                  {/* Signal Evidence */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Buying Signals</h4>
                    <div className="space-y-3">
                      {selectedLead.signals_matched?.map((s, i) => (
                        <div key={i} className="bg-background/50 border border-border/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-sm">{s.signal_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              s.confidence >= 0.8 ? "bg-success/10 text-success" :
                              s.confidence >= 0.5 ? "bg-warning/10 text-warning" :
                              "bg-muted/10 text-muted"
                            }`}>
                              {Math.round(s.confidence * 100)}% confidence
                            </span>
                          </div>
                          <p className="text-sm text-muted">{s.evidence}</p>
                          {s.source_url && (
                            <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                              <ExternalLink className="w-3 h-3" /> View source
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB: Strategies ─── */}
              {activeTab === "strategies" && selectedLead.status !== "published" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Approach Strategies</h4>
                  {selectedLead.approach_strategies?.length > 0 ? (
                    selectedLead.approach_strategies.map((s, i) => (
                      <Collapsible key={i} title={s.name} badge={s.description} defaultOpen={i === 0}>
                        <ul className="mt-3 space-y-2">
                          {s.talking_points?.map((p, j) => (
                            <li key={j} className="text-sm text-muted flex items-start gap-2">
                              <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />{p}
                            </li>
                          ))}
                        </ul>
                      </Collapsible>
                    ))
                  ) : (
                    <p className="text-sm text-muted">No strategies generated for this lead.</p>
                  )}
                </div>
              )}

              {/* ─── TAB: Emails ─── */}
              {activeTab === "emails" && selectedLead.status !== "published" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Email Templates</h4>
                  {selectedLead.email_templates?.length > 0 ? (
                    selectedLead.email_templates.map((e, i) => {
                      const resolvedSubject = e.subject
                        .replace(/\{\{company\}\}/g, selectedLead.company_name)
                        .replace(/\{\{contact_name\}\}/g, selectedLead.contact_name);
                      const resolvedBody = e.body
                        .replace(/\{\{company\}\}/g, selectedLead.company_name)
                        .replace(/\{\{contact_name\}\}/g, selectedLead.contact_name);

                      return (
                        <Collapsible key={i} title={resolvedSubject} badge={e.approach} defaultOpen={i === 0}>
                          <div className="mt-3 bg-card/50 rounded-lg p-4 border border-border/20">
                            <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{resolvedBody}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            {selectedLead.contact_email && (
                              <a
                                href={buildMailtoUrl(selectedLead.contact_email, e, selectedLead.contact_name, selectedLead.company_name)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" /> Send this email
                              </a>
                            )}
                            <CopyButton text={`Subject: ${resolvedSubject}\n\n${resolvedBody}`} />
                          </div>
                        </Collapsible>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted">No email templates generated for this lead.</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {selectedLead.status === "revealed" && (
              <div className="p-4 border-t border-border flex-shrink-0 flex items-center justify-between">
                <a href={`/dashboard/disputes?lead=${selectedLead.id}`}
                  className="flex items-center gap-1.5 text-sm text-warning hover:underline">
                  <AlertTriangle className="w-3.5 h-3.5" /> Dispute this lead
                </a>
                <div className="flex items-center gap-2">
                  {selectedLead.contact_linkedin && (
                    <a href={selectedLead.contact_linkedin} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-background transition-colors">
                      <Linkedin className="w-3.5 h-3.5" /> Connect
                    </a>
                  )}
                  {selectedLead.contact_email && (
                    <a href={`mailto:${selectedLead.contact_email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

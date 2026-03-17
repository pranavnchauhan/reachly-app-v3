"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, AlertTriangle, ChevronDown, ChevronUp, Mail, Linkedin, Globe } from "lucide-react";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealing, setRevealing] = useState<string | null>(null);
  const supabase = createClient();

  async function revealLead(leadId: string) {
    if (credits < 1) return;
    setRevealing(leadId);

    // Deduct credit via API
    const res = await fetch("/api/leads/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, clientId }),
    });

    if (res.ok) {
      const { lead } = await res.json();
      setLeads(leads.map((l) => l.id === leadId ? { ...l, ...lead, status: "revealed" } : l));
      setCredits(credits - 1);
    }
    setRevealing(null);
  }

  const published = leads.filter((l) => l.status === "published");
  const revealed = leads.filter((l) => ["revealed", "disputed", "refunded"].includes(l.status));

  return (
    <div className="space-y-8">
      {/* Available Leads */}
      {published.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Available Leads ({published.length})</h2>
          <div className="space-y-3">
            {published.map((lead) => (
              <div key={lead.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{lead.company_name}</h3>
                    <p className="text-sm text-muted mt-1">{lead.company_industry} | {lead.company_location || "Unknown location"}</p>
                    <div className="flex gap-2 mt-2">
                      {lead.signals_matched?.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">{s.signal_name}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => revealLead(lead.id)}
                    disabled={credits < 1 || revealing === lead.id}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    {revealing === lead.id ? "Revealing..." : "Reveal (1 credit)"}
                  </button>
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
          <div className="space-y-3">
            {revealed.map((lead) => (
              <div key={lead.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{lead.company_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        lead.status === "revealed" ? "bg-success/10 text-success" :
                        lead.status === "disputed" ? "bg-warning/10 text-warning" :
                        "bg-muted/10 text-muted"
                      }`}>{lead.status}</span>
                    </div>
                    <p className="text-sm mt-1">
                      <span className="font-medium">{lead.contact_name}</span>
                      <span className="text-muted"> — {lead.contact_title}</span>
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      {lead.contact_email && (
                        <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Mail className="w-3.5 h-3.5" />{lead.contact_email}
                        </a>
                      )}
                      {lead.contact_linkedin && (
                        <a href={lead.contact_linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Linkedin className="w-3.5 h-3.5" />LinkedIn
                        </a>
                      )}
                      {lead.company_website && (
                        <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                          <Globe className="w-3.5 h-3.5" />Website
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {lead.status === "revealed" && (
                      <a href={`/dashboard/disputes?lead=${lead.id}`}
                        className="p-2 rounded-lg bg-warning/10 text-warning hover:bg-warning/20" title="Dispute">
                        <AlertTriangle className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                      className="p-2 rounded-lg hover:bg-background text-muted">
                      {expandedId === lead.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === lead.id && (
                  <div className="border-t border-border p-5 bg-background/50 space-y-5">
                    {/* Justification */}
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Why This Lead</h4>
                      <p className="text-sm text-muted">{lead.justification}</p>
                    </div>

                    {/* Contact Summary */}
                    {lead.contact_summary && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Contact Background</h4>
                        <p className="text-sm text-muted">{lead.contact_summary}</p>
                      </div>
                    )}

                    {/* Approach Strategies */}
                    {lead.approach_strategies?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Approach Strategies</h4>
                        <div className="space-y-3">
                          {lead.approach_strategies.map((strategy, i) => (
                            <div key={i} className="border border-border rounded-lg p-3">
                              <h5 className="text-sm font-medium">{strategy.name}</h5>
                              <p className="text-xs text-muted mt-1">{strategy.description}</p>
                              <ul className="mt-2 space-y-1">
                                {strategy.talking_points.map((point, j) => (
                                  <li key={j} className="text-xs text-muted flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span>{point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Email Templates */}
                    {lead.email_templates?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Email Templates</h4>
                        <div className="space-y-3">
                          {lead.email_templates.map((email, i) => (
                            <div key={i} className="border border-border rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full">{email.approach}</span>
                              </div>
                              <p className="text-sm font-medium">Subject: {email.subject}</p>
                              <p className="text-xs text-muted mt-2 whitespace-pre-wrap">{email.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!published.length && !revealed.length && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Zap className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted">No leads yet. Your leads will appear here once the pipeline runs.</p>
        </div>
      )}
    </div>
  );
}

function Zap(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
  );
}

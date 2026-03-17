"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, X, Eye, ChevronDown, ChevronUp, Mail, Linkedin, Globe, Phone, Building2, MapPin, Users } from "lucide-react";
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
  discovered_at: string;
  client_niches: {
    name: string;
    client_id: string;
    profiles: { full_name: string; company_name: string | null };
  };
}

export function LeadValidationList({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "discovered" | "validated">("all");
  const supabase = createClient();

  async function updateLeadStatus(id: string, status: "validated" | "published") {
    const updateData: Record<string, string> = { status };
    if (status === "validated") updateData.validated_at = new Date().toISOString();
    if (status === "published") updateData.published_at = new Date().toISOString();

    const { error } = await supabase.from("leads").update(updateData).eq("id", id);
    if (!error) {
      setLeads(leads.map((l) => l.id === id ? { ...l, status } : l));
    }
  }

  async function rejectLead(id: string) {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) {
      setLeads(leads.filter((l) => l.id !== id));
    }
  }

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["all", "discovered", "validated"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-primary text-white" : "bg-card border border-border text-muted hover:text-foreground"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted">No leads to validate. Run the pipeline to discover new leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <div key={lead.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{lead.company_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      lead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{lead.status}</span>
                    {lead.client_niches && (
                      <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full">
                        {lead.client_niches.profiles?.company_name || lead.client_niches.profiles?.full_name} — {lead.client_niches.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-1">
                    <span className="font-medium">{lead.contact_name}</span> — {lead.contact_title}
                    {lead.company_industry !== "Unknown" && ` | ${lead.company_industry}`}
                    {lead.company_location && ` | ${lead.company_location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.status === "discovered" && (
                    <button onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, "validated"); }}
                      className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20" title="Validate">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {lead.status === "validated" && (
                    <button onClick={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, "published"); }}
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20" title="Publish to Client">
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); rejectLead(lead.id); }}
                    className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20" title="Reject">
                    <X className="w-4 h-4" />
                  </button>
                  {expandedId === lead.id ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === lead.id && (
                <div className="border-t border-border p-5 bg-background/50 space-y-5">

                  {/* Company & Contact Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Company</h4>
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{lead.company_name}</p>
                        {lead.company_website && (
                          <p className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-muted" />
                            <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{lead.company_website}</a>
                          </p>
                        )}
                        {lead.company_industry !== "Unknown" && <p className="text-muted">Industry: {lead.company_industry}</p>}
                        {lead.company_size && <p className="text-muted flex items-center gap-1.5"><Users className="w-3 h-3" /> {lead.company_size} employees</p>}
                        {lead.company_location && <p className="text-muted flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {lead.company_location}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Contact</h4>
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{lead.contact_name} — {lead.contact_title}</p>
                        {lead.contact_email && (
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-muted" />
                            <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">{lead.contact_email}</a>
                          </p>
                        )}
                        {lead.contact_phone && (
                          <p className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted" /> {lead.contact_phone}</p>
                        )}
                        {lead.contact_linkedin && (
                          <p className="flex items-center gap-1.5">
                            <Linkedin className="w-3 h-3 text-muted" />
                            <a href={lead.contact_linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn Profile</a>
                          </p>
                        )}
                        {!lead.contact_email && !lead.contact_phone && !lead.contact_linkedin && (
                          <p className="text-muted italic">No contact details available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Summary */}
                  {lead.contact_summary && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Contact Background</h4>
                      <p className="text-sm text-muted">{lead.contact_summary}</p>
                    </div>
                  )}

                  {/* Justification */}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Why This Lead</h4>
                    <p className="text-sm text-muted">{lead.justification || "No justification provided"}</p>
                  </div>

                  {/* Signals */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Signals Matched ({lead.signals_matched?.length || 0})</h4>
                    <div className="space-y-2">
                      {lead.signals_matched?.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="shrink-0 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full mt-0.5">
                            {Math.round(s.confidence * 100)}%
                          </span>
                          <div>
                            <span className="font-medium">{s.signal_name}</span>
                            <span className="text-muted"> — {s.evidence}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Approach Strategies */}
                  {lead.approach_strategies?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Approach Strategies ({lead.approach_strategies.length})</h4>
                      <div className="grid gap-3">
                        {lead.approach_strategies.map((strategy, i) => (
                          <div key={i} className="border border-border rounded-lg p-3">
                            <h5 className="text-sm font-medium">{strategy.name}</h5>
                            <p className="text-xs text-muted mt-1">{strategy.description}</p>
                            {strategy.talking_points?.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {strategy.talking_points.map((point, j) => (
                                  <li key={j} className="text-xs text-muted flex items-start gap-1.5">
                                    <span className="text-primary mt-0.5">•</span>{point}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email Templates */}
                  {lead.email_templates?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Email Templates ({lead.email_templates.length})</h4>
                      <div className="space-y-3">
                        {lead.email_templates.map((email, i) => (
                          <div key={i} className="border border-border rounded-lg p-3">
                            <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full">{email.approach}</span>
                            <p className="text-sm font-medium mt-2">Subject: {email.subject}</p>
                            <p className="text-xs text-muted mt-2 whitespace-pre-wrap bg-background rounded p-2">{email.body}</p>
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
      )}
    </div>
  );
}

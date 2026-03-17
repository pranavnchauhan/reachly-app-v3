"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Check, X, Eye, Mail, Linkedin, Globe, Phone, Building2, MapPin,
  Flame, Snowflake, ExternalLink, ChevronRight, Search,
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
  discovered_at: string;
  client_niches: {
    name: string;
    client_id: string;
    profiles: { full_name: string; company_name: string | null };
  };
}

export function LeadValidationList({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<"all" | "discovered" | "validated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();

  async function updateLeadStatus(id: string, status: "validated" | "published") {
    const updateData: Record<string, string> = { status };
    if (status === "validated") updateData.validated_at = new Date().toISOString();
    if (status === "published") updateData.published_at = new Date().toISOString();
    const { error } = await supabase.from("leads").update(updateData).eq("id", id);
    if (!error) {
      setLeads(leads.map((l) => l.id === id ? { ...l, status } : l));
      if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status });
    }
  }

  async function rejectLead(id: string) {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) {
      setLeads(leads.filter((l) => l.id !== id));
      if (selectedLead?.id === id) setSelectedLead(null);
    }
  }

  const filtered = leads
    .filter((l) => filter === "all" || l.status === filter)
    .filter((l) => !searchQuery || `${l.company_name} ${l.contact_name} ${l.contact_title} ${l.company_industry}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const isHot = (lead: Lead) => lead.signals_matched?.[0]?.source_url;

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(["all", "discovered", "validated"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-card border border-border text-muted hover:text-foreground"
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? leads.length : leads.filter(l => l.status === f).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary w-48"
              placeholder="Search leads..." />
          </div>
          {leads.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Delete all ${filtered.length} leads?`)) return;
                await Promise.all(filtered.map((l) => supabase.from("leads").delete().eq("id", l.id)));
                setLeads(leads.filter((l) => !filtered.find((f) => f.id === l.id)));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-danger bg-danger/10 hover:bg-danger/20"
            >
              <X className="w-3.5 h-3.5" /> Clear ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted">No leads to validate. Run the pipeline to discover new leads.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Lead Cards Grid */}
          <div className={`grid grid-cols-1 ${selectedLead ? "md:grid-cols-1 w-1/3" : "md:grid-cols-2 lg:grid-cols-3"} gap-3 transition-all`}>
            {filtered.map((lead) => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedLead?.id === lead.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                }`}
              >
                {/* Source + Status badges */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isHot(lead) ? (
                      <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" /> HOT
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Snowflake className="w-2.5 h-2.5" /> COLD
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      lead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{lead.status}</span>
                  </div>
                  {lead.signals_matched?.[0] && (
                    <span className="text-[10px] text-muted">
                      {Math.round(lead.signals_matched[0].confidence * 100)}%
                    </span>
                  )}
                </div>

                {/* Company + Contact */}
                <h3 className="font-semibold text-sm">{lead.company_name}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {lead.contact_name} — {lead.contact_title}
                </p>

                {/* Signal badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.signals_matched?.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                      {s.signal_name}
                    </span>
                  ))}
                  {(lead.signals_matched?.length ?? 0) > 2 && (
                    <span className="text-[10px] text-muted">+{lead.signals_matched.length - 2}</span>
                  )}
                </div>

                {/* Contact info indicators */}
                <div className="flex items-center gap-2 mt-2 text-muted">
                  {lead.contact_email && <Mail className="w-3 h-3 text-success" />}
                  {lead.contact_phone && <Phone className="w-3 h-3 text-success" />}
                  {lead.contact_linkedin && <Linkedin className="w-3 h-3 text-success" />}
                  {lead.company_website && <Globe className="w-3 h-3 text-success" />}
                </div>

                {/* Client tag */}
                {lead.client_niches && (
                  <p className="text-[10px] text-muted mt-2 truncate">
                    {lead.client_niches.profiles?.company_name || lead.client_niches.profiles?.full_name} — {lead.client_niches.name}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedLead && (
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)] sticky top-24 space-y-4">
              {/* Header Card */}
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isHot(selectedLead) ? (
                      <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Flame className="w-3 h-3" /> HOT — News Signal
                      </span>
                    ) : (
                      <span className="text-xs font-semibold bg-blue-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Snowflake className="w-3 h-3" /> COLD — Database
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedLead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{selectedLead.status}</span>
                  </div>
                  <button onClick={() => setSelectedLead(null)} className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-background">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h2 className="text-xl font-bold">{selectedLead.company_name}</h2>
                <p className="text-sm text-muted mt-1">{selectedLead.contact_name} — {selectedLead.contact_title}</p>

                <div className="flex items-center gap-2 mt-4">
                  {selectedLead.status === "discovered" && (
                    <button onClick={() => updateLeadStatus(selectedLead.id, "validated")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Validate
                    </button>
                  )}
                  {selectedLead.status === "validated" && (
                    <button onClick={() => updateLeadStatus(selectedLead.id, "published")}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Publish to Client
                    </button>
                  )}
                  <button onClick={() => rejectLead(selectedLead.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>

              {/* Company & Contact Card */}
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Company</h4>
                    <div className="space-y-2 text-sm">
                      {selectedLead.company_website && (
                        <a href={selectedLead.company_website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline">
                          <Globe className="w-3.5 h-3.5 shrink-0" /> {selectedLead.company_website}
                        </a>
                      )}
                      {selectedLead.company_industry !== "Unknown" && (
                        <p className="flex items-center gap-1.5 text-muted"><Building2 className="w-3.5 h-3.5 shrink-0" /> {selectedLead.company_industry}</p>
                      )}
                      {selectedLead.company_size && <p className="text-muted">{selectedLead.company_size} employees</p>}
                      {selectedLead.company_location && (
                        <p className="flex items-center gap-1.5 text-muted"><MapPin className="w-3.5 h-3.5 shrink-0" /> {selectedLead.company_location}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Contact</h4>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">{selectedLead.contact_name}</p>
                      <p className="text-muted">{selectedLead.contact_title}</p>
                      {selectedLead.contact_email && (
                        <a href={`mailto:${selectedLead.contact_email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {selectedLead.contact_email}
                        </a>
                      )}
                      {selectedLead.contact_phone && (
                        <p className="flex items-center gap-1.5 text-muted"><Phone className="w-3.5 h-3.5 shrink-0" /> {selectedLead.contact_phone}</p>
                      )}
                      {selectedLead.contact_linkedin && (
                        <a href={selectedLead.contact_linkedin} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline">
                          <Linkedin className="w-3.5 h-3.5 shrink-0" /> LinkedIn Profile
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Background Card */}
              {selectedLead.contact_summary && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Contact Background</h4>
                  <p className="text-sm text-muted leading-relaxed">{selectedLead.contact_summary}</p>
                </div>
              )}

              {/* Why This Lead Card */}
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Why This Lead</h4>
                <p className="text-sm leading-relaxed">{selectedLead.justification}</p>
              </div>

              {/* Signals Card */}
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                  Signals ({selectedLead.signals_matched?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedLead.signals_matched?.map((s, i) => (
                    <div key={i} className="bg-background/50 border border-border/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{s.signal_name}</span>
                        <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1.5 leading-relaxed">{s.evidence}</p>
                      {s.source_url && (
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5">
                          <ExternalLink className="w-3 h-3" /> View Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Approach Strategies Card */}
              {selectedLead.approach_strategies?.length > 0 && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                    Approach Strategies ({selectedLead.approach_strategies.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedLead.approach_strategies.map((s, i) => (
                      <div key={i} className="bg-background/50 border border-border/30 rounded-lg p-3">
                        <h5 className="text-sm font-semibold">{s.name}</h5>
                        <p className="text-xs text-muted mt-1">{s.description}</p>
                        <ul className="mt-2 space-y-1">
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

              {/* Email Templates Card */}
              {selectedLead.email_templates?.length > 0 && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                    Email Templates ({selectedLead.email_templates.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedLead.email_templates.map((e, i) => (
                      <div key={i} className="bg-background/50 border border-border/30 rounded-lg p-4">
                        <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{e.approach}</span>
                        <p className="text-sm font-medium mt-2">Subject: {e.subject}</p>
                        <div className="mt-2 bg-card/50 rounded-lg p-3 border border-border/20">
                          <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{e.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

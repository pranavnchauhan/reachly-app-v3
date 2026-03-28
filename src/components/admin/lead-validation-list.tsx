"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Check, X, Eye, Mail, Linkedin, Globe, Phone, Building2, MapPin,
  Flame, ExternalLink, ChevronRight, Search, Users, RefreshCw, Star, ArrowRight,
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
  niche_template_id: string | null;
  niche_templates: { id: string; name: string } | null;
  client_niches: {
    name: string;
    client_id: string;
    profiles: { full_name: string; company_name: string | null };
  } | null;
}

interface Template {
  id: string;
  name: string;
}

interface ClientRecommendation {
  clientNicheId: string;
  nicheName: string;
  clientName: string;
  companyName: string;
  assignedLeads: number;
  availableCredits: number;
  recommended: boolean;
  noCredits: boolean;
}

interface ContactCandidate {
  id: string;
  name: string;
  title: string;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
}

export function LeadValidationList({ initialLeads, templates }: { initialLeads: Lead[]; templates: Template[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<"all" | "discovered" | "validated">("all");
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Smart distribution state
  const [recommendations, setRecommendations] = useState<ClientRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Verify contact state
  const [candidates, setCandidates] = useState<ContactCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Actions ──────────────────────────────────────────────────────

  const validateLead = useCallback(async (id: string) => {
    setActionLoading(id);
    const res = await fetch("/api/admin/validate-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id, action: "validate" }),
    });
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: "validated" } : l));
      if (selectedLead?.id === id) setSelectedLead((prev) => prev ? { ...prev, status: "validated" } : null);
    }
    setActionLoading(null);
  }, [selectedLead]);

  const publishLead = useCallback(async (id: string, clientNicheId: string, contactOverride?: Record<string, unknown>) => {
    setActionLoading(id);
    const res = await fetch("/api/admin/validate-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id, action: "publish", clientNicheId, contactOverride }),
    });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLead(null);
      setRecommendations([]);
    }
    setActionLoading(null);
  }, []);

  const rejectLead = useCallback(async (id: string) => {
    if (!confirm("Reject this lead? It will be archived.")) return;
    setActionLoading(id);
    const res = await fetch("/api/admin/validate-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id, action: "reject" }),
    });
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selectedLead?.id === id) setSelectedLead(null);
    }
    setActionLoading(null);
  }, [selectedLead]);

  // Fetch client recommendations for a lead
  const fetchRecommendations = useCallback(async (templateId: string) => {
    setLoadingRecs(true);
    const res = await fetch(`/api/admin/lead-recommendations?templateId=${templateId}`);
    if (res.ok) {
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    }
    setLoadingRecs(false);
  }, []);

  // Verify contact — search Apollo for alternatives
  const verifyContact = useCallback(async (companyName: string, companyDomain: string | null) => {
    setLoadingCandidates(true);
    setCandidates([]);
    const res = await fetch("/api/admin/verify-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, companyDomain: companyDomain?.replace(/^https?:\/\//, "") }),
    });
    if (res.ok) {
      const data = await res.json();
      setCandidates(data.candidates || []);
    }
    setLoadingCandidates(false);
  }, []);

  // Enrich a candidate and update the lead
  const enrichCandidate = useCallback(async (candidateId: string, leadId: string) => {
    setEnrichingId(candidateId);
    const res = await fetch("/api/admin/verify-contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
    if (res.ok) {
      const data = await res.json();
      const contact = data.contact;
      // Update lead locally
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, ...contact } : l));
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => prev ? { ...prev, ...contact } : null);
      }
      setCandidates([]);
    }
    setEnrichingId(null);
  }, [selectedLead]);

  // ─── Filtering ────────────────────────────────────────────────────

  const nicheNames = [...new Set(leads.map((l) => l.niche_templates?.name || "Unknown"))];

  const filtered = leads
    .filter((l) => filter === "all" || l.status === filter)
    .filter((l) => nicheFilter === "all" || l.niche_templates?.name === nicheFilter)
    .filter((l) => !searchQuery || `${l.company_name} ${l.contact_name} ${l.contact_title} ${l.company_industry}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const isHot = (lead: Lead) => lead.signals_matched?.[0]?.source_url;

  // When selecting a lead, auto-fetch recommendations if it has a template
  const selectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setCandidates([]);
    if (lead.niche_template_id) {
      fetchRecommendations(lead.niche_template_id);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {(["all", "discovered", "validated"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? "bg-primary text-white" : "bg-card border border-border text-muted hover:text-foreground"
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? leads.length : leads.filter(l => l.status === f).length})
            </button>
          ))}
          {nicheNames.length > 1 && (
            <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border border-border bg-card text-foreground">
              <option value="all">All Niches</option>
              {nicheNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary w-48"
            placeholder="Search leads..." />
        </div>
      </div>

      {!filtered.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted">No leads to validate. Run the pipeline to discover new leads.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Lead Cards */}
          <div className={`grid grid-cols-1 ${selectedLead ? "w-1/3" : "md:grid-cols-2 lg:grid-cols-3"} gap-3 transition-all`}>
            {filtered.map((lead) => (
              <div key={lead.id} onClick={() => selectLead(lead)}
                className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedLead?.id === lead.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isHot(lead) ? (
                      <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" /> HOT
                      </span>
                    ) : null}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      lead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{lead.status}</span>
                  </div>
                  <span className="text-[10px] text-muted">
                    {lead.signals_matched?.[0] ? `${Math.round(lead.signals_matched[0].confidence * 100)}%` : ""}
                  </span>
                </div>
                <h3 className="font-semibold text-sm">{lead.company_name}</h3>
                <p className="text-xs text-muted mt-0.5">{lead.contact_name} — {lead.contact_title}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {lead.signals_matched?.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{s.signal_name}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2 text-muted">
                  {lead.contact_email && <Mail className="w-3 h-3 text-success" />}
                  {lead.contact_phone && <Phone className="w-3 h-3 text-success" />}
                  {lead.contact_linkedin && <Linkedin className="w-3 h-3 text-success" />}
                </div>
                {lead.niche_templates && (
                  <p className="text-[10px] text-primary/70 mt-2 font-medium">{lead.niche_templates.name}</p>
                )}
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedLead && (
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)] sticky top-24 space-y-4">

              {/* Header + Actions */}
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isHot(selectedLead) && (
                      <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Flame className="w-3 h-3" /> HOT
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedLead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{selectedLead.status}</span>
                    {selectedLead.niche_templates && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{selectedLead.niche_templates.name}</span>
                    )}
                  </div>
                  <button onClick={() => { setSelectedLead(null); setRecommendations([]); setCandidates([]); }}
                    className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-background">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h2 className="text-xl font-bold">{selectedLead.company_name}</h2>
                <p className="text-sm text-muted mt-1">{selectedLead.contact_name} — {selectedLead.contact_title}</p>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {selectedLead.status === "discovered" && (
                    <button onClick={() => validateLead(selectedLead.id)}
                      disabled={actionLoading === selectedLead.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> Validate
                    </button>
                  )}
                  <button onClick={() => verifyContact(selectedLead.company_name, selectedLead.company_website)}
                    disabled={loadingCandidates}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingCandidates ? "animate-spin" : ""}`} /> Verify Contact
                  </button>
                  <button onClick={() => rejectLead(selectedLead.id)}
                    disabled={actionLoading === selectedLead.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>

              {/* Verify Contact Candidates */}
              {candidates.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Alternative Contacts ({candidates.length})
                  </h4>
                  <div className="space-y-2">
                    {candidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-white dark:bg-background/50 border border-border/30 rounded-lg p-3">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted">{c.title}</p>
                          {(c.city || c.state) && <p className="text-[10px] text-muted">{[c.city, c.state].filter(Boolean).join(", ")}</p>}
                        </div>
                        <button onClick={() => enrichCandidate(c.id, selectedLead.id)}
                          disabled={enrichingId === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-50">
                          {enrichingId === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Use This Contact
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart Client Recommendations (for validated leads) */}
              {selectedLead.status === "validated" && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5" /> Assign to Client
                  </h4>
                  {loadingRecs ? (
                    <p className="text-sm text-muted">Loading recommendations...</p>
                  ) : recommendations.length === 0 ? (
                    <p className="text-sm text-muted">No clients subscribed to this niche yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {recommendations.map((r) => (
                        <div key={r.clientNicheId}
                          className={`flex items-center justify-between rounded-lg p-3 border ${
                            r.noCredits
                              ? "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60"
                              : r.recommended
                                ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800"
                                : "bg-white dark:bg-background/50 border-border/30"
                          }`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{r.companyName}</p>
                              {r.recommended && (
                                <span className="text-[10px] font-semibold bg-green-500 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5" /> RECOMMENDED
                                </span>
                              )}
                              {r.noCredits && (
                                <span className="text-[10px] font-semibold bg-gray-400 text-white px-1.5 py-0.5 rounded-full">NO CREDITS</span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                              {r.assignedLeads} leads assigned · {r.availableCredits} credits available
                            </p>
                          </div>
                          <button
                            onClick={() => publishLead(selectedLead.id, r.clientNicheId)}
                            disabled={r.noCredits || actionLoading === selectedLead.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">
                            <Eye className="w-3 h-3" /> Publish
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Company & Contact */}
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
                          <Linkedin className="w-3.5 h-3.5 shrink-0" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signals */}
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

              {/* Why This Lead */}
              {selectedLead.justification && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Why This Lead</h4>
                  <p className="text-sm leading-relaxed">{selectedLead.justification}</p>
                </div>
              )}

              {/* Strategies */}
              {selectedLead.approach_strategies?.length > 0 && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                    Strategies ({selectedLead.approach_strategies.length})
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

              {/* Emails */}
              {selectedLead.email_templates?.length > 0 && (
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                    Emails ({selectedLead.email_templates.length})
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

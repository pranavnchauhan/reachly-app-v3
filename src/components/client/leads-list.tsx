"use client";
import { authFetch } from "@/lib/auth-fetch";
import { useState, useEffect, useCallback } from "react";
import {
  Eye, Mail, Linkedin, Globe, Phone, Building2, MapPin, Lock,
  ChevronRight, ChevronDown, AlertTriangle, Flame, Send, Copy,
  Check, X, Users, Target, MessageSquare, Sparkles, ExternalLink,
  Clock, Star, DollarSign, MessageCircle, PhoneCall, CalendarCheck,
  ArrowRight, Bookmark,
} from "lucide-react";
import type { MatchedSignal, ApproachStrategy, GeneratedEmail, LeadDisposition, LeadNote, NoteType } from "@/types/database";

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
  disposition?: LeadDisposition;
  disposition_note?: string | null;
  follow_up_date?: string | null;
  deal_value?: number | null;
  lead_rating?: number | null;
}

type TabId = "overview" | "signals" | "strategies" | "emails" | "activity";

const DISPOSITIONS: { value: LeadDisposition; label: string; color: string }[] = [
  { value: "revealed", label: "Revealed", color: "bg-primary/10 text-primary" },
  { value: "contacted", label: "Contacted", color: "bg-accent/10 text-accent" },
  { value: "meeting_booked", label: "Meeting Booked", color: "bg-warning/10 text-warning" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-purple-500/10 text-purple-600" },
  { value: "won", label: "Won", color: "bg-success/10 text-success" },
  { value: "lost", label: "Lost", color: "bg-danger/10 text-danger" },
  { value: "parked", label: "Parked", color: "bg-muted/10 text-muted" },
];

const QUICK_ACTIONS: { type: NoteType; label: string; icon: React.ElementType }[] = [
  { type: "contacted", label: "Contacted", icon: PhoneCall },
  { type: "voicemail", label: "Voicemail", icon: Phone },
  { type: "email_sent", label: "Email Sent", icon: Send },
  { type: "meeting", label: "Meeting", icon: CalendarCheck },
];

const NOTE_ICONS: Record<string, React.ElementType> = {
  note: MessageCircle,
  contacted: PhoneCall,
  voicemail: Phone,
  email_sent: Send,
  meeting: CalendarCheck,
  status_change: ArrowRight,
};

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
        className="w-full flex items-center justify-between p-4 hover:bg-background/50 transition-colors text-left gap-3"
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm block">{title}</span>
          {badge && <span className="text-xs text-primary mt-1 block leading-snug">{badge}</span>}
        </div>
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
        </div>
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
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star === value ? 0 : star)} className="p-0.5">
          <Star className={`w-4 h-4 transition-colors ${star <= value ? "fill-warning text-warning" : "text-border hover:text-warning/50"}`} />
        </button>
      ))}
    </div>
  );
}

function buildMailtoUrl(email: string, template: GeneratedEmail, contactName: string, companyName: string): string {
  const subject = template.subject.replace(/\{\{company\}\}/g, companyName).replace(/\{\{contact_name\}\}/g, contactName);
  const body = template.body.replace(/\{\{company\}\}/g, companyName).replace(/\{\{contact_name\}\}/g, contactName);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
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
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingDisposition, setSavingDisposition] = useState(false);

  const loadNotes = useCallback(async (leadId: string) => {
    const res = await authFetch(`/api/leads/notes?leadId=${leadId}`);
    if (res.ok) {
      const { notes: data } = await res.json();
      setNotes(data || []);
    }
  }, []);

  useEffect(() => {
    if (selectedLead && selectedLead.status !== "published" && activeTab === "activity") {
      loadNotes(selectedLead.id);
    }
  }, [selectedLead, activeTab, loadNotes]);

  async function revealLead(leadId: string) {
    if (credits < 1) return;
    setRevealing(leadId);
    const res = await authFetch("/api/leads/reveal", {
      method: "POST",
      body: JSON.stringify({ leadId }),
    });
    if (res.ok) {
      const { lead } = await res.json();
      const updated = leads.map((l) => l.id === leadId ? { ...l, ...lead, status: "revealed", disposition: "revealed" } : l);
      setLeads(updated);
      setCredits(credits - 1);
      if (selectedLead?.id === leadId) setSelectedLead({ ...selectedLead, ...lead, status: "revealed", disposition: "revealed" });
    }
    setRevealing(null);
  }

  // Map API field names (camelCase) to Lead interface field names (snake_case)
  const API_TO_LEAD_FIELD: Record<string, string> = {
    disposition: "disposition",
    followUpDate: "follow_up_date",
    dealValue: "deal_value",
    leadRating: "lead_rating",
    dispositionNote: "disposition_note",
  };

  async function updateDisposition(apiField: string, value: unknown) {
    if (!selectedLead) return;
    setSavingDisposition(true);

    const body: Record<string, unknown> = { leadId: selectedLead.id, disposition: selectedLead.disposition || "revealed" };
    body[apiField] = value;
    if (apiField === "disposition") body.disposition = value;

    const res = await authFetch("/api/leads/disposition", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const leadField = API_TO_LEAD_FIELD[apiField] || apiField;
      const updatedLead = { ...selectedLead, [leadField]: value };
      if (apiField === "disposition") updatedLead.disposition = value as LeadDisposition;
      setSelectedLead(updatedLead);
      setLeads(leads.map((l) => l.id === selectedLead.id ? updatedLead : l));
      if (apiField === "disposition") loadNotes(selectedLead.id);
    }
    setSavingDisposition(false);
  }

  async function addNote(type: NoteType = "note", content?: string) {
    if (!selectedLead) return;
    const text = content || newNote.trim();
    if (!text) return;

    const res = await authFetch("/api/leads/notes", {
      method: "POST",
      body: JSON.stringify({ leadId: selectedLead.id, type, content: text }),
    });

    if (res.ok) {
      const { note } = await res.json();
      setNotes([note, ...notes]);
      setNewNote("");
    }
  }

  function openLead(lead: Lead) {
    setSelectedLead(lead);
    setActiveTab("overview");
    setNotes([]);
    setNewNote("");
  }

  const published = leads.filter((l) => l.status === "published");
  const revealed = leads.filter((l) => ["revealed", "disputed", "refunded"].includes(l.status));

  const tabs: { id: TabId; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "overview", label: "Overview", icon: Users, show: true },
    { id: "signals", label: "Signals", icon: Target, show: true },
    { id: "strategies", label: "Strategies", icon: Sparkles, show: selectedLead?.status !== "published" },
    { id: "emails", label: "Emails", icon: MessageSquare, show: selectedLead?.status !== "published" },
    { id: "activity", label: "Activity", icon: MessageCircle, show: selectedLead?.status !== "published" },
  ];

  const currentDisposition = DISPOSITIONS.find((d) => d.value === (selectedLead?.disposition || "revealed"));

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
            {revealed.map((lead) => {
              const disp = DISPOSITIONS.find((d) => d.value === (lead.disposition || "revealed"));
              return (
                <div key={lead.id}
                  className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => openLead(lead)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{lead.company_name}</h3>
                    {disp && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${disp.color}`}>{disp.label}</span>}
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{lead.contact_name}</span>
                    <span className="text-muted"> — {lead.contact_title}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    {lead.contact_email && <span className="flex items-center gap-1 text-primary"><Mail className="w-3 h-3" /> Email</span>}
                    {lead.contact_linkedin && <span className="flex items-center gap-1 text-primary"><Linkedin className="w-3 h-3" /> LinkedIn</span>}
                    {lead.contact_phone && <span className="flex items-center gap-1 text-primary"><Phone className="w-3 h-3" /> Phone</span>}
                  </div>
                  {lead.follow_up_date && new Date(lead.follow_up_date) <= new Date() && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
                      <Clock className="w-3 h-3" /> Follow up due
                    </div>
                  )}
                  {lead.lead_rating && lead.lead_rating > 0 && (
                    <div className="flex gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= lead.lead_rating! ? "fill-warning text-warning" : "text-border"}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
                  {currentDisposition && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentDisposition.color}`}>
                      {currentDisposition.label}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedLead(null)} className="w-8 h-8 rounded-lg hover:bg-background flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
              <h2 className="text-xl font-bold">{selectedLead.company_name}</h2>
              {selectedLead.status !== "published" && (
                <p className="text-sm text-muted mt-0.5">{selectedLead.contact_name} — {selectedLead.contact_title}</p>
              )}

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
              <div className="flex gap-1 mt-4 -mb-5 overflow-x-auto">
                {tabs.filter((t) => t.show).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-background border border-border border-b-card text-foreground -mb-px"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.id === "signals" && selectedLead.signals_matched?.length > 0 && (
                      <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{selectedLead.signals_matched.length}</span>
                    )}
                    {tab.id === "activity" && notes.length > 0 && (
                      <span className="text-xs bg-muted/10 text-muted px-1.5 py-0.5 rounded-full">{notes.length}</span>
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
                  {/* Disposition controls (revealed only) */}
                  {selectedLead.status !== "published" && (
                    <div className="bg-background/50 border border-border/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Pipeline Status</h4>
                        {savingDisposition && <span className="text-xs text-muted">Saving...</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {DISPOSITIONS.map((d) => (
                          <button
                            key={d.value}
                            onClick={() => updateDisposition("disposition", d.value)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                              selectedLead.disposition === d.value || (!selectedLead.disposition && d.value === "revealed")
                                ? `${d.color} ring-1 ring-current`
                                : "bg-background border border-border text-muted hover:text-foreground"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Lead Quality</label>
                          <StarRating
                            value={selectedLead.lead_rating || 0}
                            onChange={(v) => updateDisposition("leadRating", v)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Follow-up Date</label>
                          <input
                            type="date"
                            value={selectedLead.follow_up_date || ""}
                            onChange={(e) => updateDisposition("followUpDate", e.target.value || null)}
                            className="w-full px-2 py-1 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                      {(selectedLead.disposition === "won" || selectedLead.disposition === "proposal_sent") && (
                        <div className="mt-3">
                          <label className="text-xs text-muted block mb-1">Deal Value ($)</label>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-muted" />
                            <input
                              type="number"
                              placeholder="0"
                              value={selectedLead.deal_value || ""}
                              onChange={(e) => updateDisposition("dealValue", e.target.value ? Number(e.target.value) : null)}
                              className="w-32 px-2 py-1 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                        <div className="flex items-center gap-2 text-sm text-muted"><Building2 className="w-4 h-4" /> {selectedLead.company_industry}</div>
                      )}
                      {selectedLead.company_size && (
                        <div className="flex items-center gap-2 text-sm text-muted"><Users className="w-4 h-4" /> {selectedLead.company_size} employees</div>
                      )}
                      {selectedLead.company_location && (
                        <div className="flex items-center gap-2 text-sm text-muted"><MapPin className="w-4 h-4" /> {selectedLead.company_location}</div>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
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

                  {selectedLead.status !== "published" && selectedLead.contact_summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Background</h4>
                      <p className="text-sm text-muted leading-relaxed">{selectedLead.contact_summary}</p>
                    </div>
                  )}

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
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Why This Lead</h4>
                    <p className="text-sm leading-relaxed">{selectedLead.justification}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Buying Signals</h4>
                    <div className="space-y-3">
                      {selectedLead.signals_matched?.map((s, i) => (
                        <div key={i} className="bg-background/50 border border-border/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-sm">{s.signal_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              s.confidence >= 0.8 ? "bg-success/10 text-success" : s.confidence >= 0.5 ? "bg-warning/10 text-warning" : "bg-muted/10 text-muted"
                            }`}>{Math.round(s.confidence * 100)}%</span>
                          </div>
                          <p className="text-sm text-muted">{s.evidence}</p>
                          {s.source_url && (
                            <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
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
                  ) : <p className="text-sm text-muted">No strategies generated for this lead.</p>}
                </div>
              )}

              {/* ─── TAB: Emails ─── */}
              {activeTab === "emails" && selectedLead.status !== "published" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Email Templates</h4>
                  {selectedLead.email_templates?.length > 0 ? (
                    selectedLead.email_templates.map((e, i) => {
                      const resolvedSubject = e.subject.replace(/\{\{company\}\}/g, selectedLead.company_name).replace(/\{\{contact_name\}\}/g, selectedLead.contact_name);
                      const resolvedBody = e.body.replace(/\{\{company\}\}/g, selectedLead.company_name).replace(/\{\{contact_name\}\}/g, selectedLead.contact_name);
                      return (
                        <Collapsible key={i} title={resolvedSubject} badge={e.approach} defaultOpen={i === 0}>
                          <div className="mt-3 bg-card/50 rounded-lg p-4 border border-border/20">
                            <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{resolvedBody}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            {selectedLead.contact_email && (
                              <a href={buildMailtoUrl(selectedLead.contact_email, e, selectedLead.contact_name, selectedLead.company_name)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
                                <Send className="w-3.5 h-3.5" /> Send this email
                              </a>
                            )}
                            <CopyButton text={`Subject: ${resolvedSubject}\n\n${resolvedBody}`} />
                          </div>
                        </Collapsible>
                      );
                    })
                  ) : <p className="text-sm text-muted">No email templates generated for this lead.</p>}
                </div>
              )}

              {/* ─── TAB: Activity ─── */}
              {activeTab === "activity" && selectedLead.status !== "published" && (
                <div className="space-y-4">
                  {/* Quick actions */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Quick Log</h4>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.type}
                          onClick={() => addNote(action.type, `${action.label} — ${selectedLead.contact_name} at ${selectedLead.company_name}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                        >
                          <action.icon className="w-3.5 h-3.5" /> {action.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add note */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Add Note</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addNote()}
                        placeholder="Called Shannon, she's interested but..."
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => addNote()}
                        disabled={!newNote.trim()}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Notes timeline */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                      Timeline {notes.length > 0 && `(${notes.length})`}
                    </h4>
                    {notes.length === 0 ? (
                      <div className="text-center py-8">
                        <Bookmark className="w-8 h-8 text-muted mx-auto mb-2" />
                        <p className="text-sm text-muted">No activity yet. Use the quick actions above or add a note.</p>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {notes.map((note, i) => {
                          const Icon = NOTE_ICONS[note.type] || MessageCircle;
                          return (
                            <div key={note.id} className="flex gap-3 relative">
                              {/* Timeline line */}
                              {i < notes.length - 1 && (
                                <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />
                              )}
                              <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center flex-shrink-0 z-10">
                                <Icon className="w-3.5 h-3.5 text-muted" />
                              </div>
                              <div className="flex-1 pb-4">
                                <p className="text-sm">{note.content}</p>
                                <p className="text-xs text-muted mt-0.5">{formatRelativeTime(note.created_at)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {selectedLead.status === "revealed" && (
              <div className="p-4 border-t border-border flex-shrink-0 flex items-center justify-between">
                <a href={`/dashboard/disputes?lead=${selectedLead.id}`}
                  className="flex items-center gap-1.5 text-sm text-warning hover:underline">
                  <AlertTriangle className="w-3.5 h-3.5" /> Dispute
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

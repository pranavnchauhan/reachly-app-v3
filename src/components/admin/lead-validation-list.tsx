"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, X, Eye, ChevronDown, ChevronUp } from "lucide-react";
import type { MatchedSignal } from "@/types/database";

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
  contact_linkedin: string | null;
  signals_matched: MatchedSignal[];
  justification: string;
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
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{lead.company_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      lead.status === "discovered" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}>{lead.status}</span>
                  </div>
                  <p className="text-sm text-muted mt-1">
                    {lead.contact_name} — {lead.contact_title} | {lead.company_industry}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.status === "discovered" && (
                    <button onClick={() => updateLeadStatus(lead.id, "validated")}
                      className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20" title="Validate">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {lead.status === "validated" && (
                    <button onClick={() => updateLeadStatus(lead.id, "published")}
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20" title="Publish">
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => rejectLead(lead.id)}
                    className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger/20" title="Reject">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                    className="p-2 rounded-lg hover:bg-background text-muted">
                    {expandedId === lead.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === lead.id && (
                <div className="border-t border-border p-4 bg-background/50 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Justification</h4>
                    <p className="text-sm text-muted">{lead.justification || "No justification provided"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Signals Matched</h4>
                    <div className="flex flex-wrap gap-2">
                      {lead.signals_matched?.map((s, i) => (
                        <span key={i} className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                          {s.signal_name} ({Math.round(s.confidence * 100)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted">Email:</span> {lead.contact_email || "—"}
                    </div>
                    <div>
                      <span className="text-muted">LinkedIn:</span>{" "}
                      {lead.contact_linkedin ? (
                        <a href={lead.contact_linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Profile</a>
                      ) : "—"}
                    </div>
                    <div>
                      <span className="text-muted">Website:</span>{" "}
                      {lead.company_website ? (
                        <a href={lead.company_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{lead.company_website}</a>
                      ) : "—"}
                    </div>
                    <div>
                      <span className="text-muted">Size:</span> {lead.company_size || "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

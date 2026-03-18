"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import type { Signal } from "@/types/database";

interface Template {
  id: string;
  name: string;
  signals: Signal[];
  industries: string[];
}

interface ClientNiche {
  id: string;
  name: string;
  is_active: boolean;
  geography: string[];
  enabled_signals: string[];
  excluded_companies: string[];
  niche_templates: { name: string } | null;
}

export function AssignNiche({
  clientId,
  templates,
  existingNiches,
  companyId,
}: {
  clientId: string;
  companyId?: string;
  templates: Template[];
  existingNiches: ClientNiche[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [nicheName, setNicheName] = useState("");
  const [geography, setGeography] = useState("Australia");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setLoading(true);
    setError("");

    const template = templates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    // Enable all signals by default
    const allSignalIds = (template.signals || []).map((s: Signal) => s.id);

    const res = await fetch("/api/admin/assign-niche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || null,
        companyId: companyId || null,
        templateId: selectedTemplate,
        name: nicheName || template.name,
        geography: geography.split(",").map((g) => g.trim()).filter(Boolean),
        enabledSignals: allSignalIds,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setSelectedTemplate("");
      setNicheName("");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to assign niche");
    }
    setLoading(false);
  }

  return (
    <div>
      {/* Existing niches */}
      {existingNiches.length > 0 && (
        <div className="space-y-3 mb-4">
          {existingNiches.map((niche) => (
            <div key={niche.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{niche.name}</p>
                  <p className="text-xs text-muted">
                    Template: {niche.niche_templates?.name ?? "—"} |
                    {" "}{niche.enabled_signals?.length ?? 0} signals |
                    {" "}{niche.geography?.join(", ") || "No geography"}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${niche.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
                {niche.is_active ? "Active" : "Paused"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" />
          Assign Niche
        </button>
      ) : (
        <form onSubmit={handleAssign} className="border border-border rounded-lg p-4 space-y-4">
          {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1.5">Niche Template</label>
            <select value={selectedTemplate} onChange={(e) => {
              setSelectedTemplate(e.target.value);
              const t = templates.find((t) => t.id === e.target.value);
              if (t) setNicheName(t.name);
            }} required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Niche Name (for this client)</label>
            <input value={nicheName} onChange={(e) => setNicheName(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Operational Transformation — Melbourne" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Geography (comma-separated)</label>
            <input value={geography} onChange={(e) => setGeography(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Australia, Melbourne, Sydney" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
              {loading ? "Assigning..." : "Assign Niche"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-background transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

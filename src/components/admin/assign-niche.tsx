"use client";

import { useState } from "react";
import {
  Plus, Target, Trash2, Edit3, Check, X, ChevronDown, ChevronRight,
  Pause, Play,
} from "lucide-react";
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
  template_id: string;
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
  const [niches, setNiches] = useState<ClientNiche[]>(existingNiches);
  const [showForm, setShowForm] = useState(false);
  const [editingNiche, setEditingNiche] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [nicheName, setNicheName] = useState("");
  const [geography, setGeography] = useState("Australia");
  const [enabledSignals, setEnabledSignals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedNiche, setExpandedNiche] = useState<string | null>(null);

  function getTemplateSignals(templateId: string): Signal[] {
    return templates.find((t) => t.id === templateId)?.signals || [];
  }

  function startEdit(niche: ClientNiche) {
    setEditingNiche(niche.id);
    setNicheName(niche.name);
    setGeography(niche.geography?.join(", ") || "Australia");
    setEnabledSignals(niche.enabled_signals || []);
    setSelectedTemplate(niche.template_id);
  }

  function cancelEdit() {
    setEditingNiche(null);
    setNicheName("");
    setGeography("Australia");
    setEnabledSignals([]);
  }

  function startAssign() {
    setShowForm(true);
    setEditingNiche(null);
    setSelectedTemplate("");
    setNicheName("");
    setGeography("Australia");
    setEnabledSignals([]);
  }

  function onTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
    const t = templates.find((t) => t.id === templateId);
    if (t) {
      setNicheName(t.name);
      setEnabledSignals(t.signals.map((s) => s.id));
    }
  }

  function toggleSignal(signalId: string) {
    setEnabledSignals((prev) =>
      prev.includes(signalId) ? prev.filter((s) => s !== signalId) : [...prev, signalId]
    );
  }

  function toggleAll(templateId: string) {
    const allIds = getTemplateSignals(templateId).map((s) => s.id);
    if (allIds.every((id) => enabledSignals.includes(id))) {
      setEnabledSignals([]);
    } else {
      setEnabledSignals(allIds);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/assign-niche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || null,
        companyId: companyId || null,
        templateId: selectedTemplate,
        name: nicheName || templates.find((t) => t.id === selectedTemplate)?.name,
        geography: geography.split(",").map((g) => g.trim()).filter(Boolean),
        enabledSignals,
      }),
    });

    if (res.ok) {
      const { niche } = await res.json();
      const template = templates.find((t) => t.id === selectedTemplate);
      setNiches([...niches, { ...niche, niche_templates: template ? { name: template.name } : null }]);
      setShowForm(false);
      setSelectedTemplate("");
      setNicheName("");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to assign niche");
    }
    setLoading(false);
  }

  async function handleUpdate(nicheId: string) {
    setLoading(true);
    const res = await fetch("/api/admin/assign-niche", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nicheId,
        name: nicheName,
        geography: geography.split(",").map((g) => g.trim()).filter(Boolean),
        enabledSignals,
      }),
    });

    if (res.ok) {
      setNiches(niches.map((n) => n.id === nicheId
        ? { ...n, name: nicheName, geography: geography.split(",").map((g) => g.trim()).filter(Boolean), enabled_signals: enabledSignals }
        : n
      ));
      setEditingNiche(null);
    }
    setLoading(false);
  }

  async function handleRemove(nicheId: string, nicheName: string) {
    if (!confirm(`Remove "${nicheName}" from this client? The master template stays intact. Leads already generated will remain.`)) return;

    // Optimistic remove
    const prev = niches;
    setNiches(niches.filter((n) => n.id !== nicheId));

    const res = await fetch("/api/admin/assign-niche", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nicheId }),
    });

    if (!res.ok) {
      // Revert on failure
      setNiches(prev);
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to remove niche");
    }
  }

  async function handleToggleActive(nicheId: string, currentActive: boolean) {
    // Optimistic update
    setNiches(niches.map((n) => n.id === nicheId ? { ...n, is_active: !currentActive } : n));

    await fetch("/api/admin/assign-niche", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nicheId, isActive: !currentActive }),
    });
  }

  return (
    <div>
      {/* Existing niches */}
      {niches.length > 0 && (
        <div className="space-y-3 mb-4">
          {niches.map((niche) => {
            const isEditing = editingNiche === niche.id;
            const isExpanded = expandedNiche === niche.id;
            const templateSignals = getTemplateSignals(niche.template_id);

            if (isEditing) {
              return (
                <div key={niche.id} className="border border-primary/30 rounded-xl p-4 space-y-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Edit Niche</h3>
                    <button onClick={cancelEdit} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1">Niche Name</label>
                    <input value={nicheName} onChange={(e) => setNicheName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1">Geography</label>
                    <input value={geography} onChange={(e) => setGeography(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>

                  {templateSignals.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-muted">Signals ({enabledSignals.length}/{templateSignals.length})</label>
                        <button type="button" onClick={() => toggleAll(niche.template_id)} className="text-xs text-primary hover:underline">
                          {templateSignals.every((s) => enabledSignals.includes(s.id)) ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                        {templateSignals.map((signal) => (
                          <label key={signal.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-background/50 rounded-lg p-1.5">
                            <input type="checkbox" checked={enabledSignals.includes(signal.id)}
                              onChange={() => toggleSignal(signal.id)}
                              className="mt-0.5 rounded border-border" />
                            <div>
                              <span className="font-medium">{signal.name}</span>
                              {signal.description && <p className="text-xs text-muted">{signal.description}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(niche.id)} disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={cancelEdit} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background">Cancel</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={niche.id} className="border border-border/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 hover:bg-background/50 transition-colors">
                  <button onClick={() => setExpandedNiche(isExpanded ? null : niche.id)} className="flex items-center gap-3 flex-1 text-left">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                    <Target className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{niche.name}</p>
                      <p className="text-xs text-muted">
                        Template: {niche.niche_templates?.name ?? "—"} | {niche.enabled_signals?.length ?? 0} signals | {niche.geography?.join(", ") || "No geography"}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${niche.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
                      {niche.is_active ? "Active" : "Paused"}
                    </span>
                    <button onClick={() => handleToggleActive(niche.id, niche.is_active)} title={niche.is_active ? "Pause" : "Activate"}
                      className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground">
                      {niche.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => startEdit(niche)} title="Edit signals"
                      className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRemove(niche.id, niche.name)} title="Remove niche"
                      className="p-1.5 rounded-lg hover:bg-danger/10 transition-colors text-muted hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && templateSignals.length > 0 && (
                  <div className="px-4 pb-3 border-t border-border/30">
                    <p className="text-xs text-muted uppercase tracking-wider mt-3 mb-2">Enabled Signals ({niche.enabled_signals?.length || 0}/{templateSignals.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templateSignals.map((signal) => {
                        const enabled = niche.enabled_signals?.includes(signal.id);
                        return (
                          <span key={signal.id} className={`text-xs px-2 py-1 rounded-full ${enabled ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted line-through"}`}>
                            {signal.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign new niche form */}
      {!showForm ? (
        <button onClick={startAssign}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="w-4 h-4" /> Assign Niche
        </button>
      ) : (
        <form onSubmit={handleAssign} className="border border-border rounded-xl p-4 space-y-4">
          {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1.5">Niche Template</label>
            <select value={selectedTemplate} onChange={(e) => onTemplateSelect(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.signals?.length || 0} signals)</option>
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

          {/* Signal selection */}
          {selectedTemplate && getTemplateSignals(selectedTemplate).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Signals ({enabledSignals.length}/{getTemplateSignals(selectedTemplate).length})</label>
                <button type="button" onClick={() => toggleAll(selectedTemplate)} className="text-xs text-primary hover:underline">
                  {getTemplateSignals(selectedTemplate).every((s) => enabledSignals.includes(s.id)) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                {getTemplateSignals(selectedTemplate).map((signal) => (
                  <label key={signal.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-background/50 rounded-lg p-1.5">
                    <input type="checkbox" checked={enabledSignals.includes(signal.id)}
                      onChange={() => toggleSignal(signal.id)}
                      className="mt-0.5 rounded border-border" />
                    <div>
                      <span className="font-medium">{signal.name}</span>
                      {signal.description && <p className="text-xs text-muted">{signal.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={loading || enabledSignals.length === 0}
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

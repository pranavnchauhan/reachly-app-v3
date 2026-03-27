"use client";

import { useState } from "react";
import {
  Target, Briefcase, Tag, TrendingUp, Save, Plus, X, Trash2,
  Users, Building2, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import type { Signal } from "@/types/database";

interface Template {
  id: string;
  name: string;
  description: string;
  industries: string[];
  keywords: string[];
  signals: Signal[];
  target_titles: string[];
  employee_min: number;
  employee_max: number;
  is_active: boolean;
}

interface ClientNicheInfo {
  id: string;
  name: string;
  is_active: boolean;
  enabled_signals: string[];
  client_id: string | null;
  company_id: string | null;
  profiles: unknown;
  companies: unknown;
}

function TagInput({ values, onChange, placeholder }: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={placeholder} />
        <button type="button" onClick={add} className="px-2 py-1.5 bg-primary text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

const SIGNAL_CATEGORIES = ["pain_point", "growth", "expansion", "hiring", "technology"];

export function NicheEditor({ template, clientNiches }: {
  template: Template;
  clientNiches: ClientNicheInfo[];
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [industries, setIndustries] = useState(template.industries || []);
  const [keywords, setKeywords] = useState(template.keywords || []);
  const [targetTitles, setTargetTitles] = useState(template.target_titles || []);
  const [employeeMin, setEmployeeMin] = useState(template.employee_min);
  const [employeeMax, setEmployeeMax] = useState(template.employee_max);
  const [signals, setSignals] = useState<Signal[]>(template.signals || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // New signal form
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [newSignalName, setNewSignalName] = useState("");
  const [newSignalDesc, setNewSignalDesc] = useState("");
  const [newSignalCategory, setNewSignalCategory] = useState("pain_point");
  const [newSignalWeight, setNewSignalWeight] = useState(5);

  // Expandable sections
  const [expandedSection, setExpandedSection] = useState<string | null>("targeting");

  function addSignal() {
    if (!newSignalName.trim()) return;
    const newSignal: Signal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newSignalName.trim(),
      description: newSignalDesc.trim(),
      category: newSignalCategory,
      weight: newSignalWeight,
    };
    setSignals([...signals, newSignal]);
    setNewSignalName("");
    setNewSignalDesc("");
    setNewSignalWeight(5);
    setShowAddSignal(false);
  }

  function removeSignal(signalId: string) {
    setSignals(signals.filter((s) => s.id !== signalId));
  }

  function updateSignalWeight(signalId: string, weight: number) {
    setSignals(signals.map((s) => s.id === signalId ? { ...s, weight } : s));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/admin/update-niche-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: template.id,
        name,
        description,
        industries,
        keywords,
        target_titles: targetTitles,
        employee_min: employeeMin,
        employee_max: employeeMax,
        signals,
      }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function Section({ id, title, icon: Icon, count, children }: {
    id: string; title: string; icon: React.ElementType; count?: number; children: React.ReactNode;
  }) {
    const isOpen = expandedSection === id;
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        <button onClick={() => setExpandedSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between p-5 hover:bg-background/50 transition-colors text-left">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{title}</h2>
            {count !== undefined && <span className="text-xs bg-muted/10 text-muted px-2 py-0.5 rounded-full">{count}</span>}
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
        </button>
        {isOpen && <div className="px-5 pb-5 border-t border-border/30">{children}</div>}
      </div>
    );
  }

  const activeAssignments = clientNiches.filter((n) => n.client_id || n.company_id);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 mr-4">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0"
            placeholder="Niche name" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="text-muted text-sm mt-1 bg-transparent border-none focus:outline-none focus:ring-0 w-full p-0 resize-none"
            placeholder="Description..." />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saved && <span className="text-xs text-success">Saved!</span>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Targeting */}
      <Section id="targeting" title="Targeting" icon={Briefcase} count={industries.length + keywords.length}>
        <div className="grid grid-cols-2 gap-6 mt-3">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">Industries</label>
            <TagInput values={industries} onChange={setIndustries} placeholder="Add industry..." />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">Keywords</label>
            <TagInput values={keywords} onChange={setKeywords} placeholder="Add keyword..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-border/30">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">Target Titles</label>
            <TagInput values={targetTitles} onChange={setTargetTitles} placeholder="Add title..." />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider block mb-2">Employee Range</label>
            <div className="flex items-center gap-2">
              <input type="number" value={employeeMin} onChange={(e) => setEmployeeMin(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <span className="text-muted">–</span>
              <input type="number" value={employeeMax} onChange={(e) => setEmployeeMax(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </div>
      </Section>

      {/* Signals */}
      <Section id="signals" title="Buying Signals" icon={TrendingUp} count={signals.length}>
        <div className="space-y-2 mt-3">
          {signals.map((signal) => (
            <div key={signal.id} className="flex items-start justify-between p-3 bg-background rounded-lg group">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{signal.name}</h4>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{signal.category}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">{signal.description}</p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <div className="text-right">
                  <span className="text-[10px] text-muted">Weight</span>
                  <select value={signal.weight} onChange={(e) => updateSignalWeight(signal.id, Number(e.target.value))}
                    className="block w-16 px-1 py-0.5 text-sm rounded border border-border bg-background text-center">
                    {[1,2,3,4,5,6,7,8,9,10].map((w) => <option key={w} value={w}>{w}/10</option>)}
                  </select>
                </div>
                <button onClick={() => removeSignal(signal.id)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 text-muted hover:text-danger transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddSignal ? (
          <div className="mt-3 border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Signal Name</label>
                <input value={newSignalName} onChange={(e) => setNewSignalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Leadership Change" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Category</label>
                  <select value={newSignalCategory} onChange={(e) => setNewSignalCategory(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-border bg-background text-sm">
                    {SIGNAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Weight</label>
                  <select value={newSignalWeight} onChange={(e) => setNewSignalWeight(Number(e.target.value))}
                    className="w-full px-2 py-2 rounded-lg border border-border bg-background text-sm">
                    {[1,2,3,4,5,6,7,8,9,10].map((w) => <option key={w} value={w}>{w}/10</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Description</label>
              <input value={newSignalDesc} onChange={(e) => setNewSignalDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="What to look for..." />
            </div>
            <div className="flex gap-2">
              <button onClick={addSignal} disabled={!newSignalName.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50">
                Add Signal
              </button>
              <button onClick={() => setShowAddSignal(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddSignal(true)}
            className="mt-3 flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted hover:text-foreground hover:border-primary/30 transition-colors">
            <Plus className="w-4 h-4" /> Add Signal
          </button>
        )}
      </Section>

      {/* Email Templates Note */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-sm">Email Templates</h2>
            <p className="text-sm text-muted mt-1">
              Email templates are auto-generated by AI for each lead based on the specific buying signals detected
              and the contact&apos;s background. They&apos;re personalised per lead, not per template.
              You&apos;ll find them in each lead&apos;s detail view under the Emails tab.
            </p>
          </div>
        </div>
      </div>

      {/* Client Assignments */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Assigned to {activeAssignments.length} Client{activeAssignments.length !== 1 ? "s" : ""}</h2>
        </div>
        {activeAssignments.length === 0 ? (
          <p className="text-sm text-muted">No clients assigned to this template yet. Assign via the client detail page.</p>
        ) : (
          <div className="space-y-2">
            {activeAssignments.map((niche) => (
              <div key={niche.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted" />
                  <div>
                    <p className="text-sm font-medium">{niche.name}</p>
                    <p className="text-xs text-muted">
                      {(Array.isArray(niche.companies) ? (niche.companies[0] as { company_name: string })?.company_name : (niche.companies as { company_name: string } | null)?.company_name) ||
                       (Array.isArray(niche.profiles) ? (niche.profiles[0] as { full_name: string })?.full_name : (niche.profiles as { full_name: string } | null)?.full_name) || "Unknown"}
                      {" · "}{niche.enabled_signals?.length || 0}/{signals.length} signals enabled
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
      </div>
    </div>
  );
}

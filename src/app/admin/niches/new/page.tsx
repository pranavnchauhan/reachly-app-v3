"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import type { Signal, EmailTemplate } from "@/types/database";

export default function NewNicheTemplatePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [industryInput, setIndustryInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [employeeMin, setEmployeeMin] = useState(10);
  const [employeeMax, setEmployeeMax] = useState(500);
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

  function addTag(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput("");
    }
  }

  function removeTag(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  function addSignal() {
    setSignals([...signals, {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      category: "growth",
      weight: 5,
    }]);
  }

  function updateSignal(index: number, field: keyof Signal, value: string | number) {
    const updated = [...signals];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setSignals(updated);
  }

  function removeSignal(index: number) {
    setSignals(signals.filter((_, i) => i !== index));
  }

  function addEmailTemplate() {
    setEmailTemplates([...emailTemplates, {
      approach: "",
      subject: "",
      body: "",
    }]);
  }

  function updateEmailTemplate(index: number, field: keyof EmailTemplate, value: string) {
    const updated = [...emailTemplates];
    (updated[index] as unknown as Record<string, string>)[field] = value;
    setEmailTemplates(updated);
  }

  function removeEmailTemplate(index: number) {
    setEmailTemplates(emailTemplates.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    const { error } = await supabase.from("niche_templates").insert({
      name,
      description,
      industries,
      keywords,
      employee_min: employeeMin,
      employee_max: employeeMax,
      target_titles: targetTitles,
      signals,
      email_templates: emailTemplates,
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/admin/niches");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <Link href="/admin/niches" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Templates
      </Link>

      <h1 className="text-2xl font-bold mb-6">New Niche Template</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

        {/* Basic Info */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Template Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Operational Transformation" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Brief description of this niche..." />
          </div>
        </div>

        {/* Targeting */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Targeting</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">Industries</label>
            <div className="flex gap-2">
              <input value={industryInput} onChange={(e) => setIndustryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(industries, setIndustries, industryInput, setIndustryInput); } }}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Add industry and press Enter" />
              <button type="button" onClick={() => addTag(industries, setIndustries, industryInput, setIndustryInput)}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {industries.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-primary-light text-primary px-2 py-1 rounded-full">
                  {tag} <button type="button" onClick={() => removeTag(industries, setIndustries, i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Keywords</label>
            <div className="flex gap-2">
              <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(keywords, setKeywords, keywordInput, setKeywordInput); } }}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="Add keyword and press Enter" />
              <button type="button" onClick={() => addTag(keywords, setKeywords, keywordInput, setKeywordInput)}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {keywords.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                  {tag} <button type="button" onClick={() => removeTag(keywords, setKeywords, i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Min Employees</label>
              <input type="number" value={employeeMin} onChange={(e) => setEmployeeMin(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Max Employees</label>
              <input type="number" value={employeeMax} onChange={(e) => setEmployeeMax(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Target Titles</label>
            <div className="flex gap-2">
              <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(targetTitles, setTargetTitles, titleInput, setTitleInput); } }}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                placeholder="e.g. CEO, COO, Operations Director" />
              <button type="button" onClick={() => addTag(targetTitles, setTargetTitles, titleInput, setTitleInput)}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {targetTitles.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                  {tag} <button type="button" onClick={() => removeTag(targetTitles, setTargetTitles, i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Signals */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Buying Signals</h2>
            <button type="button" onClick={addSignal}
              className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Add Signal
            </button>
          </div>

          {signals.map((signal, i) => (
            <div key={signal.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Signal {i + 1}</span>
                <button type="button" onClick={() => removeSignal(i)} className="text-danger hover:text-danger/80">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={signal.name} onChange={(e) => updateSignal(i, "name", e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Signal name" />
                <select value={signal.category} onChange={(e) => updateSignal(i, "category", e.target.value)}
                  className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="growth">Growth</option>
                  <option value="hiring">Hiring</option>
                  <option value="technology">Technology</option>
                  <option value="funding">Funding</option>
                  <option value="pain_point">Pain Point</option>
                  <option value="expansion">Expansion</option>
                </select>
              </div>
              <textarea value={signal.description} onChange={(e) => updateSignal(i, "description", e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="How to detect this signal..." />
              <div>
                <label className="text-xs text-muted">Weight (1-10)</label>
                <input type="number" min={1} max={10} value={signal.weight}
                  onChange={(e) => updateSignal(i, "weight", Number(e.target.value))}
                  className="ml-2 w-16 px-2 py-1 rounded border border-border bg-background text-sm" />
              </div>
            </div>
          ))}

          {!signals.length && <p className="text-sm text-muted">No signals added yet. Add buying signals to define what triggers lead discovery.</p>}
        </div>

        {/* Email Templates */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Email Templates</h2>
            <button type="button" onClick={addEmailTemplate}
              className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Add Template
            </button>
          </div>

          {emailTemplates.map((tmpl, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Template {i + 1}</span>
                <button type="button" onClick={() => removeEmailTemplate(i)} className="text-danger hover:text-danger/80">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input value={tmpl.approach} onChange={(e) => updateEmailTemplate(i, "approach", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Approach name (e.g. Direct Value Prop)" />
              <input value={tmpl.subject} onChange={(e) => updateEmailTemplate(i, "subject", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Email subject line" />
              <textarea value={tmpl.body} onChange={(e) => updateEmailTemplate(i, "body", e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Email body (use {{company}}, {{contact_name}}, {{signal}} as variables)" />
            </div>
          ))}

          {!emailTemplates.length && <p className="text-sm text-muted">No templates added yet. Add outreach email templates for each approach strategy.</p>}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
            {loading ? "Creating..." : "Create Template"}
          </button>
          <Link href="/admin/niches"
            className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

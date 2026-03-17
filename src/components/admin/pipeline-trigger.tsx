"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Play, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Niche {
  id: string;
  name: string;
}

export function PipelineTrigger({ niches }: { niches: Niche[] }) {
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const supabase = createClient();

  async function runPipeline() {
    setRunning(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult({ success: false, message: "Not authenticated" });
        setRunning(false);
        return;
      }

      const body: Record<string, string> = {};
      if (selectedNiche !== "all") {
        body.nicheId = selectedNiche;
      }

      const response = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        setResult({
          success: false,
          message: `Server error (likely timeout). Response: ${responseText.slice(0, 200)}`,
        });
        setRunning(false);
        return;
      }

      if (response.ok) {
        const totalLeads = data.results?.reduce(
          (sum: number, r: Record<string, number>) => sum + (r.leads || 0),
          0
        ) ?? 0;
        const stepDetails = data.results?.map(
          (r: Record<string, unknown>) => {
            const parts = [`${r.niche}`];
            if (r.companies !== undefined) parts.push(`${r.companies} companies sourced`);
            if (r.signals !== undefined) parts.push(`${r.signals} with signals`);
            if (r.enriched !== undefined) parts.push(`${r.enriched} enriched`);
            parts.push(`${r.leads ?? 0} leads`);
            if (r.detail) parts.push(`(${r.detail})`);
            if (r.step) parts.push(`[stopped at: ${r.step}]`);
            return parts.join(" → ");
          }
        ).join("\n") ?? "";

        setResult({
          success: totalLeads > 0,
          message: `Pipeline complete. ${totalLeads} leads discovered.\n${stepDetails}`,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Pipeline failed",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${String(error)}`,
      });
    }

    setRunning(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Run Pipeline</h2>
      <p className="text-sm text-muted mb-4">
        Manually trigger the lead discovery pipeline. This sources companies,
        detects signals, enriches contacts, and generates outreach materials.
      </p>

      <div className="flex items-center gap-3">
        <select
          value={selectedNiche}
          onChange={(e) => setSelectedNiche(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={running}
        >
          <option value="all">All Active Niches</option>
          {niches.map((niche) => (
            <option key={niche.id} value={niche.id}>
              {niche.name}
            </option>
          ))}
        </select>

        <button
          onClick={runPipeline}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Now
            </>
          )}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 flex items-start gap-2 p-3 rounded-lg text-sm ${
            result.success
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {result.success ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span className="whitespace-pre-wrap">{result.message}</span>
        </div>
      )}
    </div>
  );
}

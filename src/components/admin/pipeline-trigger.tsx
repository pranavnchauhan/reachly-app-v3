"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Play, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Niche {
  id: string;
  name: string;
}

interface PipelineProgress {
  niche?: string;
  step?: string;
  hot?: number;
  cold?: number;
  enriched?: number;
  researched?: number;
}

interface PipelineRun {
  id: string;
  status: "running" | "completed" | "failed";
  current_step: string;
  progress: PipelineProgress;
  result?: {
    batch_id: string;
    results: Array<{
      niche: string;
      hot?: number;
      cold?: number;
      enriched?: number;
      researched?: number;
      leads?: number;
      detail?: string;
      step?: string;
    }>;
  };
  error?: string;
}

const STEP_LABELS: Record<string, string> = {
  starting: "Starting pipeline...",
  loading_niches: "Loading niche configuration...",
  discovering: "Searching news for buying signals...",
  apollo_fallback: "Finding additional companies via Apollo...",
  enriching: "Finding decision-maker contacts...",
  researching: "AI-researching top leads...",
  saving: "Saving leads to database...",
  done: "Pipeline complete!",
};

export function PipelineTrigger({ niches }: { niches: Niche[] }) {
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [runData, setRunData] = useState<PipelineRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(async (runId: string, token: string) => {
    try {
      const res = await fetch(`/api/pipeline/status/${runId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data: PipelineRun = await res.json();
      setRunData(data);

      if (data.status === "completed" || data.status === "failed") {
        stopPolling();
        setRunning(false);
        if (data.status === "completed") {
          const totalLeads = data.result?.results?.reduce((sum, r) => sum + (r.leads || 0), 0) ?? 0;
          if (totalLeads > 0) {
            setTimeout(() => window.location.reload(), 1500);
          }
        }
      }
    } catch {
      // Ignore poll errors — will retry
    }
  }, [stopPolling]);

  async function runPipeline() {
    setRunning(true);
    setRunData(null);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
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

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.run_id) {
        setError(data?.error || "Failed to start pipeline");
        setRunning(false);
        return;
      }

      // Start polling
      setRunData({ id: data.run_id, status: "running", current_step: "starting", progress: {} });
      const token = session.access_token;
      pollRef.current = setInterval(() => pollStatus(data.run_id, token), 3000);
    } catch (err) {
      setError(`Error: ${String(err)}`);
      setRunning(false);
    }
  }

  const currentStep = runData?.current_step || "";
  const stepLabel = runData?.progress?.step || STEP_LABELS[currentStep] || currentStep;
  const isComplete = runData?.status === "completed";
  const isFailed = runData?.status === "failed";

  function renderResults() {
    if (!runData?.result?.results) return null;
    const totalLeads = runData.result.results.reduce((sum, r) => sum + (r.leads || 0), 0);

    return (
      <div className="mt-3 space-y-1">
        {runData.result.results.map((r, i) => {
          const parts = [r.niche];
          if (r.hot !== undefined || r.cold !== undefined) parts.push(`🔥 ${r.hot ?? 0} hot + 🧊 ${r.cold ?? 0} cold`);
          if (r.enriched !== undefined) parts.push(`${r.enriched} enriched`);
          if (r.researched !== undefined) parts.push(`${r.researched} researched`);
          parts.push(`${r.leads ?? 0} leads`);
          if (r.detail) parts.push(`(${r.detail})`);
          return <div key={i} className="text-xs text-muted">{parts.join(" → ")}</div>;
        })}
        <div className="text-sm font-medium mt-2">
          {totalLeads > 0 ? `${totalLeads} leads discovered — reloading...` : "No leads found this run."}
        </div>
      </div>
    );
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

      {/* Live progress */}
      {running && runData && (
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-medium">{stepLabel}</span>
          </div>
          {runData.progress?.niche && (
            <div className="text-xs text-muted mt-1">Niche: {runData.progress.niche}</div>
          )}
          {(runData.progress?.hot !== undefined) && (
            <div className="text-xs text-muted mt-1">
              🔥 {runData.progress.hot} hot
              {runData.progress.cold !== undefined && ` + 🧊 ${runData.progress.cold} cold`}
              {runData.progress.enriched !== undefined && ` → ${runData.progress.enriched} enriched`}
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {isComplete && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-success/10 text-success">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span>Pipeline complete!</span>
            {renderResults()}
          </div>
        </div>
      )}

      {/* Failure */}
      {isFailed && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-danger/10 text-danger">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{runData?.error || "Pipeline failed"}</span>
        </div>
      )}

      {/* Startup error (before pipeline even begins) */}
      {error && !runData && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-danger/10 text-danger">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

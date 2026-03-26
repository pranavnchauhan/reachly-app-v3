
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Target, Briefcase, Tag, Mail, TrendingUp } from "lucide-react";
import type { Signal, EmailTemplate } from "@/types/database";

export default async function NicheDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: template } = await supabase
    .from("niche_templates")
    .select("*, profiles(full_name)")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const signals = (template.signals as Signal[]) || [];
  const emailTemplates = (template.email_templates as EmailTemplate[]) || [];

  // Get client niches forked from this template
  const { data: clientNiches } = await supabase
    .from("client_niches")
    .select("*, profiles(full_name, company_name)")
    .eq("template_id", id);

  return (
    <div className="max-w-4xl">
      <Link href="/admin/niches" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Templates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-muted mt-1">{template.description}</p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full ${template.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
          {template.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Targeting */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Targeting</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-2">
              <Briefcase className="w-4 h-4" />
              Industries ({template.industries?.length || 0})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {template.industries?.map((ind: string) => (
                <span key={ind} className="text-xs bg-primary-light text-primary px-2 py-1 rounded-full">{ind}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-2">
              <Tag className="w-4 h-4" />
              Keywords ({template.keywords?.length || 0})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {template.keywords?.map((kw: string) => (
                <span key={kw} className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-border">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-2">
              <Target className="w-4 h-4" />
              Target Titles ({template.target_titles?.length || 0})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {template.target_titles?.map((title: string) => (
                <span key={title} className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">{title}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Employee Range</p>
            <p className="font-semibold">{template.employee_min} – {template.employee_max}</p>
          </div>
        </div>
      </div>

      {/* Signals */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Buying Signals ({signals.length})</h2>
        </div>
        <div className="grid gap-3">
          {signals.map((signal) => (
            <div key={signal.id} className="flex items-start justify-between p-3 bg-background rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{signal.name}</h4>
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{signal.category}</span>
                </div>
                <p className="text-xs text-muted mt-1">{signal.description}</p>
              </div>
              <div className="text-right ml-4">
                <span className="text-xs text-muted">Weight</span>
                <p className="font-bold text-sm">{signal.weight}/10</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Email Templates ({emailTemplates.length})</h2>
        </div>
        <div className="space-y-4">
          {emailTemplates.map((tmpl) => (
            <div key={tmpl.id} className="border border-border rounded-lg p-4">
              <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full">{tmpl.approach}</span>
              <p className="text-sm font-medium mt-2">Subject: {tmpl.subject}</p>
              <p className="text-xs text-muted mt-2 whitespace-pre-wrap">{tmpl.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Client Niches using this template */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Client Niches ({clientNiches?.length || 0})</h2>
        {!clientNiches?.length ? (
          <p className="text-sm text-muted">No clients assigned to this template yet.</p>
        ) : (
          <div className="space-y-3">
            {clientNiches.map((niche) => (
              <div key={niche.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div>
                  <p className="text-sm font-medium">{niche.name}</p>
                  <p className="text-xs text-muted">
                    {niche.profiles?.full_name} {niche.profiles?.company_name ? `(${niche.profiles.company_name})` : ""}
                  </p>
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


import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NicheEditor } from "./niche-editor";
import type { Signal } from "@/types/database";

export default async function NicheDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: template } = await supabase
    .from("niche_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (!template) notFound();

  // Get client niches that are actually assigned (have a client or company)
  const { data: clientNiches } = await supabase
    .from("client_niches")
    .select("id, name, is_active, enabled_signals, client_id, company_id, profiles(full_name), companies(company_name)")
    .eq("template_id", id)
    .or("client_id.not.is.null,company_id.not.is.null");

  return (
    <div className="max-w-4xl">
      <Link href="/admin/niches" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Templates
      </Link>

      <NicheEditor
        template={{
          ...template,
          signals: (template.signals as Signal[]) || [],
        }}
        clientNiches={clientNiches ?? []}
      />
    </div>
  );
}

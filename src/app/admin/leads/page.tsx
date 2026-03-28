
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadValidationList } from "@/components/admin/lead-validation-list";
import { PipelineTrigger } from "@/components/admin/pipeline-trigger";

export default async function LeadValidationPage() {
  const supabase = createAdminClient();

  const [{ data: leads }, { data: activeNiches }, { data: templates }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, niche_templates(id, name), client_niches(name, client_id, profiles:client_id(full_name, company_name))")
      .in("status", ["discovered", "validated"])
      .is("archived_at", null)
      .order("discovered_at", { ascending: false })
      .limit(100),
    supabase
      .from("client_niches")
      .select("id, name")
      .eq("is_active", true),
    supabase
      .from("niche_templates")
      .select("id, name")
      .eq("is_active", true),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lead Validation</h1>
      <PipelineTrigger niches={activeNiches ?? []} />
      <LeadValidationList initialLeads={leads ?? []} templates={templates ?? []} />
    </div>
  );
}

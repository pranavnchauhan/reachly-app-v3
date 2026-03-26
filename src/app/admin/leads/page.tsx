
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadValidationList } from "@/components/admin/lead-validation-list";
import { PipelineTrigger } from "@/components/admin/pipeline-trigger";

export default async function LeadValidationPage() {
  const supabase = createAdminClient();

  const [{ data: leads }, { data: activeNiches }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, client_niches(name, client_id, profiles:client_id(full_name, company_name))")
      .in("status", ["discovered", "validated"])
      .order("discovered_at", { ascending: false })
      .limit(50),
    supabase
      .from("client_niches")
      .select("id, name")
      .eq("is_active", true),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lead Validation</h1>
      <PipelineTrigger niches={activeNiches ?? []} />
      <LeadValidationList initialLeads={leads ?? []} />
    </div>
  );
}

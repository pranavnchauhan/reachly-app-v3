export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { LeadValidationList } from "@/components/admin/lead-validation-list";

export default async function LeadValidationPage() {
  const supabase = createAdminClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*, client_niches(name, client_id, profiles:client_id(full_name, company_name))")
    .in("status", ["discovered", "validated"])
    .order("discovered_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Lead Validation</h1>
      <LeadValidationList initialLeads={leads ?? []} />
    </div>
  );
}

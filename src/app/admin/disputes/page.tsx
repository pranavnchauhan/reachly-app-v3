export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { DisputeReview } from "./dispute-review";

export default async function AdminDisputesPage() {
  const supabase = createAdminClient();

  const { data: disputes } = await supabase
    .from("disputes")
    .select(`
      *,
      leads(id, company_name, contact_name, contact_email, contact_phone, contact_linkedin),
      profiles!disputes_client_id_fkey(id, full_name, email, company_id)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dispute Management</h1>
        <p className="text-sm text-muted mt-0.5">Review, approve, or reject client disputes</p>
      </div>
      <DisputeReview initialDisputes={disputes ?? []} />
    </div>
  );
}

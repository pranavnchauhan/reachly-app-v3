
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DisputeClient } from "./dispute-client";

export default async function DisputesPage() {
  const user = await getUser();
  const supabase = createAdminClient();

  // Get client's niches
  const { data: niches } = await supabase
    .from("client_niches")
    .select("id")
    .eq("client_id", user.id);

  const nicheIds = niches?.map((n) => n.id) ?? [];

  // Fetch disputes and revealed leads in parallel
  const [{ data: disputes }, { data: leads }] = await Promise.all([
    supabase
      .from("disputes")
      .select("*, leads(company_name, contact_name)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false }),
    nicheIds.length
      ? supabase
          .from("leads")
          .select("id, company_name, contact_name, contact_email, contact_phone, contact_linkedin")
          .in("client_niche_id", nicheIds)
          .eq("status", "revealed")
      : { data: [] },
  ]);

  return (
    <DisputeClient
      initialDisputes={disputes ?? []}
      revealedLeads={leads ?? []}
      clientId={user.id}
    />
  );
}

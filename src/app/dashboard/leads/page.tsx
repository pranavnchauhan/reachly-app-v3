export const dynamic = "force-dynamic";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientLeadsList } from "@/components/client/leads-list";

export default async function ClientLeadsPage() {
  const user = await getUser();
  const supabase = createAdminClient();

  // Get client's niches
  const { data: niches } = await supabase
    .from("client_niches")
    .select("id, name")
    .eq("client_id", user.id);

  const nicheIds = niches?.map((n) => n.id) ?? [];

  // Get published + revealed leads
  const { data: leads } = nicheIds.length
    ? await supabase
        .from("leads")
        .select("*")
        .in("client_niche_id", nicheIds)
        .in("status", ["published", "revealed", "disputed", "refunded"])
        .order("published_at", { ascending: false })
    : { data: [] };

  // Get credit balance
  const { data: creditPacks } = await supabase
    .from("credit_packs")
    .select("total_credits, used_credits")
    .eq("client_id", user.id);

  const creditBalance = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Leads</h1>
        <div className="text-sm text-muted">
          Credits: <span className="font-semibold text-foreground">{creditBalance}</span>
        </div>
      </div>
      <ClientLeadsList
        initialLeads={leads ?? []}
        creditBalance={creditBalance}
        clientId={user.id}
      />
    </div>
  );
}

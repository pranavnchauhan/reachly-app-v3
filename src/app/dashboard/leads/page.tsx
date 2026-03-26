
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

  // Get credit balance (non-expired, user + company level)
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  const { data: userPacks } = await supabase
    .from("credit_packs")
    .select("total_credits, used_credits, expires_at")
    .eq("client_id", user.id);
  const { data: companyPacks } = profile?.company_id
    ? await supabase.from("credit_packs").select("total_credits, used_credits, expires_at").eq("company_id", profile.company_id)
    : { data: [] };

  const now = new Date();
  const creditBalance = [...(userPacks || []), ...(companyPacks || [])]
    .filter((p) => !p.expires_at || new Date(p.expires_at) > now)
    .reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0);

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

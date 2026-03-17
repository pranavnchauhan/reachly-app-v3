export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { AssignNiche } from "@/components/admin/assign-niche";
import { AddCredits } from "@/components/admin/add-credits";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: client } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // Get client's niches
  const { data: clientNiches } = await supabase
    .from("client_niches")
    .select("*, niche_templates(name)")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  // Get available templates
  const { data: templates } = await supabase
    .from("niche_templates")
    .select("id, name, signals, industries")
    .eq("is_active", true);

  // Get credit packs
  const { data: creditPacks } = await supabase
    .from("credit_packs")
    .select("*")
    .eq("client_id", id)
    .order("purchased_at", { ascending: false });

  const totalCredits = creditPacks?.reduce((sum, p) => sum + (p.total_credits - p.used_credits), 0) ?? 0;

  // Get lead counts
  const nicheIds = clientNiches?.map((n) => n.id) ?? [];
  const { count: totalLeads } = nicheIds.length
    ? await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("client_niche_id", nicheIds)
    : { count: 0 };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      {/* Client Info */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{client.full_name}</h1>
            <p className="text-muted mt-1">{client.company_name || "No company"}</p>
            <p className="text-sm text-muted mt-1">{client.email}</p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{client.role}</span>
            <p className="text-xs text-muted mt-2">
              Joined {new Date(client.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted">Active Niches</p>
            <p className="text-2xl font-bold">{clientNiches?.filter((n) => n.is_active).length ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Total Leads</p>
            <p className="text-2xl font-bold">{totalLeads ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Credits Available</p>
            <p className="text-2xl font-bold">{totalCredits}</p>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Credits</h2>
          </div>
        </div>
        <AddCredits clientId={id} currentBalance={totalCredits} />
        {creditPacks && creditPacks.length > 0 && (
          <div className="mt-4 space-y-2">
            {creditPacks.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between p-3 bg-background rounded-lg text-sm">
                <span>{pack.total_credits} credits — purchased {new Date(pack.purchased_at).toLocaleDateString()}</span>
                <span className="text-muted">{pack.total_credits - pack.used_credits} remaining</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Niche Assignment */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-4">Assigned Niches</h2>
        <AssignNiche
          clientId={id}
          templates={templates ?? []}
          existingNiches={clientNiches ?? []}
        />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = createAdminClient();

  const { data: clients } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clients</h1>

      {!clients?.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted">No clients yet. Clients will appear here after signing up.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-sm font-medium text-muted">Name</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Company</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Joined</th>
                <th className="px-4 py-3 text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border last:border-0 hover:bg-background/50">
                  <td className="px-4 py-3 text-sm font-medium">{client.full_name}</td>
                  <td className="px-4 py-3 text-sm text-muted">{client.company_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted">{client.email}</td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${client.id}`}
                      className="text-sm text-primary hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

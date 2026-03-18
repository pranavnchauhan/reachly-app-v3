export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    redirect(profile?.role === "admin" || profile?.role === "staff" ? "/admin" : "/dashboard");
  }

  redirect("/auth/login");
}

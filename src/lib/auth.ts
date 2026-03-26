import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

// cache() deduplicates within a single request — layout + page share one call
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile) return profile;

  const { data: newProfile, error: insertError } = await adminClient
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || user.email!.split("@")[0],
      company_name: user.user_metadata?.company_name || null,
      role: "client",
    })
    .select()
    .single();

  if (newProfile) return newProfile;

  console.error("Failed to create profile:", insertError);
  await supabase.auth.signOut();
  redirect("/auth/login?error=profile_creation_failed");
});

export async function requireRole(role: UserRole) {
  const profile = await getUser();
  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return profile;
}

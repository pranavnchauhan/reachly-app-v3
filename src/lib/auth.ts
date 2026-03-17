import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Use admin client to bypass RLS for profile lookup
  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile) return profile;

  // Auto-create profile if missing (uses admin client to bypass RLS)
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

  // Last resort — log the error and sign out
  console.error("Failed to create profile:", insertError);
  await supabase.auth.signOut();
  redirect("/auth/login?error=profile_creation_failed");
}

export async function requireRole(role: UserRole) {
  const profile = await getUser();
  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return profile;
}

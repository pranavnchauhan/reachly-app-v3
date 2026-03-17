import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // If no profile exists, create one automatically
  if (!profile || error) {
    const { data: newProfile } = await supabase
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

    // If insert also fails (e.g. RLS), sign out to break the loop
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return profile;
}

export async function requireRole(role: UserRole) {
  const profile = await getUser();
  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return profile;
}

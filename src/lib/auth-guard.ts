// Shared auth guard for API routes
// Verifies the user's session token and checks their role

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface AuthResult {
  authorized: true;
  userId: string;
  role: string;
}

interface AuthFailure {
  authorized: false;
  response: NextResponse;
}

/**
 * Require admin or staff role. Call at the top of every admin API route.
 * Returns userId + role on success, or a 401 NextResponse on failure.
 */
export async function requireAdmin(request: Request): Promise<AuthResult | AuthFailure> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { authorized: false, response: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { authorized: true, userId: user.id, role: profile.role as string };
}

/**
 * Require any authenticated user. Returns userId on success.
 * Used for client-facing routes where we need to verify identity.
 */
export async function requireAuth(request: Request): Promise<AuthResult | AuthFailure> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { authorized: false, response: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) {
    return { authorized: false, response: NextResponse.json({ error: "No profile" }, { status: 401 }) };
  }

  return { authorized: true, userId: user.id, role: profile.role as string };
}

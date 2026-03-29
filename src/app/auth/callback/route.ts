import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validate next param — must be a relative path, no protocol or double slashes
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Code exchange failed:", error.message);
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_failed`
    );
  }

  return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent("No code provided")}`);
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If reset-password page has a code param, redirect through callback to exchange it server-side
  const { pathname, searchParams, origin } = request.nextUrl;
  if (pathname === "/auth/reset-password" && searchParams.has("code")) {
    const code = searchParams.get("code")!;
    return NextResponse.redirect(`${origin}/auth/callback?code=${code}&type=recovery`);
  }

  // Skip auth checks if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (important for token refresh)
  await supabase.auth.getUser();

  // Don't redirect in middleware — let pages handle auth logic
  // This prevents redirect loops when profile is missing
  return supabaseResponse;
}

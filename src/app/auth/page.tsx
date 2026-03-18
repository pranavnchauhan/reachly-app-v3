"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check URL hash for recovery tokens (Supabase puts them here)
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=signup")) {
      // Recovery flow — redirect to reset-password page with the hash
      router.replace(`/auth/reset-password${hash}`);
      return;
    }

    // Check for code parameter (PKCE flow)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const type = params.get("type");

    if (code) {
      // Exchange code via callback, then redirect based on type
      const callbackUrl = `/auth/callback?code=${code}${type ? `&type=${type}` : ""}`;
      router.replace(callbackUrl);
      return;
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/reset-password");
      } else if (event === "SIGNED_IN") {
        router.replace("/dashboard");
      }
    });

    // No tokens found — go to login
    const timeout = setTimeout(() => {
      router.replace("/auth/login");
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted">Redirecting...</p>
    </div>
  );
}

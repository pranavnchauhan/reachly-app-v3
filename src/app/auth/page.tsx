"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // The implicit flow puts tokens in the URL hash (#access_token=xxx)
    // The Supabase client auto-detects and creates a session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.replace("/dashboard");
      }
    });

    // If no auth event fires within 5 seconds, something went wrong
    const timeout = setTimeout(() => {
      setError("Could not verify your login link. It may have expired.");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <Image src="/logo-reachly.png" alt="Reachly" width={180} height={64} className="mx-auto mb-6" priority />
          <div className="bg-card border border-border rounded-xl p-8">
            <h2 className="text-lg font-semibold mb-2">Link Expired</h2>
            <p className="text-muted text-sm mb-4">{error}</p>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted">Signing you in...</p>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function AuthPage() {
  const [mode, setMode] = useState<"loading" | "reset" | "redirect">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Listen for auth state changes — this fires when Supabase processes recovery tokens from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      } else if (event === "SIGNED_IN" && mode === "loading") {
        // If signed in but not in recovery mode, check if this is a recovery session
        // by looking at the URL hash (may already be consumed)
        setMode("reset");
      }
    });

    // Check URL hash for recovery tokens
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setMode("reset");
    }

    // Check for PKCE code parameter
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      router.replace(`/auth/callback?code=${code}&type=recovery`);
      return;
    }

    // Fallback: check if user already has a session (e.g. token was auto-exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode === "loading") {
        // User has a session — likely recovery token was already exchanged
        setMode("reset");
      } else if (!session) {
        // No session, no tokens — wait a bit then redirect to login
        setTimeout(() => {
          setMode((current) => current === "loading" ? "redirect" : current);
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "redirect") {
      router.replace("/auth/login");
    }
  }, [mode, router]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  // Loading state
  if (mode === "loading" || mode === "redirect") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted">Verifying...</p>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <Image src="/logo-reachly.png" alt="Reachly" width={180} height={64} className="mx-auto mb-6" priority />
          <div className="bg-card border border-border rounded-xl p-8">
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Password Updated</h2>
            <p className="text-muted text-sm">Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo-reachly.png" alt="Reachly" width={180} height={64} className="mx-auto mb-3" priority />
          <p className="text-muted mt-2">Set your new password</p>
        </div>

        <form onSubmit={handleReset} className="bg-card border border-border rounded-xl p-8 space-y-5">
          {error && (
            <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Updating..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

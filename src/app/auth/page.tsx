"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function AuthPage() {
  // If URL has a hash, it's a recovery/auth flow — show reset form immediately, don't redirect
  const hasHash = typeof window !== "undefined" && window.location.hash.length > 1;

  const [mode, setMode] = useState<"loading" | "reset" | "login">(hasHash ? "reset" : "loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const recoveryDetected = useRef(hasHash);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryDetected.current = true;
        setMode("reset");
      } else if (event === "SIGNED_IN" && !recoveryDetected.current) {
        // Signed in but NOT recovery — go to dashboard
        router.replace("/dashboard");
      }
    });

    // Only redirect to login if there's genuinely no recovery flow
    // Wait 5 seconds to give Supabase time to process tokens
    const timeout = setTimeout(() => {
      if (!recoveryDetected.current) {
        setMode("login");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "login") {
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

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted">Verifying...</p>
      </div>
    );
  }

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

  // Reset password form (mode === "reset")
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
              id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              required minLength={8}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <input
              id="confirmPassword" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Re-enter your password"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
            {loading ? "Updating..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

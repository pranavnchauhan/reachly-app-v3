"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/create-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, companyName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create client");
      setLoading(false);
      return;
    }

    router.push(`/admin/clients/${data.clientId}`);
    router.refresh();
  }

  return (
    <div className="max-w-lg">
      <Link href="/admin/clients" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create Client</h1>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1.5">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="John Smith" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Company Name</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Acme Corp" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="client@company.com" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Minimum 8 characters" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
            {loading ? "Creating..." : "Create Client"}
          </button>
          <Link href="/admin/clients"
            className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors flex items-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

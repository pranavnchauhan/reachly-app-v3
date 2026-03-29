"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Building2, Target, Send, CheckCircle, Loader2,
} from "lucide-react";

interface Company {
  id: string;
  company_name: string;
  abn: string | null;
}

interface NicheTemplate {
  id: string;
  name: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCompany = searchParams.get("company") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");

  // Companies + templates
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<NicheTemplate[]>([]);

  // Form fields
  const [companyId, setCompanyId] = useState(preselectedCompany);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<"client" | "staff">("client");

  // Niche (optional)
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [nicheName, setNicheName] = useState("");
  const [geography, setGeography] = useState("Australia");

  // Welcome email
  const [sendWelcome, setSendWelcome] = useState(true);

  const [createdEmail, setCreatedEmail] = useState("");

  useEffect(() => {
    async function load() {
      const [compRes, tmplRes] = await Promise.all([
        authFetch("/api/admin/list-companies"),
        authFetch("/api/admin/list-templates"),
      ]);
      if (compRes.ok) {
        const data = await compRes.json();
        setCompanies(data.companies || []);
      }
      if (tmplRes.ok) {
        const data = await tmplRes.json();
        setTemplates(data.templates || []);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email) {
      setError("Name and email are required");
      return;
    }
    setLoading(true);
    setError("");

    const res = await authFetch("/api/admin/onboard-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        companyId: companyId || null,
        companyName: companies.find((c) => c.id === companyId)?.company_name || null,
        phone,
        position,
        role,
        templateId: selectedTemplate || null,
        nicheName: nicheName || null,
        geography: geography.split(",").map((g) => g.trim()).filter(Boolean),
        initialCredits: null,
        sendWelcome,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create user");
      setLoading(false);
      return;
    }

    setCreatedEmail(email);
    setStep("success");
    setLoading(false);
  }

  if (step === "success") {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-8 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">User Created</h2>
          <p className="text-sm text-muted mb-1"><strong>{fullName}</strong> ({createdEmail})</p>
          {sendWelcome && <p className="text-sm text-muted mb-4">Welcome email sent with login instructions.</p>}
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => {
              setStep("form"); setFullName(""); setEmail(""); setPhone(""); setPosition("");
              setSelectedTemplate(""); setNicheName("");
            }}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
              Create Another User
            </button>
            <Link href="/admin/users"
              className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors">
              View Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/users" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create User</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

        {/* Assign to Client */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Assign to Client</h2>
          </div>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">No client — internal user</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} {c.abn ? `(ABN: ${c.abn})` : ""}
              </option>
            ))}
          </select>
          {!companyId && (
            <Link href="/admin/clients/new" className="text-xs text-primary hover:underline mt-2 inline-block">
              + Create a new client first
            </Link>
          )}
        </div>

        {/* User Details */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">User Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Full Name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Position / Title</label>
              <input value={position} onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Operations Manager" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="john@company.com.au" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+61 4XX XXX XXX" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "client" | "staff")}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="client">Client (sees leads, uses credits)</option>
                <option value="staff">Staff (validates leads, manages clients)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Niche Assignment (only for client role) */}
        {role === "client" && companyId && (
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Niche Assignment</h2>
              <span className="text-xs text-muted">(optional)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-1">Niche Template</label>
                <select value={selectedTemplate} onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  const t = templates.find((t) => t.id === e.target.value);
                  if (t && !nicheName) setNicheName(t.name);
                }}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">No niche — assign later</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (
                <>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">Niche Name</label>
                    <input value={nicheName} onChange={(e) => setNicheName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted uppercase tracking-wide block mb-1">Geography</label>
                    <input value={geography} onChange={(e) => setGeography(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Welcome Email */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Welcome Email</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
            <span className="text-sm">Send welcome email with password setup link</span>
          </label>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
          {loading ? "Creating..." : `Create User & ${sendWelcome ? "Send Invite" : "Save"}`}
        </button>
      </form>
    </div>
  );
}

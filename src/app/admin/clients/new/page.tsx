"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Users, Target, CreditCard, CheckCircle } from "lucide-react";

interface NicheTemplate {
  id: string;
  name: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const [createdEmail, setCreatedEmail] = useState("");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");

  // Niche assignment
  const [templates, setTemplates] = useState<NicheTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [nicheName, setNicheName] = useState("");
  const [geography, setGeography] = useState("Australia");

  // Credits
  const [initialCredits, setInitialCredits] = useState(0);

  // Send welcome email
  const [sendWelcome, setSendWelcome] = useState(true);

  useEffect(() => {
    async function loadTemplates() {
      const res = await fetch("/api/admin/list-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    }
    loadTemplates();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/onboard-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        companyName,
        phone,
        templateId: selectedTemplate || null,
        nicheName: nicheName || null,
        geography: geography.split(",").map((g) => g.trim()).filter(Boolean),
        initialCredits: initialCredits > 0 ? initialCredits : null,
        sendWelcome,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create client");
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
          <h2 className="text-xl font-bold mb-2">Client Created</h2>
          <p className="text-sm text-muted mb-1">
            <strong>{fullName}</strong> ({createdEmail})
          </p>
          {sendWelcome && (
            <p className="text-sm text-muted mb-4">
              A welcome email with login instructions has been sent.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => {
              setStep("form");
              setFullName("");
              setEmail("");
              setCompanyName("");
              setPhone("");
              setSelectedTemplate("");
              setNicheName("");
              setInitialCredits(0);
            }}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
              Create Another
            </button>
            <Link href="/admin/clients"
              className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors">
              View Clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/clients" className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Clients
      </Link>

      <h1 className="text-2xl font-bold mb-6">Onboard New Client</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

        {/* Client Details */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Client Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Full Name *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Company Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="client@company.com" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+61 4XX XXX XXX" />
            </div>
          </div>
        </div>

        {/* Niche Assignment */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Niche Assignment</h2>
            <span className="text-xs text-muted">(optional — can be done later)</span>
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
                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">Niche Name (for this client)</label>
                  <input value={nicheName} onChange={(e) => setNicheName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Operational Transformation — Melbourne" />
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wide block mb-1">Geography</label>
                  <input value={geography} onChange={(e) => setGeography(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Australia, Melbourne, Sydney" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Credits */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Initial Credits</h2>
            <span className="text-xs text-muted">(optional — client can purchase via Stripe)</span>
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Credits to add</label>
            <input type="number" min={0} value={initialCredits} onChange={(e) => setInitialCredits(Number(e.target.value))}
              className="w-32 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0" />
            <p className="text-xs text-muted mt-1">Leave at 0 if client will purchase credits themselves.</p>
          </div>
        </div>

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
          {loading ? "Creating..." : (
            <><Users className="w-4 h-4" /> Create Client & {sendWelcome ? "Send Invite" : "Save"}</>
          )}
        </button>
      </form>
    </div>
  );
}

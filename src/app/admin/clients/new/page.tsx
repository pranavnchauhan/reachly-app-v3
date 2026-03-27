"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Search, Building2, CheckCircle, Loader2, Plus, X, Globe,
} from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");

  // ABN lookup
  const [abn, setAbn] = useState("");
  const [abnLoading, setAbnLoading] = useState(false);
  const [abnVerified, setAbnVerified] = useState(false);
  const [abnError, setAbnError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ abn: string; name: string; state: string; postcode: string; name_type: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [businessNames, setBusinessNames] = useState<string[]>([]);
  const [newBusinessName, setNewBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState(false);

  const [createdId, setCreatedId] = useState("");

  async function searchByName() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setAbnError("");
    setSearchResults([]);

    const res = await fetch(`/api/admin/abn-lookup?name=${encodeURIComponent(searchQuery.trim())}`);
    const data = await res.json();

    if (res.ok && data.results?.length > 0) {
      setSearchResults(data.results);
    } else {
      setAbnError(data.error || "No results found");
    }
    setSearching(false);
  }

  async function selectSearchResult(result: { abn: string; name: string; state: string; postcode: string }) {
    setAbn(result.abn);
    setSearchResults([]);
    setSearchQuery("");

    // Now do a full ABN lookup to get all details
    setAbnLoading(true);
    const res = await fetch(`/api/admin/abn-lookup?abn=${result.abn}`);
    const data = await res.json();

    if (res.ok) {
      setCompanyName(data.company_name || result.name);
      setBusinessNames(data.business_names || []);
      setState(data.state || result.state);
      setPostcode(data.postcode || result.postcode);
      setAbnVerified(true);
    }
    setAbnLoading(false);
  }

  async function lookupAbn() {
    const cleanAbn = abn.replace(/\s/g, "");
    if (cleanAbn.length !== 11) {
      setAbnError("ABN must be 11 digits");
      return;
    }

    setAbnLoading(true);
    setAbnError("");

    const res = await fetch(`/api/admin/abn-lookup?abn=${cleanAbn}`);
    const data = await res.json();

    if (!res.ok) {
      setAbnError(data.error || "ABN lookup failed");
      setAbnLoading(false);
      return;
    }

    setCompanyName(data.company_name || "");
    setBusinessNames(data.business_names || []);
    setState(data.state || "");
    setPostcode(data.postcode || "");
    setAbnVerified(true);
    setAbnLoading(false);
  }

  async function scrapeWebsite() {
    if (!website.trim()) return;
    setScraping(true);
    setScraped(false);

    const res = await fetch(`/api/admin/scrape-website?url=${encodeURIComponent(website.trim())}`);
    const data = await res.json();

    if (res.ok) {
      // Only fill fields that are currently empty — don't overwrite ABN-populated data
      if (data.email && !companyEmail) setCompanyEmail(data.email);
      if (data.phone && !companyPhone) setCompanyPhone(data.phone);
      if (data.address && !address) setAddress(data.address);
      if (data.city && !city) setCity(data.city);
      if (data.state && !state) setState(data.state);
      if (data.postcode && !postcode) setPostcode(data.postcode);
      if (data.industry && !industry) setIndustry(data.industry);
      setScraped(true);
    }
    setScraping(false);
  }

  function addBusinessName() {
    const trimmed = newBusinessName.trim();
    if (trimmed && !businessNames.includes(trimmed)) {
      setBusinessNames([...businessNames, trimmed]);
      setNewBusinessName("");
    }
  }

  function removeBusinessName(index: number) {
    setBusinessNames(businessNames.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName) {
      setError("Company name is required");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/create-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        abn: abn.replace(/\s/g, "") || null,
        company_name: companyName,
        business_names: businessNames,
        industry,
        email: companyEmail,
        phone: companyPhone,
        website: website.trim() || null,
        address,
        city,
        state,
        postcode,
        notes,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create client");
      setLoading(false);
      return;
    }

    setCreatedId(data.id);
    setStep("success");
    setLoading(false);
  }

  if (step === "success") {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-8 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Client Created</h2>
          <p className="text-sm text-muted mb-1"><strong>{companyName}</strong></p>
          {abn && <p className="text-xs text-muted">ABN: {abn}</p>}
          <p className="text-sm text-muted mt-4">Now create a user account for this client.</p>
          <div className="flex gap-3 justify-center mt-6">
            <Link href={`/admin/users/new?company=${createdId}`}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
              Create User for this Client
            </Link>
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

      <h1 className="text-2xl font-bold mb-6">Create Client</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-danger/10 text-danger text-sm rounded-lg p-3">{error}</div>}

        {/* ABN / Company Search */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Find Company</h2>
            <span className="text-xs text-muted">(search by name or ABN)</span>
          </div>

          {/* Search by company name */}
          <div className="mb-3">
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Company Name</label>
            <div className="flex gap-2">
              <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setAbnError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchByName(); } }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Seamless Property" />
              <button type="button" onClick={searchByName} disabled={searching || searchQuery.trim().length < 2}
                className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mb-3 max-h-60 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/50 last:border-0"
                >
                  <p className="text-sm font-medium">{result.name}</p>
                  <p className="text-xs text-muted">ABN: {result.abn} · {result.state} {result.postcode} · {result.name_type}</p>
                </button>
              ))}
            </div>
          )}

          {/* Or search by ABN directly */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Or enter ABN directly</label>
            <div className="flex gap-2">
              <input value={abn} onChange={(e) => { setAbn(e.target.value); setAbnVerified(false); setAbnError(""); }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                placeholder="e.g. 12 345 678 901"
                maxLength={14} />
              <button type="button" onClick={lookupAbn} disabled={abnLoading}
                className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {abnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Lookup
              </button>
            </div>
          </div>

          {abnError && <p className="text-xs text-danger mt-2">{abnError}</p>}
          {abnVerified && <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> ABN verified — details populated below</p>}
        </div>

        {/* Website Scrape */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Website</h2>
            <span className="text-xs text-muted">(auto-fills email, phone, address from site)</span>
          </div>
          <div className="flex gap-2">
            <input value={website} onChange={(e) => { setWebsite(e.target.value); setScraped(false); }}
              className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. seamlesspropertygroup.com.au"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scrapeWebsite(); } }}
            />
            <button type="button" onClick={scrapeWebsite} disabled={scraping || !website.trim()}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {scraping ? "Fetching..." : "Fetch Details"}
            </button>
          </div>
          {scraped && <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Website scraped — details populated below (you can edit any field)</p>}
        </div>

        {/* Company Details */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Company Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Company Name *</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Legal entity name" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Business Names / Trading As</label>
              <div className="flex gap-2 mb-2">
                <input value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBusinessName(); } }}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add business name" />
                <button type="button" onClick={addBusinessName}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {businessNames.map((name, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {name} <button type="button" onClick={() => removeBusinessName(i)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Construction" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Company Email</label>
              <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="info@company.com.au" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Company Phone</label>
              <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+61 2 XXXX XXXX" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Sydney" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">State</label>
              <select value={state} onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select state</option>
                {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">Postcode</label>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="2000" maxLength={4} />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs text-muted uppercase tracking-wide block mb-1">Internal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Any notes about this client..." />
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
          {loading ? "Creating..." : "Create Client"}
        </button>
      </form>
    </div>
  );
}

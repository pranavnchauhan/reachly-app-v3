"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useEffect, useState } from "react";
import {
  Archive, Trash2, AlertTriangle, Clock, Target,
  CreditCard, FileText, RefreshCw, CheckCircle, Flame, UserPlus,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface OrphanedNiche {
  id: string;
  name: string;
  template_name: string;
  lead_count: number;
  is_active: boolean;
  created_at: string;
  archived_at: string | null;
  archive_expires_at: string | null;
  days_until_purge: number | null;
  is_expired: boolean;
}

interface OrphanedCredit {
  id: string;
  total_credits: number;
  used_credits: number;
  purchased_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  company_name: string | null;
  company_id: string | null;
}

interface Summary {
  total_niches: number;
  total_leads: number;
  total_credits: number;
  archived: number;
  expired: number;
}

export default function OrphanedDataPage() {
  const [niches, setNiches] = useState<OrphanedNiche[]>([]);
  const [credits, setCredits] = useState<OrphanedCredit[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    severity: "info" | "warning" | "danger";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Reassignment state
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState("");

  async function loadData() {
    setLoading(true);
    const res = await authFetch("/api/admin/orphaned-data");
    if (res.ok) {
      const data = await res.json();
      setNiches(data.niches);
      setCredits(data.credits);
      setUsers(data.users);
      setSummary(data.summary);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAction(action: string, body: Record<string, unknown>) {
    setMessage(null);
    const res = await authFetch("/api/admin/orphaned-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (res.ok) {
      await loadData();
      const labels: Record<string, string> = {
        reassign: "Niche reassigned successfully",
        archive: "Data archived — 90-day countdown started",
        purge: "Data permanently deleted",
        purge_credits: "Orphaned credits purged",
      };
      setMessage({ type: "success", text: labels[action] || "Done" });
      setReassigningId(null);
      setSelectedUser("");
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error || "Action failed" });
    }
  }

  function confirmPurge(niche: OrphanedNiche) {
    setModal({
      title: `Permanently delete "${niche.name}"?`,
      message: `This will permanently delete:\n\n• The niche configuration\n• ${niche.lead_count} lead(s) attached to it\n\nThis cannot be undone.`,
      severity: "danger",
      confirmLabel: "Permanently Delete",
      onConfirm: () => { setModal(null); handleAction("purge", { nicheId: niche.id }); },
    });
  }

  function confirmArchiveAll() {
    const unarchived = niches.filter((n) => !n.archived_at);
    if (unarchived.length === 0) return;
    setModal({
      title: `Archive ${unarchived.length} orphaned niche(s)?`,
      message: `This will start a 90-day countdown for ${unarchived.length} niche(s) and their ${niches.reduce((s, n) => s + n.lead_count, 0)} leads.\n\nAfter 90 days, a "Purge" button will appear to permanently delete them.\n\nYou can reassign them to a user at any time before purging.`,
      severity: "warning",
      confirmLabel: "Archive All",
      onConfirm: () => { setModal(null); handleAction("archive", { nicheIds: unarchived.map((n) => n.id) }); },
    });
  }

  function confirmPurgeExpired() {
    const expired = niches.filter((n) => n.is_expired);
    if (expired.length === 0) return;
    const totalLeads = expired.reduce((s, n) => s + n.lead_count, 0);
    setModal({
      title: `Purge ${expired.length} expired archive(s)?`,
      message: `These archives have passed their 90-day retention period:\n\n${expired.map((n) => `• ${n.name} (${n.lead_count} leads)`).join("\n")}\n\nTotal: ${totalLeads} leads will be permanently deleted.\n\nThis cannot be undone.`,
      severity: "danger",
      confirmLabel: `Purge ${expired.length} Archive(s)`,
      onConfirm: () => { setModal(null); handleAction("purge", { nicheIds: expired.map((n) => n.id) }); },
    });
  }

  const unarchived = niches.filter((n) => !n.archived_at);
  const archived = niches.filter((n) => n.archived_at && !n.is_expired);
  const expired = niches.filter((n) => n.is_expired);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orphaned Data</h1>
          <p className="text-sm text-muted">Manage niches and leads from deleted users</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-background text-muted">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Orphaned Niches", value: summary.total_niches, icon: Target, color: "text-warning" },
            { label: "Orphaned Leads", value: summary.total_leads, icon: FileText, color: "text-primary" },
            { label: "Unused Credits", value: summary.total_credits, icon: CreditCard, color: "text-accent" },
            { label: "Archived", value: summary.archived, icon: Archive, color: "text-muted" },
            { label: "Ready to Purge", value: summary.expired, icon: Flame, color: "text-danger" },
          ].map((s) => (
            <div key={s.label} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-card/80 border border-border/50 rounded-xl p-12 text-center">
          <p className="text-muted">Loading...</p>
        </div>
      ) : niches.length === 0 && credits.length === 0 ? (
        <div className="bg-card/80 border border-border/50 rounded-xl p-12 text-center">
          <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No orphaned data</h2>
          <p className="text-sm text-muted">All niches and leads are properly assigned to users.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Bulk Actions */}
          {niches.length > 0 && (
            <div className="flex gap-2">
              {unarchived.length > 0 && (
                <button onClick={confirmArchiveAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-warning/5 border border-warning/20 text-warning hover:bg-warning/10">
                  <Archive className="w-3 h-3" /> Archive All Unarchived ({unarchived.length})
                </button>
              )}
              {expired.length > 0 && (
                <button onClick={confirmPurgeExpired}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10">
                  <Trash2 className="w-3 h-3" /> Purge Expired ({expired.length})
                </button>
              )}
            </div>
          )}

          {/* Expired Archives (ready to purge) */}
          {expired.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-danger flex items-center gap-2">
                <Flame className="w-5 h-5" /> Ready to Purge ({expired.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {expired.map((niche) => (
                  <NicheCard key={niche.id} niche={niche} users={users}
                    reassigningId={reassigningId} selectedUser={selectedUser}
                    onReassignStart={() => setReassigningId(niche.id)}
                    onReassignCancel={() => setReassigningId(null)}
                    onSelectUser={setSelectedUser}
                    onReassign={() => handleAction("reassign", { nicheId: niche.id, userId: selectedUser })}
                    onPurge={() => confirmPurge(niche)} />
                ))}
              </div>
            </div>
          )}

          {/* Active Archives (counting down) */}
          {archived.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" /> Archived — Counting Down ({archived.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {archived.map((niche) => (
                  <NicheCard key={niche.id} niche={niche} users={users}
                    reassigningId={reassigningId} selectedUser={selectedUser}
                    onReassignStart={() => setReassigningId(niche.id)}
                    onReassignCancel={() => setReassigningId(null)}
                    onSelectUser={setSelectedUser}
                    onReassign={() => handleAction("reassign", { nicheId: niche.id, userId: selectedUser })}
                    onPurge={() => confirmPurge(niche)} />
                ))}
              </div>
            </div>
          )}

          {/* Unarchived Orphans */}
          {unarchived.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" /> Unarchived Orphans ({unarchived.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unarchived.map((niche) => (
                  <NicheCard key={niche.id} niche={niche} users={users}
                    reassigningId={reassigningId} selectedUser={selectedUser}
                    onReassignStart={() => setReassigningId(niche.id)}
                    onReassignCancel={() => setReassigningId(null)}
                    onSelectUser={setSelectedUser}
                    onReassign={() => handleAction("reassign", { nicheId: niche.id, userId: selectedUser })}
                    onArchive={() => handleAction("archive", { nicheId: niche.id })}
                    onPurge={() => confirmPurge(niche)} />
                ))}
              </div>
            </div>
          )}

          {/* Orphaned Credits */}
          {credits.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent" /> Orphaned Credits ({credits.length})
                </h2>
                <button onClick={() => {
                  setModal({
                    title: "Purge all orphaned credits?",
                    message: `${credits.reduce((s, c) => s + (c.total_credits - c.used_credits), 0)} unused credits from ${credits.length} pack(s) will be permanently deleted.`,
                    severity: "danger",
                    confirmLabel: "Purge Credits",
                    onConfirm: () => { setModal(null); handleAction("purge_credits", {}); },
                  });
                }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10">
                  <Trash2 className="w-3 h-3" /> Purge All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {credits.map((pack) => (
                  <div key={pack.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-sm">
                    <p className="font-semibold">{pack.total_credits - pack.used_credits} credits remaining</p>
                    <p className="text-xs text-muted">{pack.total_credits} total, {pack.used_credits} used</p>
                    <p className="text-xs text-muted mt-1">Purchased {new Date(pack.purchased_at).toLocaleDateString("en-AU")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ConfirmModal open={true} title={modal.title} message={modal.message}
          severity={modal.severity} confirmLabel={modal.confirmLabel}
          onConfirm={modal.onConfirm} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

// ─── Niche Card Component ──────────────────────────────────────────────
function NicheCard({
  niche, users, reassigningId, selectedUser,
  onReassignStart, onReassignCancel, onSelectUser,
  onReassign, onArchive, onPurge,
}: {
  niche: OrphanedNiche;
  users: UserOption[];
  reassigningId: string | null;
  selectedUser: string;
  onReassignStart: () => void;
  onReassignCancel: () => void;
  onSelectUser: (id: string) => void;
  onReassign: () => void;
  onArchive?: () => void;
  onPurge: () => void;
}) {
  return (
    <div className={`bg-card/80 backdrop-blur-sm border rounded-xl p-4 shadow-sm ${
      niche.is_expired ? "border-danger/30" :
      niche.archived_at ? "border-warning/30" :
      "border-border/50"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-sm">{niche.name}</h3>
          <p className="text-xs text-muted">Template: {niche.template_name}</p>
        </div>
        {niche.is_expired ? (
          <span className="text-[10px] bg-danger text-white px-1.5 py-0.5 rounded-full">EXPIRED</span>
        ) : niche.archived_at ? (
          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {niche.days_until_purge}d left
          </span>
        ) : (
          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">ORPHANED</span>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-muted mb-3">
        <span>{niche.lead_count} leads</span>
        <span>Created {new Date(niche.created_at).toLocaleDateString("en-AU")}</span>
      </div>

      {niche.archived_at && (
        <p className="text-xs text-muted mb-3">
          Archived {new Date(niche.archived_at).toLocaleDateString("en-AU")}
          {niche.archive_expires_at && ` — purge after ${new Date(niche.archive_expires_at).toLocaleDateString("en-AU")}`}
        </p>
      )}

      {/* Reassign form */}
      {reassigningId === niche.id ? (
        <div className="space-y-2 mb-3">
          <select value={selectedUser} onChange={(e) => onSelectUser(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select user...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name} {u.company_name ? `(${u.company_name})` : ""}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button onClick={onReassign} disabled={!selectedUser}
              className="flex-1 px-2 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50">
              Assign
            </button>
            <button onClick={onReassignCancel}
              className="px-2 py-1.5 border border-border rounded-lg text-xs">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
        <button onClick={onReassignStart}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10">
          <UserPlus className="w-3 h-3" /> Reassign
        </button>
        {onArchive && !niche.archived_at && (
          <button onClick={onArchive}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-warning/5 border border-warning/20 text-warning hover:bg-warning/10">
            <Archive className="w-3 h-3" /> Archive
          </button>
        )}
        {(niche.is_expired || !niche.archived_at) && (
          <button onClick={onPurge}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10">
            <Trash2 className="w-3 h-3" /> Purge
          </button>
        )}
      </div>
    </div>
  );
}

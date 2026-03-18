"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Search, Mail, Phone, Building2,
  Trash2, KeyRound, CheckCircle, XCircle, Save, X,
  Shield, User, UserCog, Calendar, Clock,
  Pause, Play, Archive, Download, AlertTriangle,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  role: string;
  created_at: string;
  last_sign_in: string | null;
  confirmed: boolean;
  account_status: string;
  archived_at: string | null;
  archive_expires_at: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff" | "client">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "archived">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<UserData>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [modal, setModal] = useState<{
    user: UserData;
    title: string;
    message: string;
    severity: "info" | "warning" | "danger";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const currentUserRole: string = "admin"; // TODO: get from auth context

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleAction(action: string, userId: string, data?: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, data, callerRole: currentUserRole }),
    });
    const result = await res.json();
    if (res.ok) {
      if (action === "reset_password") {
        setMessage({ type: "success", text: `Password reset email sent to ${result.email}` });
      } else if (action === "confirm_email") {
        setUsers(users.map((u) => u.id === userId ? { ...u, confirmed: true } : u));
        setMessage({ type: "success", text: "Email confirmed" });
      } else if (action === "update") {
        setEditingId(null);
        await loadUsers();
        setMessage({ type: "success", text: "User updated" });
      }
    } else {
      setMessage({ type: "error", text: result.error || "Action failed" });
    }
  }

  async function handleLifecycle(action: string, userId: string) {
    setMessage(null);
    const res = await fetch("/api/admin/account-lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, callerRole: currentUserRole, callerId: null }),
    });
    const result = await res.json();
    if (res.ok) {
      await loadUsers();
      const labels: Record<string, string> = {
        pause: "Account paused",
        reactivate: "Account reactivated",
        archive: `Account archived — data retained until ${new Date(result.expires_at || "").toLocaleDateString("en-AU")}`,
      };
      setMessage({ type: "success", text: labels[action] || "Done" });
    } else {
      setMessage({ type: "error", text: result.error || "Action failed" });
    }
  }

  async function handleExport(user: UserData) {
    const res = await fetch("/api/admin/account-lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "export", userId: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${user.full_name || user.email}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: `Data exported for ${user.full_name || user.email}` });
    }
  }

  async function handleDelete(user: UserData) {
    if (currentUserRole === "staff") {
      setMessage({ type: "error", text: "You are not authorised to delete users. Please check with an admin." });
      return;
    }

    const checkRes = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_delete", userId: user.id }),
    });
    const impact = await checkRes.json();

    if (impact.impact === "clean") {
      setModal({
        user,
        title: `Delete ${user.full_name || user.email}?`,
        message: "This user has no niches, leads, or credits.\nThey will be permanently removed.",
        severity: "info",
        confirmLabel: "Delete User",
        onConfirm: () => executeDelete(user, "soft"),
      });
    } else if (user.account_status === "archived") {
      // Already archived — offer hard delete
      setModal({
        user,
        title: `Permanently delete ${user.full_name || user.email}?`,
        message:
          `This will permanently remove ALL data:\n\n` +
          `• ${impact.nicheCount} niche(s)\n` +
          `• ${impact.leadCount} lead(s)\n` +
          `${impact.creditBalance > 0 ? `• ${impact.creditBalance} unused credits\n` : ""}` +
          `\nThis action cannot be undone. All leads, niches, credits, and account data will be permanently deleted.`,
        severity: "danger",
        confirmLabel: "Permanently Delete Everything",
        onConfirm: () => executeDelete(user, "hard"),
      });
    } else {
      // Active/paused user with data — suggest archive first
      setModal({
        user,
        title: `Delete ${user.full_name || user.email}?`,
        message:
          `This user has:\n\n` +
          `• ${impact.nicheCount} niche(s)\n` +
          `• ${impact.leadCount} lead(s)\n` +
          `${impact.creditBalance > 0 ? `• ${impact.creditBalance} unused credits\n` : ""}` +
          `${impact.isShared ? `\nOther users share the same niche template — their data will not be affected.\n` : ""}` +
          `\nRecommendation: Archive first (retains data for 90 days) before permanent deletion.\n\nChoosing "Delete" will deactivate niches and orphan data.`,
        severity: "warning",
        confirmLabel: "Delete User",
        onConfirm: () => executeDelete(user, "soft"),
      });
    }
  }

  async function executeDelete(user: UserData, type: "soft" | "hard") {
    setModal(null);
    const action = type === "hard" ? "hard_delete" : "delete";
    const endpoint = type === "hard" ? "/api/admin/account-lifecycle" : "/api/admin/users";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId: user.id, callerRole: currentUserRole }),
    });
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== user.id));
      setMessage({ type: "success", text: `${user.full_name || user.email} ${type === "hard" ? "permanently " : ""}deleted` });
    } else {
      const result = await res.json();
      setMessage({ type: "error", text: result.error || "Failed to delete" });
    }
  }

  function startEdit(user: UserData) {
    setEditingId(user.id);
    setEditData({
      full_name: user.full_name,
      company_name: user.company_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  }

  const filtered = users
    .filter((u) => roleFilter === "all" || u.role === roleFilter)
    .filter((u) => statusFilter === "all" || u.account_status === statusFilter)
    .filter((u) => `${u.full_name} ${u.email} ${u.company_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin": return { bg: "bg-primary/10 border-primary/20 text-primary", icon: Shield, label: "Admin" };
      case "staff": return { bg: "bg-amber-500/10 border-amber-500/20 text-amber-600", icon: UserCog, label: "Staff" };
      default: return { bg: "bg-accent/10 border-accent/20 text-accent", icon: User, label: "Client" };
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return { bg: "bg-success/10 text-success", label: "Active" };
      case "paused": return { bg: "bg-warning/10 text-warning", label: "Paused" };
      case "archived": return { bg: "bg-danger/10 text-danger", label: "Archived" };
      default: return { bg: "bg-muted/10 text-muted", label: status };
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted">
            {users.length} total · {users.filter(u => u.account_status === "active").length} active · {users.filter(u => u.account_status === "paused").length} paused · {users.filter(u => u.account_status === "archived").length} archived
          </p>
        </div>
        <Link href="/admin/users/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <Users className="w-4 h-4" /> New User
        </Link>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search users..." />
        </div>
        <div className="flex gap-1.5">
          {(["all", "admin", "staff", "client"] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === r ? "bg-primary text-white" : "bg-card border border-border text-muted hover:text-foreground"
              }`}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "paused", "archived"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-foreground text-background" : "bg-card border border-border text-muted hover:text-foreground"
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-card/80 border border-border/50 rounded-xl p-12 text-center">
          <p className="text-muted">Loading users...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user) => {
            const badge = roleBadge(user.role);
            const BadgeIcon = badge.icon;
            const sBadge = statusBadge(user.account_status);

            if (editingId === user.id) {
              return (
                <div key={user.id} className="bg-card/80 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-5 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">Edit User</h3>
                    <button onClick={() => setEditingId(null)} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Full Name", key: "full_name", type: "text" },
                      { label: "Company", key: "company_name", type: "text" },
                      { label: "Email", key: "email", type: "email" },
                      { label: "Phone", key: "phone", type: "tel" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">{field.label}</label>
                        <input type={field.type} value={(editData as Record<string, string>)[field.key] || ""}
                          onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    ))}
                    <div>
                      <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">Role</label>
                      <select value={editData.role || "client"} onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="client">Client</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleAction("update", user.id, editData)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover">
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-background">Cancel</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={user.id} className={`bg-card/80 backdrop-blur-sm border rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${
                user.account_status === "archived" ? "border-danger/30 opacity-75" :
                user.account_status === "paused" ? "border-warning/30" :
                "border-border/50 hover:border-primary/30"
              }`}>
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{user.full_name || "Unnamed"}</h3>
                    {user.company_name && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {user.company_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.bg}`}>
                      <BadgeIcon className="w-2.5 h-2.5" /> {badge.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${sBadge.bg}`}>{sBadge.label}</span>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-xs text-muted flex items-center gap-1.5"><Mail className="w-3 h-3 shrink-0" /> {user.email}</p>
                  {user.phone && <p className="text-xs text-muted flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /> {user.phone}</p>}
                  <p className="text-xs text-muted flex items-center gap-1.5"><Calendar className="w-3 h-3 shrink-0" /> Joined {new Date(user.created_at).toLocaleDateString("en-AU")}</p>
                  {user.last_sign_in && <p className="text-xs text-muted flex items-center gap-1.5"><Clock className="w-3 h-3 shrink-0" /> Last login {new Date(user.last_sign_in).toLocaleDateString("en-AU")}</p>}
                  {user.account_status === "archived" && user.archive_expires_at && (
                    <p className="text-xs text-danger flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Auto-purge {new Date(user.archive_expires_at).toLocaleDateString("en-AU")}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/30">
                  <button onClick={() => startEdit(user)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-background border border-border/50 hover:border-primary/30 hover:text-primary transition-colors">
                    <User className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleAction("reset_password", user.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-background border border-border/50 hover:border-primary/30 hover:text-primary transition-colors">
                    <KeyRound className="w-3 h-3" /> Reset Pwd
                  </button>
                  <button onClick={() => handleExport(user)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-background border border-border/50 hover:border-primary/30 hover:text-primary transition-colors">
                    <Download className="w-3 h-3" /> Export
                  </button>

                  {!user.confirmed && (
                    <button onClick={() => handleAction("confirm_email", user.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/5 border border-success/20 text-success hover:bg-success/10 transition-colors">
                      <CheckCircle className="w-3 h-3" /> Verify
                    </button>
                  )}

                  {/* Lifecycle actions */}
                  {user.role !== "admin" && user.account_status === "active" && (
                    <button onClick={() => handleLifecycle("pause", user.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-warning/5 border border-warning/20 text-warning hover:bg-warning/10 transition-colors">
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}
                  {user.account_status === "paused" && (
                    <>
                      <button onClick={() => handleLifecycle("reactivate", user.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/5 border border-success/20 text-success hover:bg-success/10 transition-colors">
                        <Play className="w-3 h-3" /> Reactivate
                      </button>
                      <button onClick={() => {
                        setModal({
                          user,
                          title: `Archive ${user.full_name || user.email}?`,
                          message: "This will deactivate all niches and start a 90-day data retention countdown.\n\nAfter 90 days, all data (leads, niches, credits) will be permanently deleted.\n\nYou can reactivate before the 90 days expire.",
                          severity: "warning",
                          confirmLabel: "Archive Account",
                          onConfirm: () => { setModal(null); handleLifecycle("archive", user.id); },
                        });
                      }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10 transition-colors">
                        <Archive className="w-3 h-3" /> Archive
                      </button>
                    </>
                  )}
                  {user.account_status === "archived" && (
                    <button onClick={() => handleLifecycle("reactivate", user.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/5 border border-success/20 text-success hover:bg-success/10 transition-colors">
                      <Play className="w-3 h-3" /> Reactivate
                    </button>
                  )}

                  {user.role !== "admin" && (
                    <button onClick={() => handleDelete(user)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-danger/5 border border-danger/20 text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {modal && (
        <ConfirmModal
          open={true}
          title={modal.title}
          message={modal.message}
          severity={modal.severity}
          confirmLabel={modal.confirmLabel}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}

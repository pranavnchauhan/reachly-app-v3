"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Search, Mail, Phone, Building2,
  Trash2, KeyRound, CheckCircle, XCircle, Save, X,
  Shield, User, UserCog, Calendar, Clock,
} from "lucide-react";

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
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "staff" | "client">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<UserData>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Get current user's role from the users list (admin who is logged in)
  const currentUserRole = users.find((u) => u.role === "admin" || u.role === "staff")?.role || "admin";

  async function handleDelete(user: UserData) {
    setMessage(null);

    // Staff cannot delete
    if (currentUserRole === "staff") {
      setMessage({ type: "error", text: "You are not authorised to delete users. Please check with an admin." });
      return;
    }

    // Pre-flight check
    const checkRes = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_delete", userId: user.id }),
    });
    const impact = await checkRes.json();

    let confirmed = false;

    if (impact.impact === "clean") {
      // No data — simple confirmation
      confirmed = confirm(`Delete ${user.full_name || user.email}? This user has no niches or leads.`);
    } else if (impact.impact === "safe") {
      // Shared niche — safe to delete
      confirmed = confirm(
        `Delete ${user.full_name || user.email}?\n\n` +
        `This user has ${impact.nicheCount} niche(s) and ${impact.leadCount} lead(s), ` +
        `but other users share the same niche template (${impact.sharedUsers.join(", ")}).\n\n` +
        `Deleting this user will NOT affect the client's operations — ` +
        `niches and leads will be preserved.\n\n` +
        `${impact.creditBalance > 0 ? `⚠️ This user has ${impact.creditBalance} unused credits.\n\n` : ""}` +
        `Do you want to proceed?`
      );
    } else {
      // Destructive — sole user
      confirmed = confirm(
        `⚠️ WARNING: Delete ${user.full_name || user.email}?\n\n` +
        `This is the ONLY user attached to:\n` +
        `• ${impact.nicheCount} niche(s)\n` +
        `• ${impact.leadCount} lead(s)\n` +
        `${impact.creditBalance > 0 ? `• ${impact.creditBalance} unused credits\n` : ""}` +
        `\nDeleting this user will deactivate their niches and orphan all associated data. ` +
        `Leads will be preserved but no longer accessible to any client.\n\n` +
        `Are you sure you want to proceed?`
      );
    }

    if (!confirmed) return;

    // Execute deletion
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", userId: user.id, callerRole: currentUserRole }),
    });
    const result = await res.json();
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== user.id));
      setMessage({ type: "success", text: `${user.full_name || user.email} deleted` });
    } else {
      setMessage({ type: "error", text: result.error || "Failed to delete user" });
    }
  }

  async function handleAction(action: string, userId: string, data?: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, data, callerRole: currentUserRole }),
    });
    const result = await res.json();
    if (res.ok) {
      if (action === "delete") {
        // Handled by handleDelete above — shouldn't reach here
      } else if (action === "reset_password") {
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
    .filter((u) => `${u.full_name} ${u.email} ${u.company_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const roleBadge = (role: string) => {
    switch (role) {
      case "admin": return { bg: "bg-primary/10 border-primary/20 text-primary", icon: Shield, label: "Admin" };
      case "staff": return { bg: "bg-amber-500/10 border-amber-500/20 text-amber-600", icon: UserCog, label: "Staff" };
      default: return { bg: "bg-accent/10 border-accent/20 text-accent", icon: User, label: "Client" };
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted">{users.length} total · {users.filter(u => u.role === "client").length} clients · {users.filter(u => u.role === "staff").length} staff · {users.filter(u => u.role === "admin").length} admins</p>
        </div>
        <Link href="/admin/clients/new"
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
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
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

            if (editingId === user.id) {
              return (
                <div key={user.id} className="bg-card/80 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-5 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm">Edit User</h3>
                    <button onClick={() => setEditingId(null)} className="text-muted hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">Full Name</label>
                      <input value={editData.full_name || ""} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">Company</label>
                      <input value={editData.company_name || ""} onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">Email</label>
                      <input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">Phone</label>
                      <input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="+61..." />
                    </div>
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
                        className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-background">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={user.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
                {/* Top: Name + Role + Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{user.full_name || "Unnamed"}</h3>
                    {user.company_name && (
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {user.company_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.bg}`}>
                      <BadgeIcon className="w-2.5 h-2.5" /> {badge.label}
                    </span>
                    {user.confirmed ? (
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <XCircle className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <Mail className="w-3 h-3 shrink-0" /> {user.email}
                  </p>
                  {user.phone && (
                    <p className="text-xs text-muted flex items-center gap-1.5">
                      <Phone className="w-3 h-3 shrink-0" /> {user.phone}
                    </p>
                  )}
                  <p className="text-xs text-muted flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 shrink-0" /> Joined {new Date(user.created_at).toLocaleDateString("en-AU")}
                  </p>
                  {user.last_sign_in && (
                    <p className="text-xs text-muted flex items-center gap-1.5">
                      <Clock className="w-3 h-3 shrink-0" /> Last login {new Date(user.last_sign_in).toLocaleDateString("en-AU")}
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
                  {!user.confirmed && (
                    <button onClick={() => handleAction("confirm_email", user.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/5 border border-success/20 text-success hover:bg-success/10 transition-colors">
                      <CheckCircle className="w-3 h-3" /> Verify
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
    </div>
  );
}

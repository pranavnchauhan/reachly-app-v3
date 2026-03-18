"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Search, Shield, User, Mail, Phone, Building2,
  Trash2, KeyRound, CheckCircle, XCircle, Save, X, ArrowLeft,
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

  async function handleAction(action: string, userId: string, data?: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, data }),
    });
    const result = await res.json();
    if (res.ok) {
      if (action === "delete") {
        setUsers(users.filter((u) => u.id !== userId));
        setMessage({ type: "success", text: "User deleted" });
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

  const filtered = users.filter((u) =>
    `${u.full_name} ${u.email} ${u.company_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted">{users.length} total users</p>
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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Search users..." />
      </div>

      {loading ? (
        <div className="bg-card/80 border border-border/50 rounded-xl p-12 text-center">
          <p className="text-muted">Loading users...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <div key={user.id} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm">
              {editingId === user.id ? (
                /* Edit Mode */
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Edit User</h3>
                    <button onClick={() => setEditingId(null)} className="text-muted hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Full Name</label>
                      <input value={editData.full_name || ""} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Company</label>
                      <input value={editData.company_name || ""} onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Email</label>
                      <input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Phone</label>
                      <input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="+61..." />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Role</label>
                      <select value={editData.role || "client"} onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="client">Client</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction("update", user.id, editData)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover">
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-background">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{user.full_name || "Unnamed"}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          user.role === "admin" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                        }`}>
                          {user.role === "admin" ? "Admin" : "Client"}
                        </span>
                        {user.confirmed ? (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <XCircle className="w-2.5 h-2.5" /> Unverified
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>
                        {user.company_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {user.company_name}</span>}
                        {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</span>}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Joined {new Date(user.created_at).toLocaleDateString("en-AU")}
                        {user.last_sign_in && ` · Last login ${new Date(user.last_sign_in).toLocaleDateString("en-AU")}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 ml-4">
                      <button onClick={() => startEdit(user)} title="Edit"
                        className="p-2 rounded-lg hover:bg-background text-muted hover:text-foreground transition-colors">
                        <User className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction("reset_password", user.id)} title="Send password reset"
                        className="p-2 rounded-lg hover:bg-background text-muted hover:text-foreground transition-colors">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {!user.confirmed && (
                        <button onClick={() => handleAction("confirm_email", user.id)} title="Confirm email"
                          className="p-2 rounded-lg hover:bg-background text-success hover:text-success/80 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {user.role !== "admin" && (
                        <button onClick={() => {
                          if (confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`))
                            handleAction("delete", user.id);
                        }} title="Delete"
                          className="p-2 rounded-lg hover:bg-danger/10 text-muted hover:text-danger transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

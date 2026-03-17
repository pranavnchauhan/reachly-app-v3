"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  FileCheck,
  CreditCard,
  AlertTriangle,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/niches", label: "Niche Templates", icon: Target },
  { href: "/admin/leads", label: "Lead Validation", icon: FileCheck },
  { href: "/admin/clients", label: "Clients", icon: Users },
];

const clientLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "My Leads", icon: Zap },
  { href: "/dashboard/credits", label: "Credits", icon: CreditCard },
  { href: "/dashboard/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "admin" ? adminLinks : clientLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <Image
          src="/logo-reachly.png"
          alt="Reachly"
          width={120}
          height={42}
          className="mb-2"
        />
        <p className="text-xs text-muted">{userName}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href ||
            (link.href !== "/admin" && link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-light text-primary"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-background hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

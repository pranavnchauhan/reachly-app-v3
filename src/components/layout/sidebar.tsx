"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  FileCheck,
  Archive,
  CreditCard,
  AlertTriangle,
  Settings,
  LogOut,
  Zap,
  ShoppingCart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/niches", label: "Niche Templates", icon: Target },
  { href: "/admin/leads", label: "Lead Validation", icon: FileCheck },
  { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/users", label: "Users", icon: Settings },
  { href: "/admin/orphaned", label: "Orphaned Data", icon: Archive },
];

const staffLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Lead Validation", icon: FileCheck },
  { href: "/admin/clients", label: "Clients", icon: Users },
];

const clientLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "My Leads", icon: Zap },
  { href: "/dashboard/credits", label: "Credits", icon: CreditCard },
  { href: "/dashboard/buy-credits", label: "Buy Credits", icon: ShoppingCart },
  { href: "/dashboard/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const linksByRole: Record<string, typeof adminLinks> = {
  admin: adminLinks,
  staff: staffLinks,
  client: clientLinks,
};

export function Sidebar({ role, userName }: { role: UserRole; userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = linksByRole[role] || clientLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="w-72 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="px-6 pt-8 pb-6 border-b border-border flex flex-col items-center">
        <Image
          src="/logo-reachly.png"
          alt="Reachly"
          width={220}
          height={78}
          className="mb-4 w-[220px] h-auto"
          priority
        />
        <p className="text-lg font-bold text-foreground">{userName}</p>
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

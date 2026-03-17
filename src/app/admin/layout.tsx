import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" userName={user.full_name} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

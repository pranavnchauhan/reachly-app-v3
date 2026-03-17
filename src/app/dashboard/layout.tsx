import { getUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // Redirect admins to admin panel
  if (user.role === "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.full_name} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

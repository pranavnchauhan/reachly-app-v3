import { redirect } from "next/navigation";

// Self-registration disabled — clients are onboarded by admin/staff
export default function SignupPage() {
  redirect("/auth/login");
}

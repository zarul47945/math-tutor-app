import { ChangePasswordForm } from "@/components/change-password-form";
import {
  dashboardHrefForRole,
  requireAuthenticatedProfile,
} from "@/lib/supabase/teacher-server";

export default async function ChangePasswordPage() {
  const { profile } = await requireAuthenticatedProfile();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      <ChangePasswordForm dashboardHref={dashboardHrefForRole(profile.role)} />
    </main>
  );
}

import { redirect } from "next/navigation";

import { StudentAuthForm } from "@/components/student-auth-form";
import { createClient } from "@/lib/supabase/server";
import { dashboardHrefForRole, ensureProfile } from "@/lib/supabase/teacher-server";

export default async function StudentLoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims?.sub) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const profile = await ensureProfile(supabase, user);
      redirect(dashboardHrefForRole(profile.role));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <StudentAuthForm />
    </main>
  );
}

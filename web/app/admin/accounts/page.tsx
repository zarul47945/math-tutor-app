import Link from "next/link";

import { AdminCreateAccountForm } from "@/components/admin-create-account-form";
import { requireAdminContext } from "@/lib/supabase/teacher-server";

export default async function AdminAccountsPage() {
  await requireAdminContext();

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
          >
            Back to admin dashboard
          </Link>
        </div>

        <AdminCreateAccountForm />
      </div>
    </main>
  );
}

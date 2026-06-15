import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdminContext } from "@/lib/supabase/teacher-server";

export default async function AdminDashboardPage() {
  const { profile } = await requireAdminContext();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="space-y-6">
            <Badge>Admin dashboard</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
                Welcome back, {profile.full_name}.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-soft)]">
                Manage staff and student access, connect students with their
                teachers, and keep the tutoring service organised.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/accounts"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
              >
                Create account
              </Link>
              <Link
                href="/admin/assignments"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-6 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
              >
                Assign students
              </Link>
              <Link
                href="/password/change"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-6 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
              >
                Change password
              </Link>
              <LogoutButton />
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
              Admin profile
            </p>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                {profile.full_name}
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                {profile.email}
              </p>
              <p className="text-sm capitalize text-[var(--color-text-soft)]">
                Account: {profile.role}
              </p>
            </div>
          </Card>
        </section>

        <Card className="space-y-4">
          <p className="text-lg font-semibold text-[var(--color-text)]">
            Administration
          </p>
          <ul className="space-y-3 text-sm leading-6 text-[var(--color-text-soft)]">
            <li>Create accounts for teachers, students, and administrators.</li>
            <li>Assign each student to the correct teacher.</li>
            <li>Keep account creation private and controlled.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}

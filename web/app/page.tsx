import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(22,93,255,0.12),_transparent_40%),linear-gradient(180deg,_#f7f9fd_0%,_#eef3fb_100%)] px-6 py-8 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(18,32,51,0.12)] backdrop-blur md:p-10">
        <header className="flex flex-col gap-5 border-b border-[var(--color-border)] pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge>Browser-first tutoring platform</Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-[var(--color-text)] md:text-6xl md:leading-[1.05]">
                Live math tutoring for laptops first, with sessions, video,
                timers, and a canvas ready for real lessons.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--color-text-soft)] md:text-lg">
                This web app is the foundation for your real tutoring business:
                staff auth, student account login, LiveKit calls, session
                tracking, and a structure that can later be wrapped into Tauri
                or Electron for desktop apps.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/teacher/login"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
            >
              Staff login
            </Link>
            <Link
              href="/student/login"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-6 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
            >
              Student login
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--color-primary-soft)] blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Staff flow
                </p>
                <ul className="space-y-3 text-sm leading-6 text-[var(--color-text-soft)]">
                  <li>Teacher and admin email/password auth with Supabase</li>
                  <li>Create sessions and share a short join code</li>
                  <li>See active sessions and enter browser-based LiveKit rooms</li>
                  <li>Start and stop a lesson timer while teaching</li>
                </ul>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Student flow
                </p>
                <ul className="space-y-3 text-sm leading-6 text-[var(--color-text-soft)]">
                  <li>Student account login with Supabase</li>
                  <li>Join lessons assigned directly to the student account</li>
                  <li>Re-enter personal lessons from the student dashboard</li>
                  <li>Use the shared whiteboard canvas inside the lesson room</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="bg-[var(--color-surface-strong)] text-[var(--color-text-inverse)]">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                Product direction
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                Web app first, desktop wrapper later.
              </h2>
              <p className="text-sm leading-7 text-white/72">
                The structure is intentionally browser-safe so you can iterate in
                Chrome and Edge now, then wrap the same app with Tauri or
                Electron for Windows and macOS without rebuilding the product
                from scratch.
              </p>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm">
                  Next.js App Router + Tailwind UI
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm">
                  Supabase auth, sessions, participants, and timer state
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm">
                  LiveKit Web SDK with secure token issuance
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

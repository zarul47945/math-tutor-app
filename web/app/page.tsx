import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  GraduationCap,
  MonitorPlay,
  PenTool,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const lessonFeatures = [
  {
    icon: MonitorPlay,
    label: "Meet face to face",
    text: "See and hear each other clearly during every lesson.",
    tone: "bg-[#e5f1ff] text-[#1769aa]",
  },
  {
    icon: PenTool,
    label: "Work together",
    text: "Write, draw, explain, and solve questions on one shared board.",
    tone: "bg-[#e0f5ed] text-[#16805d]",
  },
  {
    icon: CalendarCheck,
    label: "Stay organised",
    text: "Lessons, timing, worksheets, and student progress stay in one place.",
    tone: "bg-[#fff0df] text-[#b85f12]",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
              <GraduationCap size={24} strokeWidth={2.3} />
            </span>
            <span className="truncate text-lg font-bold">Math Tutor</span>
          </Link>

          <Link
            href="/teacher/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            Staff sign in
            <ArrowRight className="ml-2" size={16} />
          </Link>
        </div>
      </header>

      <section className="relative border-b border-[var(--color-border)] bg-white">
        <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[linear-gradient(135deg,#e8f2ff_0%,#d8f5ee_100%)] lg:block" />
        <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-primary)]">
              <Sparkles size={17} />
              Personal online mathematics lessons
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Learn mathematics together, wherever you are.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-text-soft)] sm:text-lg">
              A focused classroom for live teaching, shared working, timed
              practice, and lessons matched to each student&apos;s level.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:max-w-xl">
              <Link
                href="/student/login"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 text-base font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
              >
                <GraduationCap className="mr-2" size={20} />
                Student sign in
              </Link>
              <Link
                href="/teacher/login"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[var(--color-border-strong)] bg-white px-6 text-base font-semibold transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Users className="mr-2" size={20} />
                Teacher or admin
              </Link>
            </div>

            <p className="mt-5 text-sm text-[var(--color-text-soft)]">
              Works in your web browser on phones, tablets, and computers.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border-[6px] border-white bg-white shadow-[0_28px_75px_rgba(18,32,51,0.22)]">
              <Image
                alt="A student learning mathematics online with a teacher using video and a shared digital worksheet"
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                src="/images/online-math-tutoring-hero.png"
              />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-white/95 px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur">
                <BookOpenCheck className="text-[var(--color-success)]" size={20} />
                Live guided learning
              </div>
            </div>
            <div className="absolute -bottom-5 -right-2 hidden items-center gap-3 rounded-2xl border border-white bg-[#fff5de] px-4 py-3 shadow-lg sm:flex">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#ffd977] text-[#8b5700]">
                <ShieldCheck size={21} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8b5700]">
                  Personal
                </p>
                <p className="text-sm font-bold">One student at a time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-3">
          {lessonFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.label} className="bg-white p-6 sm:p-8">
                <span
                  className={`flex size-12 items-center justify-center rounded-xl ${feature.tone}`}
                >
                  <Icon size={24} strokeWidth={2.1} />
                </span>
                <h2 className="mt-5 text-xl font-bold">{feature.label}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-soft)]">
                  {feature.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-[var(--color-text-soft)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Math Tutor online classroom</p>
          <div className="flex gap-5">
            <Link href="/password/forgot" className="hover:text-[var(--color-text)]">
              Reset password
            </Link>
            <Link href="/student/login" className="hover:text-[var(--color-text)]">
              Student access
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

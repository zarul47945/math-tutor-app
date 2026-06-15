import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { TeacherAuthForm } from "@/components/teacher-auth-form";
import { createClient } from "@/lib/supabase/server";
import { dashboardHrefForRole, ensureProfile } from "@/lib/supabase/teacher-server";

export default async function TeacherLoginPage() {
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
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden bg-[var(--color-surface-strong)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Image
          alt=""
          className="object-cover opacity-30"
          fill
          priority
          sizes="42vw"
          src="/images/online-math-tutoring-hero.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,42,72,0.38),rgba(17,42,72,0.98))]" />
        <Link href="/" className="relative z-10 text-xl font-bold">
          Math Tutor
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-semibold uppercase text-white/65">
            Staff access
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Teach, guide, and manage every lesson in one place.
          </h1>
          <p className="mt-5 leading-7 text-white/70">
            Open your classes, meet students, use the shared board, and keep
            each learner&apos;s work organised.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/65">
          Available on phones, tablets, and computers.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6">
        <TeacherAuthForm />
      </section>
    </main>
  );
}

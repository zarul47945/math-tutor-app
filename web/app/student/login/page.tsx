import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

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
    <main className="grid min-h-screen bg-white lg:grid-cols-[0.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden bg-[#174c42] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Image
          alt=""
          className="object-cover opacity-35"
          fill
          priority
          sizes="42vw"
          src="/images/online-math-tutoring-hero.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,67,58,0.35),rgba(12,67,58,0.98))]" />
        <Link href="/" className="relative z-10 text-xl font-bold">
          Math Tutor
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-semibold uppercase text-white/65">
            Student access
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Your mathematics lessons are ready when you are.
          </h1>
          <p className="mt-5 leading-7 text-white/70">
            Join your teacher, work through questions, and see all assigned
            lessons from your personal space.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/65">
          Learn from any phone, tablet, or computer.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-8 sm:px-6">
        <StudentAuthForm />
      </section>
    </main>
  );
}

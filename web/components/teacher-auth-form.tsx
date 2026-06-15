"use client";

import { ArrowLeft, GraduationCap, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TeacherAuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const supabase = createClient();
      setFeedback(null);

      if (!email.trim() || !password.trim()) {
        setFeedback("Please enter your email and password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      router.push("/teacher/dashboard");
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-lg p-5 sm:p-8">
      <Link
        href="/"
        className="mb-8 inline-flex text-sm font-semibold text-[var(--color-primary)] lg:hidden"
      >
        <ArrowLeft className="mr-2" size={16} />
        Back to Math Tutor
      </Link>
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase text-[var(--color-primary)]">
          Teacher and admin
        </p>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          Welcome back
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Sign in to manage students, prepare lessons, or oversee the tutoring
          service.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teacher@example.com"
          />
        </Field>

        <Field
          label="Password"
          hint="Enter the password for your account."
        >
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />
        </Field>

        <div className="flex justify-end">
          <Link
            href="/password/forgot"
            className="text-sm font-semibold text-[var(--color-primary)] transition hover:text-[var(--color-primary-strong)]"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
          <LogIn className="mr-2" size={18} />
          {isPending ? "Logging in..." : "Login"}
        </Button>
        <Link
          href="/student/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          <GraduationCap className="mr-2" size={18} />
          I am a student
        </Link>
      </div>
    </Card>
  );
}

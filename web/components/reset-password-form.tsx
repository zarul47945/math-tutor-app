"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function loginHrefForRole(role: unknown) {
  return role === "student" ? "/student/login" : "/teacher/login";
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || Boolean(session)) {
        setIsReady(true);
        setFeedback(null);
      }
    });

    async function bootstrapRecoverySession() {
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (isMounted) {
            setFeedback(error.message);
          }
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session) {
        setIsReady(true);
        return;
      }

      setFeedback(
        "Open the newest password recovery email and use that link to continue here.",
      );
    }

    void bootstrapRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, supabase]);

  const handleSubmit = () => {
    startTransition(async () => {
      setFeedback(null);

      if (!password.trim() || !confirmPassword.trim()) {
        setFeedback("Please enter and confirm your new password.");
        return;
      }

      if (password.trim().length < 8) {
        setFeedback("Password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setFeedback("The password confirmation does not match.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const loginHref = loginHrefForRole(user?.user_metadata.role);
      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      await supabase.auth.signOut();
      router.push(loginHref);
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-xl p-5 sm:p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Set new password
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Use the recovery link from your email, then choose a fresh password
          for your account.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="New password" hint="Use at least 8 characters.">
          <Input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            type="password"
            value={password}
          />
        </Field>

        <Field label="Confirm new password">
          <Input
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            type="password"
            value={confirmPassword}
          />
        </Field>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          className="flex-1"
          disabled={isPending || !isReady}
          onClick={handleSubmit}
        >
          {isPending ? "Saving password..." : "Save new password"}
        </Button>
        <Link
          href="/password/forgot"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          Send another link
        </Link>
      </div>
    </Card>
  );
}

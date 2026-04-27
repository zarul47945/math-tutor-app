"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AppRole } from "@/lib/types";

type CreatedUser = {
  email: string;
  full_name: string;
  id: string;
  role: AppRole;
};

export function AdminCreateAccountForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("teacher");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setFeedback(null);
      setCreatedUser(null);

      const response = await fetch("/api/admin/accounts", {
        body: JSON.stringify({
          email,
          fullName,
          password,
          role,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as
        | { error: string }
        | { success: true; user: CreatedUser };

      if (!response.ok || "error" in result) {
        setFeedback("error" in result ? result.error : "Unable to create account.");
        return;
      }

      setCreatedUser(result.user);
      setFeedback("Account created successfully.");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("teacher");
    });
  };

  return (
    <Card className="max-w-3xl p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Create account
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Admin-only account creation for teachers, students, and future admin
          staff. The password is set here and the profile is created in Supabase
          automatically.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Full name">
          <Input
            autoComplete="name"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="e.g. Maria Santos"
            value={fullName}
          />
        </Field>

        <Field label="Email">
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            type="email"
            value={email}
          />
        </Field>

        <Field label="Password" hint="Minimum 8 characters.">
          <Input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            type="password"
            value={password}
          />
        </Field>

        <Field label="Role">
          <select
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
            onChange={(event) => setRole(event.target.value as AppRole)}
            value={role}
          >
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      </div>

      <div className="mt-8">
        <Button className="sm:w-auto" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Creating account..." : "Create account"}
        </Button>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      {createdUser ? (
        <div className="mt-6 rounded-[24px] border border-[var(--color-border)] p-5">
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {createdUser.full_name}
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--color-text-soft)]">
            <p>Email: {createdUser.email}</p>
            <p>Role: {createdUser.role}</p>
            <p>User ID: {createdUser.id}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

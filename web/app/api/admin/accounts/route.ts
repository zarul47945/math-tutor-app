import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/teacher-server";
import type { AppRole } from "@/lib/types";

type CreateAccountPayload = {
  email?: string;
  fullName?: string;
  password?: string;
  role?: AppRole;
};

const CREATEABLE_ROLES: AppRole[] = ["admin", "teacher", "student"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create accounts." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as CreateAccountPayload;
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();
    const password = body.password?.trim();
    const role = body.role;

    if (!email || !fullName || !password || !role) {
      return NextResponse.json(
        { error: "Full name, email, password, and role are required." },
        { status: 400 },
      );
    }

    if (!CREATEABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role selected." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Supabase did not return the newly created user." },
        { status: 500 },
      );
    }

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: data.user.id,
        full_name: fullName,
        email,
        role,
      },
      {
        onConflict: "id",
      },
    );

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: {
        email,
        full_name: fullName,
        id: data.user.id,
        role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the account right now.",
      },
      { status: 500 },
    );
  }
}

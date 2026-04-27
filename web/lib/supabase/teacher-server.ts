import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import type { AdminProfile, AppProfile, AppRole, StudentProfile, TeacherProfile } from "@/lib/types";
import { createClient as createServerClient } from "@/lib/supabase/server";

const VALID_ROLES = new Set<AppRole>(["admin", "teacher", "student"]);

function fallbackProfileName(user: User) {
  const fullName = user.user_metadata.full_name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "User";
}

function resolveProfileRole(user: User, existingRole?: string | null): AppRole {
  if (existingRole && VALID_ROLES.has(existingRole as AppRole)) {
    return existingRole as AppRole;
  }

  const metadataRole = user.user_metadata.role;

  if (typeof metadataRole === "string" && VALID_ROLES.has(metadataRole as AppRole)) {
    return metadataRole as AppRole;
  }

  return "teacher";
}

export function dashboardHrefForRole(role: AppRole) {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "student":
      return "/student/dashboard";
    case "teacher":
    default:
      return "/teacher/dashboard";
  }
}

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<AppProfile> {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (
    existingProfile &&
    typeof existingProfile.role === "string" &&
    VALID_ROLES.has(existingProfile.role as AppRole)
  ) {
    return existingProfile as AppProfile;
  }

  const profileRole = resolveProfileRole(user, existingProfile?.role);
  const nextFullName =
    existingProfile?.full_name?.trim() || fallbackProfileName(user);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: nextFullName,
        email: user.email ?? existingProfile?.email ?? "",
        role: profileRole,
      },
      {
        onConflict: "id",
      },
    )
    .select("id, full_name, email, role, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as AppProfile;
}

export async function requireAuthenticatedProfile() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect("/teacher/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/teacher/login");
  }

  const profile = await ensureProfile(supabase, user);

  return {
    profile,
    supabase,
    user,
  };
}

export async function requireTeacherContext() {
  const context = await requireAuthenticatedProfile();

  if (context.profile.role !== "teacher") {
    redirect(dashboardHrefForRole(context.profile.role));
  }

  return {
    ...context,
    profile: context.profile as TeacherProfile,
  };
}

export async function requireAdminContext() {
  const context = await requireAuthenticatedProfile();

  if (context.profile.role !== "admin") {
    redirect(dashboardHrefForRole(context.profile.role));
  }

  return {
    ...context,
    profile: context.profile as AdminProfile,
  };
}

export async function requireStudentContext() {
  const context = await requireAuthenticatedProfile();

  if (context.profile.role !== "student") {
    redirect(dashboardHrefForRole(context.profile.role));
  }

  return {
    ...context,
    profile: context.profile as StudentProfile,
  };
}

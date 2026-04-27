import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, AppProfile, TeacherStudentAssignment } from "@/lib/types";

export async function listProfilesByRole(role: AppRole) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("role", role)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AppProfile[];
}

export async function listTeacherStudentAssignments() {
  const supabase = createAdminClient();
  const { data: assignments, error: assignmentError } = await supabase
    .from("teacher_students")
    .select("id, teacher_id, student_id, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (assignmentError) {
    throw assignmentError;
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role");

  if (profileError) {
    throw profileError;
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return ((assignments ?? []) as Array<{
    id: string;
    teacher_id: string;
    student_id: string;
    status: "active" | "inactive";
    created_at: string;
  }>).map((assignment) => {
    const student = profileById.get(assignment.student_id);
    const teacher = profileById.get(assignment.teacher_id);

    return {
      assignment_id: assignment.id,
      created_at: assignment.created_at,
      status: assignment.status,
      student_email: student?.email ?? "",
      student_id: assignment.student_id,
      student_name: student?.full_name ?? "Student",
      teacher_email: teacher?.email ?? "",
      teacher_id: assignment.teacher_id,
      teacher_name: teacher?.full_name ?? "Teacher",
    };
  }) as Array<
    TeacherStudentAssignment & {
      teacher_email: string;
      teacher_id: string;
      teacher_name: string;
    }
  >;
}

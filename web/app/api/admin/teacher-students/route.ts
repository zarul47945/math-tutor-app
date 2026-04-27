import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/supabase/teacher-server";

type AssignmentPayload = {
  studentId?: string;
  teacherId?: string;
};

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
        { error: "Only admins can assign students to teachers." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as AssignmentPayload;
    const teacherId = body.teacherId?.trim();
    const studentId = body.studentId?.trim();

    if (!teacherId || !studentId) {
      return NextResponse.json(
        { error: "Teacher and student are required." },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: selectedProfiles, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .in("id", [teacherId, studentId]);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const teacherProfile = selectedProfiles?.find((entry) => entry.id === teacherId);
    const studentProfile = selectedProfiles?.find((entry) => entry.id === studentId);

    if (teacherProfile?.role !== "teacher" || studentProfile?.role !== "student") {
      return NextResponse.json(
        { error: "The selected accounts must be a teacher and a student." },
        { status: 400 },
      );
    }

    const { error: clearError } = await adminClient
      .from("teacher_students")
      .update({ status: "inactive" })
      .eq("student_id", studentId)
      .eq("status", "active");

    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 400 });
    }

    const { data: assignment, error: assignmentError } = await adminClient
      .from("teacher_students")
      .upsert(
        {
          teacher_id: teacherId,
          student_id: studentId,
          status: "active",
        },
        {
          onConflict: "teacher_id,student_id",
        },
      )
      .select("id, teacher_id, student_id, status, created_at")
      .single();

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }

    return NextResponse.json({
      assignment,
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the teacher-student assignment right now.",
      },
      { status: 500 },
    );
  }
}

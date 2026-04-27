import type { SupabaseClient } from "@supabase/supabase-js";

import { generateJoinCode } from "@/lib/session-code";
import type {
  JoinSessionResult,
  SessionParticipant,
  SessionRoomState,
  StudentSessionSummary,
  TeacherSession,
  TeacherStudentAssignment,
} from "@/lib/types";

export async function listTeacherSessions(
  supabase: SupabaseClient,
  teacherId: string,
) {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, teacher_id, student_id, title, join_code, status, created_at, timer_running, timer_started_at, elapsed_seconds, session_participants(count)",
    )
    .eq("teacher_id", teacherId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TeacherSession[];
}

export async function createTeacherSession(
  supabase: SupabaseClient,
  teacherId: string,
  title: string,
  studentId: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        teacher_id: teacherId,
        student_id: studentId,
        title: title.trim(),
        join_code: joinCode,
        status: "active",
      })
      .select(
        "id, teacher_id, student_id, title, join_code, status, created_at, timer_running, timer_started_at, elapsed_seconds",
      )
      .single();

    if (!error) {
      return data as TeacherSession;
    }

    if (error.code !== "23505") {
      throw error;
    }
  }

      throw new Error("Unable to generate a unique join code. Please try again.");
}

export async function joinSessionAsStudentAccount(
  supabase: SupabaseClient,
  sessionId: string,
) {
  const { data, error } = await supabase
    .rpc("join_assigned_session_as_authenticated_student", {
      input_session_id: sessionId,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as JoinSessionResult | null) ?? null;
}

export async function getActiveSessionRoomState(
  supabase: SupabaseClient,
  sessionId: string,
  joinCode: string,
) {
  const { data, error } = await supabase
    .rpc("get_active_session_room_state", {
      input_join_code: joinCode.trim().toUpperCase(),
      input_session_id: sessionId,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SessionRoomState | null) ?? null;
}

export async function updateSessionTimer(
  supabase: SupabaseClient,
  sessionId: string,
  joinCode: string,
  payload: Pick<
    SessionRoomState,
    "elapsed_seconds" | "timer_running" | "timer_started_at"
  >,
  participantId?: string,
) {
  const { data, error } = await supabase
    .rpc("update_active_session_timer", {
      input_elapsed_seconds: payload.elapsed_seconds,
      input_join_code: joinCode.trim().toUpperCase(),
      input_participant_id: participantId ?? null,
      input_session_id: sessionId,
      input_timer_running: payload.timer_running,
      input_timer_started_at: payload.timer_started_at,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Unable to update the shared lesson timer for this session.");
  }

  return data as SessionRoomState;
}

export async function listSessionParticipants(
  supabase: SupabaseClient,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("session_participants")
    .select("id, session_id, display_name, role, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SessionParticipant[];
}

export async function listAssignedStudentsForTeacher(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase
    .rpc("list_assigned_students_for_teacher")
    .select();

  if (error) {
    throw error;
  }

  return (data ?? []) as TeacherStudentAssignment[];
}

export async function listAssignedStudentSessions(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, title, join_code, status, created_at, timer_running, timer_started_at, elapsed_seconds",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    title: string;
    join_code: string;
    status: StudentSessionSummary["status"];
    created_at: string;
    timer_running: boolean;
    timer_started_at: string | null;
    elapsed_seconds: number;
  }>).map((session) => ({
    session_id: session.id,
    title: session.title,
    join_code: session.join_code,
    status: session.status,
    created_at: session.created_at,
    timer_running: session.timer_running,
    timer_started_at: session.timer_started_at,
    elapsed_seconds: session.elapsed_seconds,
  }));
}

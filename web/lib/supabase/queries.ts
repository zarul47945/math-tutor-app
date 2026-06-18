import type { SupabaseClient } from "@supabase/supabase-js";

import { generateJoinCode } from "@/lib/session-code";
import type {
  LessonWorksheet,
  JoinSessionResult,
  SessionParticipant,
  SessionRoomState,
  StudentSessionSummary,
  TeacherSession,
  TeacherStudentAssignment,
} from "@/lib/types";
import type { TherapySet } from "@/lib/therapy-demo";
import type { WorksheetAttachment } from "@/lib/worksheet-files";

function buildWorksheetQuestionRows(worksheetId: string, sets: TherapySet[]) {
  return sets.flatMap((set, setIndex) =>
    set.questions.map((question, questionIndex) => ({
      augend: question.augend,
      best_time_label: set.bestTimeLabel,
      expected_answer: question.expectedAnswer,
      position: questionIndex,
      result: question.result,
      set_key: set.id,
      set_order: setIndex,
      set_title: set.title,
      worksheet_id: worksheetId,
    })),
  );
}

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

export async function getTeacherSession(
  supabase: SupabaseClient,
  teacherId: string,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, teacher_id, student_id, title, join_code, status, created_at, timer_running, timer_started_at, elapsed_seconds, session_participants(count)",
    )
    .eq("id", sessionId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as TeacherSession | null) ?? null;
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

export async function createSessionWorksheet({
  attachment,
  instructions,
  sessionId,
  sets,
  supabase,
  teacherId,
  title,
}: {
  attachment?: WorksheetAttachment;
  instructions?: string;
  sessionId: string;
  sets: TherapySet[];
  supabase: SupabaseClient;
  teacherId: string;
  title: string;
}) {
  const { data: worksheet, error: worksheetError } = await supabase
    .from("session_worksheets")
    .insert({
      file_mime_type: attachment?.file_mime_type ?? null,
      file_name: attachment?.file_name ?? null,
      file_path: attachment?.file_path ?? null,
      file_size_bytes: attachment?.file_size_bytes ?? null,
      instructions: instructions?.trim() || null,
      session_id: sessionId,
      teacher_id: teacherId,
      title: title.trim() || "Skills practice",
    })
    .select(
      "id, session_id, teacher_id, title, instructions, file_path, file_name, file_mime_type, file_size_bytes, created_at",
    )
    .single();

  if (worksheetError) {
    throw worksheetError;
  }

  const questionRows = buildWorksheetQuestionRows(worksheet.id, sets);

  if (questionRows.length === 0) {
    return worksheet as Omit<LessonWorksheet, "questions">;
  }

  const { error: questionError } = await supabase
    .from("worksheet_questions")
    .insert(questionRows);

  if (questionError) {
    throw questionError;
  }

  return worksheet as Omit<LessonWorksheet, "questions">;
}

export async function replaceSessionWorksheet({
  attachment,
  instructions,
  sessionId,
  sets,
  supabase,
  teacherId,
  title,
}: {
  attachment?: WorksheetAttachment;
  instructions?: string;
  sessionId: string;
  sets: TherapySet[];
  supabase: SupabaseClient;
  teacherId: string;
  title: string;
}) {
  const existingWorksheet = await getSessionWorksheet(supabase, sessionId);

  if (!existingWorksheet) {
    return createSessionWorksheet({
      attachment,
      instructions,
      sessionId,
      sets,
      supabase,
      teacherId,
      title,
    });
  }

  const attachmentFields =
    attachment === undefined
      ? {}
      : {
          file_mime_type: attachment.file_mime_type,
          file_name: attachment.file_name,
          file_path: attachment.file_path,
          file_size_bytes: attachment.file_size_bytes,
        };

  const { data: worksheet, error: worksheetError } = await supabase
    .from("session_worksheets")
    .update({
      ...attachmentFields,
      instructions: instructions?.trim() || null,
      title: title.trim() || "Skills practice",
    })
    .eq("id", existingWorksheet.id)
    .eq("teacher_id", teacherId)
    .select(
      "id, session_id, teacher_id, title, instructions, file_path, file_name, file_mime_type, file_size_bytes, created_at",
    )
    .single();

  if (worksheetError) {
    throw worksheetError;
  }

  const { error: deleteError } = await supabase
    .from("worksheet_questions")
    .delete()
    .eq("worksheet_id", existingWorksheet.id);

  if (deleteError) {
    throw deleteError;
  }

  const questionRows = buildWorksheetQuestionRows(existingWorksheet.id, sets);

  if (questionRows.length === 0) {
    return worksheet as Omit<LessonWorksheet, "questions">;
  }

  const { error: questionError } = await supabase
    .from("worksheet_questions")
    .insert(questionRows);

  if (questionError) {
    throw questionError;
  }

  return worksheet as Omit<LessonWorksheet, "questions">;
}

export async function getSessionWorksheet(
  supabase: SupabaseClient,
  sessionId: string,
) {
  const { data, error } = await supabase
    .from("session_worksheets")
    .select(
      "id, session_id, teacher_id, title, instructions, file_path, file_name, file_mime_type, file_size_bytes, created_at, worksheet_questions(id, worksheet_id, set_key, set_title, set_order, position, augend, result, expected_answer, best_time_label)",
    )
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const rawWorksheet = data as Omit<LessonWorksheet, "questions"> & {
    worksheet_questions?: LessonWorksheet["questions"];
  };

  return {
    created_at: rawWorksheet.created_at,
    file_mime_type: rawWorksheet.file_mime_type,
    file_name: rawWorksheet.file_name,
    file_path: rawWorksheet.file_path,
    file_size_bytes: rawWorksheet.file_size_bytes,
    id: rawWorksheet.id,
    instructions: rawWorksheet.instructions,
    questions: (rawWorksheet.worksheet_questions ?? []).sort(
      (leftQuestion, rightQuestion) =>
        leftQuestion.set_order - rightQuestion.set_order ||
        leftQuestion.position - rightQuestion.position,
    ),
    session_id: rawWorksheet.session_id,
    teacher_id: rawWorksheet.teacher_id,
    title: rawWorksheet.title,
  } satisfies LessonWorksheet;
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

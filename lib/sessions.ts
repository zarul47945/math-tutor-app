import { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { StudentJoinResult, TeacherSession } from '@/types/session';

type CreateTeacherSessionInput = {
  teacherId: string;
  title: string;
};

const SESSION_CODE_PREFIX = 'MATH';
const MAX_CREATE_ATTEMPTS = 5;

export function generateJoinCode() {
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `${SESSION_CODE_PREFIX}-${randomNumber}`;
}

function isUniqueViolation(error: PostgrestError | null) {
  return error?.code === '23505';
}

export async function createTeacherSession({ teacherId, title }: CreateTeacherSessionInput) {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        teacher_id: teacherId,
        title: title.trim(),
        join_code: joinCode,
        status: 'active',
      })
      .select('id, teacher_id, title, join_code, status, created_at')
      .single();

    if (!error) {
      return data as TeacherSession;
    }

    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  throw new Error('Unable to generate a unique join code. Please try again.');
}

export async function listTeacherActiveSessions(teacherId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, teacher_id, title, join_code, status, created_at')
    .eq('teacher_id', teacherId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TeacherSession[];
}

type JoinStudentSessionInput = {
  joinCode: string;
  displayName: string;
};

export async function joinSessionAsStudent({ joinCode, displayName }: JoinStudentSessionInput) {
  const normalizedCode = joinCode.trim().toUpperCase();
  const trimmedDisplayName = displayName.trim();

  const { data, error } = await supabase
    .rpc('join_active_session_as_student', {
      input_join_code: normalizedCode,
      input_display_name: trimmedDisplayName,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as StudentJoinResult | null) ?? null;
}

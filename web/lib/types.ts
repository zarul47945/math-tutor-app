export type AppRole = "admin" | "teacher" | "student";

export type AppProfile = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  created_at?: string;
};

export type TeacherProfile = AppProfile & {
  role: "teacher";
};

export type AdminProfile = AppProfile & {
  role: "admin";
};

export type StudentProfile = AppProfile & {
  role: "student";
};

export type SessionStatus = "active" | "ended";

export type TeacherSession = {
  id: string;
  teacher_id: string;
  student_id?: string | null;
  title: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
  timer_running: boolean;
  timer_started_at: string | null;
  elapsed_seconds: number;
  session_participants?: { count: number }[];
};

export type TeacherStudentAssignment = {
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: "active" | "inactive";
  created_at: string;
};

export type SessionParticipant = {
  id: string;
  session_id: string;
  student_id?: string | null;
  display_name: string;
  role: "student";
  joined_at: string;
};

export type JoinSessionResult = {
  session: {
    id: string;
    title: string;
    join_code: string;
    status: SessionStatus;
    created_at: string;
  };
  participant: SessionParticipant;
};

export type SessionRoomState = {
  id: string;
  title: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
  timer_running: boolean;
  timer_started_at: string | null;
  elapsed_seconds: number;
};

export type LiveKitTokenResponse = {
  identity: string;
  participantName: string;
  roomName: string;
  token: string;
  url: string;
};

export type LiveKitRole = "teacher" | "student";

export type LiveKitTokenRequest =
  | {
      role: "teacher";
      sessionId: string;
      joinCode: string;
    }
  | {
      role: "student";
      sessionId: string;
      joinCode: string;
      participantId: string;
    };

export type StudentSessionSummary = {
  session_id: string;
  participant_id?: string | null;
  title: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
  joined_at?: string | null;
  timer_running: boolean;
  timer_started_at: string | null;
  elapsed_seconds: number;
};

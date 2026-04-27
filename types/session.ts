export type SessionStatus = 'active' | 'ended';

export type TeacherSession = {
  id: string;
  teacher_id: string;
  title: string;
  join_code: string;
  status: SessionStatus;
  created_at: string;
};

export type GuestJoinSession = Pick<TeacherSession, 'id' | 'title' | 'join_code' | 'status' | 'created_at'>;

export type SessionParticipantRole = 'student';

export type SessionParticipant = {
  id: string;
  session_id: string;
  display_name: string;
  role: SessionParticipantRole;
  joined_at: string;
};

export type StudentJoinResult = {
  session: GuestJoinSession;
  participant: SessionParticipant;
};

export type LiveKitParticipantRole = 'teacher' | 'student';

export type LiveKitTokenRequest =
  | {
      role: 'teacher';
      sessionId: string;
      joinCode: string;
    }
  | {
      role: 'student';
      sessionId: string;
      joinCode: string;
      participantId: string;
    };

export type LiveKitTokenResponse = {
  identity: string;
  participantName: string;
  roomName: string;
  token: string;
  url: string;
};

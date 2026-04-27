import { redirect } from "next/navigation";

import { LiveRoom } from "@/components/room/live-room";
import {
  requireStudentContext,
  requireTeacherContext,
} from "@/lib/supabase/teacher-server";
import type { LiveKitRole } from "@/lib/types";

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const role = readSearchParam(resolvedSearchParams.role) as
    | LiveKitRole
    | undefined;
  const joinCode = readSearchParam(resolvedSearchParams.joinCode);
  const participantId = readSearchParam(resolvedSearchParams.participantId);
  const sessionTitle = readSearchParam(resolvedSearchParams.sessionTitle);
  let studentName = readSearchParam(resolvedSearchParams.studentName);

  if (!role || !joinCode) {
    redirect("/");
  }

  if (role === "teacher") {
    await requireTeacherContext();
  } else {
    if (!participantId) {
      redirect("/student/dashboard");
    }

    const { profile } = await requireStudentContext();
    studentName = profile.full_name;
  }

  return (
    <LiveRoom
      joinCode={joinCode}
      participantId={participantId}
      role={role}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      studentName={studentName}
    />
  );
}

import { redirect } from "next/navigation";

import { EditWorksheetForm } from "@/components/edit-worksheet-form";
import {
  getSessionWorksheet,
  getTeacherSession,
} from "@/lib/supabase/queries";
import { requireTeacherContext } from "@/lib/supabase/teacher-server";

export default async function EditSessionWorksheetPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { profile, supabase } = await requireTeacherContext();
  const [session, worksheet] = await Promise.all([
    getTeacherSession(supabase, profile.id, sessionId),
    getSessionWorksheet(supabase, sessionId),
  ]);

  if (!session) {
    redirect("/teacher/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <EditWorksheetForm
        session={session}
        teacherId={profile.id}
        worksheet={worksheet}
      />
    </main>
  );
}

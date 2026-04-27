import { CreateSessionForm } from "@/components/create-session-form";
import { listAssignedStudentsForTeacher } from "@/lib/supabase/queries";
import { requireTeacherContext } from "@/lib/supabase/teacher-server";

export default async function CreateSessionPage() {
  const { profile, supabase } = await requireTeacherContext();
  const assignedStudents = await listAssignedStudentsForTeacher(supabase);

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <CreateSessionForm assignedStudents={assignedStudents} teacherId={profile.id} />
      </div>
    </main>
  );
}

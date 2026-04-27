# Math Tutor Web

Laptop-first tutoring platform built with Next.js App Router, TypeScript, Supabase, Tailwind, and the LiveKit Web React SDK.

## Stack

- Next.js 16
- TypeScript
- Supabase Auth + Postgres
- LiveKit Web SDK via `@livekit/components-react`
- Tailwind CSS 4

## Features in this web app

- Admin, teacher, and student role foundation
- Staff email/password auth for teachers and admins
- Admin-only account creation flow using the Supabase admin API
- Admin-only teacher-student assignment flow
- Automatic profile creation support from Supabase auth metadata
- Teacher dashboard with active sessions
- Session creation for assigned students
- Student account login and assigned-lesson dashboard
- Browser-based LiveKit lesson room
- Local and remote video tiles
- Microphone and camera controls
- Shared whiteboard overlay
- Teacher timer with persisted recorded time
- Joined student list from Supabase

## Environment setup

Create `web/.env.local` from `web/.env.example` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_LIVEKIT_TOKEN_URL=https://nxrwcdqsvasfzwuwofyu.supabase.co/functions/v1/livekit-token
```

The LiveKit API secret must stay in the Supabase Edge Function, not in this Next.js app.
The Supabase service role key is server-only and must never be exposed in the browser.

## Supabase SQL to run

Run these SQL files in your Supabase project, in this order:

1. `supabase/schema.sql`
2. `supabase/profile-trigger.sql`
3. `supabase/role-foundation.sql`
4. `supabase/sessions.sql`
5. `supabase/session-participants.sql`
6. `supabase/web-room-state.sql`
7. `supabase/teacher-students.sql`
8. `supabase/student-account-join.sql`

These create:

- `profiles`
- automatic profile trigger on `auth.users`
- role-aware profile policies for `admin | teacher | student`
- `sessions`
- `session_participants`
- timer fields and the `get_active_session_room_state` RPC
- teacher-student assignments
- authenticated student room join for assigned sessions

Before moving to admin-only account creation, also turn off public signup in
Supabase Auth settings so only existing users can log in.

Your hosted `livekit-token` Edge Function should already be deployed and using:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

## Run locally

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test a teacher and student call

1. Open the app in two separate browser windows or two different browser profiles.
2. In window 1, log in with a teacher account.
3. From the dashboard, create a session and copy the join code.
4. Enter the teacher room from the active session card or the create-session success view.
5. Allow camera and microphone access in the browser.
6. In window 2, log in with a student account at `/student/login`.
7. Make sure the student has been assigned to the teacher by an admin.
8. Create a session for that assigned student from the teacher dashboard.
9. Open the student dashboard and click `Join lesson`.
10. Confirm both sides can see local video, remote video, and use mic/camera controls.
11. Start the timer as the teacher and confirm it updates in the room.
12. Turn on the whiteboard and confirm drawing syncs between both participants.

## Extra step after this update

The student account room flow changes the LiveKit token function, so redeploy it after updating the code:

```bash
supabase functions deploy livekit-token --project-ref nxrwcdqsvasfzwuwofyu
```

## Desktop-ready structure

The app is organized to stay browser-first while being easy to wrap later with Tauri or Electron:

- `app/` for routes
- `components/` for UI, room controls, video, and whiteboard
- `lib/supabase/` for auth/data access
- `lib/livekit/` for token and room signal helpers

That means the browser app can become the desktop shell later without rewriting the tutoring UI.

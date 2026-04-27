# LiveKit Setup Notes

This app uses a secure Supabase Edge Function at `supabase/functions/livekit-token` to mint LiveKit join tokens.
The function is configured in `supabase/config.toml` with `verify_jwt = false` so guest students can invoke it after creating a participant row.

Why this is safer:
- `LIVEKIT_API_SECRET` stays on the server side inside Supabase function secrets.
- The mobile app only receives a short-lived join token.
- Teachers are checked against session ownership before a token is created.
- Guest students only get a token after they have already joined an active session and created a participant row.

Current room mapping:
- LiveKit room name = `sessions.join_code`
- Teacher identity = `teacher:<supabase-user-id>`
- Student identity = `student:<session-participant-id>`

If you later move token generation to your own backend:
1. Keep the same request shape used by `fetchLiveKitToken()` in `lib/livekit-token.ts`.
2. Keep the same authorization rules:
   - teacher must own the session
   - student must belong to a valid participant row for the active session
3. Return the same JSON shape:
   - `token`
   - `url`
   - `roomName`
   - `identity`
   - `participantName`

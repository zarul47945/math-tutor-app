import { AccessToken } from 'npm:livekit-server-sdk@2';
import { createClient } from 'npm:@supabase/supabase-js@2';

type TokenRequest =
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

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const livekitUrl = Deno.env.get('LIVEKIT_URL');
const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!livekitUrl || !livekitApiKey || !livekitApiSecret || !supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required LiveKit or Supabase function secrets.');
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as TokenRequest;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') ?? '',
        },
      },
    });
    const publicClient = createClient(supabaseUrl, supabaseAnonKey);

    let roomName = body.joinCode.trim().toUpperCase();
    let identity = '';
    let participantName = '';

    if (body.role === 'teacher') {
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return jsonResponse(401, { error: 'Teacher authentication is required.' });
      }

      const { data: session, error: sessionError } = await userClient
        .from('sessions')
        .select('id, title, join_code, teacher_id, status')
        .eq('id', body.sessionId)
        .eq('join_code', roomName)
        .eq('teacher_id', user.id)
        .eq('status', 'active')
        .single();

      if (sessionError || !session) {
        return jsonResponse(403, { error: 'You are not allowed to join this teacher session.' });
      }

      roomName = session.join_code;
      identity = `teacher:${user.id}`;
      participantName =
        typeof user.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()
          ? user.user_metadata.full_name.trim()
          : user.email ?? 'Teacher';
    } else {
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return jsonResponse(401, { error: 'Student authentication is required.' });
      }

      const { data: session, error: sessionError } = await publicClient
        .rpc('get_active_session_room_state', {
          input_join_code: roomName,
          input_session_id: body.sessionId,
        })
        .maybeSingle();

      if (sessionError || !session) {
        return jsonResponse(404, { error: 'Active session not found for this join code.' });
      }

      const { data: participant, error: participantError } = await userClient
        .from('session_participants')
        .select('id, session_id, student_id, display_name, role, joined_at')
        .eq('id', body.participantId)
        .eq('session_id', session.id)
        .eq('student_id', user.id)
        .single();

      if (participantError || !participant) {
        return jsonResponse(403, { error: 'Student account is not allowed to join this room.' });
      }

      roomName = session.join_code;
      identity = `student:${user.id}`;
      participantName = participant.display_name;
    }

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      name: participantName,
      ttl: '10m',
    });

    token.addGrant({
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      room: roomName,
      roomJoin: true,
    });

    const jwt = await token.toJwt();

    return jsonResponse(200, {
      identity,
      participantName,
      roomName,
      token: jwt,
      url: livekitUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected token generation error.';
    return jsonResponse(500, { error: message });
  }
});

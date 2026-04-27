import { supabase } from '@/lib/supabase';
import { LiveKitTokenRequest, LiveKitTokenResponse } from '@/types/session';

export async function fetchLiveKitToken(payload: LiveKitTokenRequest) {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  return data as LiveKitTokenResponse;
}

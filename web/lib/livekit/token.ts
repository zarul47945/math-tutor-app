import { livekitTokenUrl } from "@/lib/env";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  LiveKitTokenRequest,
  LiveKitTokenResponse,
} from "@/lib/types";

export async function fetchLiveKitToken(
  payload: LiveKitTokenRequest,
) {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const response = await fetch(livekitTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as
    | LiveKitTokenResponse
    | { error?: string };

  if (!response.ok) {
    const errorMessage = "error" in json ? json.error : undefined;
    throw new Error(errorMessage || "Unable to fetch a LiveKit token.");
  }

  return json as LiveKitTokenResponse;
}

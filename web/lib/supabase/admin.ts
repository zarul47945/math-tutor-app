import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

export function createAdminClient() {
  return createClient(supabaseUrl, getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

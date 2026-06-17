import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any;

let _client: SupabaseClient<AnyDB> | null = null;

// Singleton with service role key — bypasses RLS for chatbot operations.
// Falls back to anon key; chatbot-specific tables have RLS disabled anyway.
export function getServiceClient(): SupabaseClient<AnyDB> {
  if (!_client) {
    _client = createClient<AnyDB>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

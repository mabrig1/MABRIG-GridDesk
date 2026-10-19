import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url && key && !url.includes("YOUR_") && !key.includes("YOUR_"),
  );
}
export function getSupabase(): SupabaseClient {
  if (!isConfigured())
    throw new Error(
      "Supabase is not configured. Add the two public environment variables and rebuild.",
    );
  if (!client)
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      {
        auth: { detectSessionInUrl: false },
        global: {
          fetch: async (input, init) => {
            const timeout = AbortSignal.timeout(20000);
            const signal = init?.signal
              ? AbortSignal.any([init.signal, timeout])
              : timeout;
            return fetch(input, { ...init, signal });
          },
        },
      },
    );
  return client;
}

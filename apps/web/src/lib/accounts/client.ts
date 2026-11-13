// The browser side of username accounts (launch Step 2). The rider's
// browser calls the svika-accounts Edge Function directly, so the rate
// limit sees the rider's own network address, and the web server never
// holds the service key. A session it returns is handed to supabase-js.
import { createClient } from "@/lib/supabase/client";

export type NameState = "free" | "taken" | "blocked" | "invalid";

interface Session {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export type AccountsReply =
  | {
      ok: true;
      state?: NameState;
      session?: Session;
      recovery_code?: string;
      username?: string;
    }
  | { ok: false; error: string };

export async function callAccounts(
  body: Record<string, unknown>,
): Promise<AccountsReply> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  try {
    const res = await fetch(`${base}/functions/v1/svika-accounts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anon,
        authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as AccountsReply | null;
    return json ?? { ok: false, error: "server_error" };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Hands a session from the function to supabase-js (cookies for SSR). */
export async function adoptSession(session: Session): Promise<boolean> {
  const { error } = await createClient().auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return !error;
}

export { codeGroups, errorKey, strength } from "./format";

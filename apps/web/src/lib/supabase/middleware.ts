import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request. Follows the official
// @supabase/ssr Next.js middleware pattern. Since guest mode (batch V2)
// /app is no longer blanket guarded here: the layout admits logged out
// visitors to the read only surfaces and every personal page or identity
// moment (pay, save, record) walls itself with the reason spelled out.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // the call refreshes the auth cookie even though the result is unused here
  await supabase.auth.getUser();

  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { flagsFrom, isHiddenPath } from "@/lib/flags";

export async function middleware(request: NextRequest) {
  // Launch profile (ruling 14): hidden routes answer not found, not just
  // unlinked. The rewrite target matches no route, so Next renders its
  // not found page with a real 404 status.
  if (isHiddenPath(request.nextUrl.pathname)) {
    const { flags } = flagsFrom((name) => request.cookies.get(name)?.value);
    if (flags.has("launch")) {
      return NextResponse.rewrite(new URL("/_hidden-by-launch-profile", request.url));
    }
  }
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets, so the session stays fresh.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};

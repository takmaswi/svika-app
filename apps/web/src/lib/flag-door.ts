import { NextResponse, type NextRequest } from "next/server";
import { tokenMatches } from "./flags";

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

/**
 * The private flag doors (/preview and /pitch). A GET with the right key
 * sets an httpOnly cookie carrying it and lands on the app; ?off=1 clears
 * it. A wrong or missing key, or an unset token, answers a plain 404 so the
 * door does not admit it exists. Never linked from any surface.
 */
export function flagDoor(
  request: NextRequest,
  cookieName: string,
  expected: string | undefined,
): NextResponse {
  const url = request.nextUrl;
  const home = new URL("/app", request.url);
  if (url.searchParams.get("off") === "1") {
    const res = NextResponse.redirect(home, 303);
    res.cookies.delete(cookieName);
    return res;
  }
  const key = url.searchParams.get("key") ?? undefined;
  if (!tokenMatches(key, expected)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const res = NextResponse.redirect(home, 303);
  res.cookies.set(cookieName, key!, {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: THIRTY_DAYS_S,
  });
  return res;
}

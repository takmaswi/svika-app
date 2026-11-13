import type { NextRequest } from "next/server";
import { flagDoor } from "@/lib/flag-door";
import { PREVIEW_COOKIE } from "@/lib/flags";

// Launch preview: every launch flag on for this one browser, so each step
// is checked on the live site before the public switch flips at Step 12.
export function GET(request: NextRequest) {
  return flagDoor(request, PREVIEW_COOKIE, process.env.SVIKA_PREVIEW_TOKEN);
}

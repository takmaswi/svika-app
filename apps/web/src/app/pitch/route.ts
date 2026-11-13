import type { NextRequest } from "next/server";
import { flagDoor } from "@/lib/flag-door";
import { PITCH_COOKIE } from "@/lib/flags";

// Ruling 3: the simulated vision (moving kombis, demo estimates, generated
// histories) lives only behind this private door, never linked anywhere.
export function GET(request: NextRequest) {
  return flagDoor(request, PITCH_COOKIE, process.env.SVIKA_PITCH_TOKEN);
}

// Launch flags: the env set, the preview door and the pitch door, plus the
// ruling 14 hidden route list.
import { describe, expect, test } from "vitest";
import {
  LAUNCH_FLAGS,
  isHiddenPath,
  parseFlagList,
  resolveFlags,
  tokenMatches,
} from "../src/lib/flags";

const PREVIEW = "preview-token-0123456789";
const PITCH = "pitch-token-0123456789ab";

function inputs(over: Partial<Parameters<typeof resolveFlags>[0]> = {}) {
  return {
    envFlags: undefined,
    previewToken: PREVIEW,
    pitchToken: PITCH,
    previewCookie: undefined,
    pitchCookie: undefined,
    ...over,
  };
}

describe("parseFlagList", () => {
  test("reads a comma list and ignores unknown names", () => {
    expect([...parseFlagList(" launch, ranks ,nonsense")]).toEqual(["launch", "ranks"]);
  });
  test("all turns every launch flag on", () => {
    expect(parseFlagList("all").size).toBe(LAUNCH_FLAGS.length);
  });
  test("unset means nothing is on", () => {
    expect(parseFlagList(undefined).size).toBe(0);
  });
});

describe("tokenMatches", () => {
  test("refuses short or unset expected tokens so an empty env never opens a door", () => {
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches("short", "short")).toBe(false);
    expect(tokenMatches(undefined, PREVIEW)).toBe(false);
  });
  test("matches only the exact token", () => {
    expect(tokenMatches(PREVIEW, PREVIEW)).toBe(true);
    expect(tokenMatches(`${PREVIEW}x`, PREVIEW)).toBe(false);
    expect(tokenMatches(PREVIEW.replace("0", "1"), PREVIEW)).toBe(false);
  });
});

describe("resolveFlags", () => {
  test("the deploy env decides when no cookie is present", () => {
    const r = resolveFlags(inputs({ envFlags: "launch" }));
    expect(r.flags.has("launch")).toBe(true);
    expect(r.flags.has("ranks")).toBe(false);
    expect(r.pitch).toBe(false);
  });
  test("a valid preview cookie turns every flag on", () => {
    const r = resolveFlags(inputs({ previewCookie: PREVIEW }));
    expect(r.preview).toBe(true);
    expect(r.flags.size).toBe(LAUNCH_FLAGS.length);
  });
  test("a wrong preview cookie changes nothing", () => {
    const r = resolveFlags(inputs({ envFlags: "", previewCookie: "wrong-token-0123456789" }));
    expect(r.flags.size).toBe(0);
  });
  test("the pitch cookie wins and turns the launch profile off", () => {
    const r = resolveFlags(
      inputs({ envFlags: "all", previewCookie: PREVIEW, pitchCookie: PITCH }),
    );
    expect(r.pitch).toBe(true);
    expect(r.flags.has("launch")).toBe(false);
  });
});

describe("isHiddenPath", () => {
  test("hides the paid and operator routes and their children", () => {
    for (const p of ["/app/wallet", "/app/ticket/abc", "/app/kombis/eta", "/app/owner/statement"]) {
      expect(isHiddenPath(p)).toBe(true);
    }
  });
  test("keeps the rider routes and does not match on a shared prefix", () => {
    for (const p of ["/app", "/app/plan", "/app/places", "/app/wallets-elsewhere", "/share/x"]) {
      expect(isHiddenPath(p)).toBe(false);
    }
  });
});

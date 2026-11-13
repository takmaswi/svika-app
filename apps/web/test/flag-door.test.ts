// The private flag doors: the key moves into an httpOnly cookie on first
// use and never stays in the address bar, and every answer tells search
// engines to stay away.
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { flagDoor } from "../src/lib/flag-door";

const KEY = "a3f9c2e81b7d4056a3f9c2e81b7d4056a3f9c2e81b7d4056";
const door = (path: string) => flagDoor(new NextRequest(`https://svika.test${path}`), "svika_preview", KEY);

function expectNoindex(res: Response) {
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("cache-control")).toBe("no-store");
}

describe("flagDoor", () => {
  test("the right key lands on /app with the key moved into a secure httpOnly cookie", () => {
    const res = door(`/preview?key=${KEY}`);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(new URL(location).pathname).toBe("/app");
    expect(location).not.toContain(KEY);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain(`svika_preview=${KEY}`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("secure");
    expectNoindex(res);
  });

  test("a wrong or missing key is a plain 404 that sets nothing", () => {
    for (const path of ["/preview", "/preview?key=nope", `/preview?key=${KEY}x`]) {
      const res = door(path);
      expect(res.status).toBe(404);
      expect(res.headers.get("set-cookie")).toBeNull();
      expectNoindex(res);
    }
  });

  test("off clears the cookie and is not indexed either", () => {
    const res = door("/preview?off=1");
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toContain("svika_preview=;");
    expectNoindex(res);
  });
});

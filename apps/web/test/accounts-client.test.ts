import { describe, expect, test } from "vitest";
import {
  codeGroups,
  errorKey,
  errorText,
  strength,
  waitMinutes,
} from "../src/lib/accounts/format";

describe("accounts client helpers", () => {
  test("recovery code shows as three groups of four", () => {
    expect(codeGroups("K7QM-4XRT-9PLW")).toEqual(["K7QM", "4XRT", "9PLW"]);
    expect(codeGroups("k7qm4xrt9plw")).toEqual(["K7QM", "4XRT", "9PLW"]);
  });
  test("every function error lands on Svika copy, unknown ones on the generic line", () => {
    expect(errorKey("locked")).toBe("acct.locked");
    expect(errorKey("password_leaked")).toBe("acct.pwLeaked");
    expect(errorKey("server_error")).toBe("acct.failed");
    expect(errorKey("anything else")).toBe("acct.failed");
  });
  test("strength meter fills with length and variety", () => {
    expect(strength("")).toBe(0);
    expect(strength("short")).toBe(1);
    expect(strength("kombirider")).toBe(2);
    expect(strength("kombirider-long")).toBe(3);
    expect(strength("kombi rider 4ever!")).toBe(4);
  });

  test("a lock says how long to wait, in English and Shona", () => {
    expect(waitMinutes(600)).toBe(10);
    expect(waitMinutes(61)).toBe(2);
    expect(waitMinutes(1)).toBe(1);
    expect(waitMinutes(undefined)).toBeNull();
    expect(errorText("en", "locked", 600)).toBe(
      "Too many tries for this username. Wait 10 minutes, then try again.",
    );
    expect(errorText("en", "locked", 45)).toBe(
      "Too many tries for this username. Wait 1 minute, then try again.",
    );
    expect(errorText("sn", "locked", 600)).toBe(
      "Waedza kakawanda nezita iri. Mira maminitsi 10, wozoedza zvakare.",
    );
    expect(errorText("sn", "locked", 45)).toBe(
      "Waedza kakawanda nezita iri. Mira miniti 1, wozoedza zvakare.",
    );
    expect(errorText("en", "rate_limited", 840)).toBe(
      "Too many tries from this network. Wait 14 minutes, then try again.",
    );
    expect(errorText("sn", "rate_limited", 840)).toContain("maminitsi 14");
  });
  test("without a wait from the function the copy still names the longest wait", () => {
    expect(errorText("en", "locked")).toContain("Wait up to 15 minutes");
    expect(errorText("sn", "locked")).toContain("kusvika maminitsi 15");
    expect(errorText("en", "rate_limited")).toContain("Wait up to 15 minutes");
    expect(errorText("en", "wrong_details", 600)).toBe(
      "That username and password do not match.",
    );
  });
});

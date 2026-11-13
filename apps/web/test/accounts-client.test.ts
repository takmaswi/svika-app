import { describe, expect, test } from "vitest";
import { codeGroups, errorKey, strength } from "../src/lib/accounts/format";

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
});

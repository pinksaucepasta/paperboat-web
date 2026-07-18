import { describe, expect, it } from "vitest";

import {
  authReturnCookie,
  cliAuthorizePath,
  normalizeUserCode,
  readCookieValue,
} from "./auth-return";

describe("CLI authorization login return", () => {
  it("normalizes a valid user code", () => {
    expect(normalizeUserCode(" abcd-ef12 ")).toBe("ABCD-EF12");
    expect(cliAuthorizePath("abcd-ef12")).toBe("/cli/authorize?code=ABCD-EF12");
  });

  it.each([null, "", "ABCD", "ABCD-EFGH/../dashboard", "ABCD_EFGH"])(
    "rejects an invalid code: %s",
    (value) => expect(cliAuthorizePath(value)).toBeNull(),
  );

  it("reads an encoded return cookie", () => {
    expect(readCookieValue("theme=dark; paperboat_auth_return=ABCD-EF12", "paperboat_auth_return"))
      .toBe("ABCD-EF12");
  });

  it("treats malformed cookie encoding as absent", () => {
    expect(readCookieValue("paperboat_auth_return=%", "paperboat_auth_return")).toBeNull();
  });

  it("does not assume the server's device-grant lifetime", () => {
    const cookie = authReturnCookie("ABCD-EF12", true);
    expect(cookie).toContain("paperboat_auth_return=ABCD-EF12");
    expect(cookie).toContain("; Secure");
    expect(cookie).not.toContain("Max-Age");
  });

  it("expires stale continuations for ordinary sign-in", () => {
    expect(authReturnCookie(null, false)).toContain("Max-Age=0");
  });
});

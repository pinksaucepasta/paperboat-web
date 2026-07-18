export const AUTH_RETURN_COOKIE = "paperboat_auth_return";

const USER_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function normalizeUserCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return USER_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function cliAuthorizePath(value: string | null | undefined): string | null {
  const code = normalizeUserCode(value);
  return code ? `/cli/authorize?code=${encodeURIComponent(code)}` : null;
}

export function authReturnCookie(
  code: string | null,
  secure: boolean,
): string {
  const attributes = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  if (!code) return `${AUTH_RETURN_COOKIE}=; ${attributes}; Max-Age=0`;

  // Grant expiry remains server-authoritative; this session cookie only carries
  // the code across the WorkOS round trip and is cleared by the callback.
  return `${AUTH_RETURN_COOKIE}=${encodeURIComponent(code)}; ${attributes}`;
}

export function readCookieValue(header: string, name: string): string | null {
  const prefix = `${name}=`;
  const entry = header
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!entry) return null;

  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return null;
  }
}

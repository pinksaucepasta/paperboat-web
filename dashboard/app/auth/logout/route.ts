import {
  serverBaseUrl,
  CSRF_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/api/server";

/**
 * Log out: call the server's `/api/auth/logout` (CSRF-protected) forwarding the
 * session + CSRF cookies, relay the server's cookie-clearing `Set-Cookie`
 * headers, and redirect to /login.
 */
export async function POST(req: Request): Promise<Response> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const csrf = cookieHeader
    .split("; ")
    .find((c) => c.startsWith(CSRF_COOKIE + "="))
    ?.slice(CSRF_COOKIE.length + 1);

  let serverRes: Response | null = null;
  try {
    serverRes = await fetch(serverBaseUrl() + "/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
      },
      cache: "no-store",
    });
  } catch {
    // Fall through — still clear the browser and return to /login.
  }

  const res = new Response(null, {
    status: 302,
    headers: { location: new URL("/login", req.url).toString() },
  });
  for (const cookie of localClearCookies()) {
    res.headers.append("set-cookie", cookie);
  }
  if (serverRes) {
    for (const cookie of serverRes.headers.getSetCookie()) {
      res.headers.append("set-cookie", cookie);
    }
  }
  return res;
}

function localClearCookies(): string[] {
  const base = "Path=/; Max-Age=0; SameSite=Lax";
  return [
    `${SESSION_COOKIE}=; ${base}; HttpOnly`,
    `${CSRF_COOKIE}=; ${base}`,
    `${OAUTH_STATE_COOKIE}=; ${base}; HttpOnly`,
  ];
}

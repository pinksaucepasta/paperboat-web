import "server-only";

import { cookies } from "next/headers";
import { serverBaseUrl } from "./server";
import { unwrap } from "./client";

/**
 * Server-side read — calls paperboat-server directly, forwarding the incoming
 * request cookies. Import only from Server Components / Route Handlers. Browser
 * code must use `pbFetch` (through the BFF) instead.
 */
export async function pbServerFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(serverBaseUrl() + path, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  return unwrap<T>(res);
}

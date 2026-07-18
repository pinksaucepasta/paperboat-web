import "server-only";
import { unstable_rethrow } from "next/navigation";

import { ApiError } from "./client";
import { pbServerFetch } from "./server-fetch";
import type { Me } from "./types";

/**
 * Server-side: returns the current user, or null when there is no valid session.
 * Used as the dashboard auth gate, so it fails closed — an unauthenticated
 * response or an unreachable control plane both resolve to null (→ /login)
 * rather than crashing the render.
 */
export async function getMeServer(): Promise<Me | null> {
  try {
    return await pbServerFetch<Me>("/api/me");
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError && err.status === 401) return null;
    console.warn("getMeServer failed:", err);
    return null;
  }
}

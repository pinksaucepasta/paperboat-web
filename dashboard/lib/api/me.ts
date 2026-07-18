import { pbFetch } from "./client";
import type { Me } from "./types";

/** Browser: current user. */
export function getMe(): Promise<Me> {
  return pbFetch<Me>("/api/me");
}

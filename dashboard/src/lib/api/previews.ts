import { pbFetch } from "./client";
import type { Preview } from "./types";

export function listPreviews(): Promise<Preview[]> {
  return pbFetch("/api/previews");
}

export function revokePreview(id: string): Promise<Preview> {
  return pbFetch(`/api/previews/${encodeURIComponent(id)}`, { method: "DELETE" });
}

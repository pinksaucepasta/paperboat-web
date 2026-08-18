import { pbFetch } from "./client";
import type { Preview } from "./types";

export function listPreviews(): Promise<Preview[]> {
  return pbFetch("/v1/previews");
}

export function revokePreview(id: string): Promise<Preview> {
  return pbFetch(`/v1/previews/${encodeURIComponent(id)}`, { method: "DELETE" });
}

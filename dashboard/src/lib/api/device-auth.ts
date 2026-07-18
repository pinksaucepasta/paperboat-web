import { pbFetch } from "./client";
import type { AuthorizedClientList, DeviceRequest } from "./types";

export function getDeviceRequest(userCode: string): Promise<DeviceRequest> {
  return pbFetch(`/api/auth/device/requests/${encodeURIComponent(userCode)}`);
}

export function decideDeviceRequest(
  userCode: string,
  decision: "approve" | "deny",
): Promise<DeviceRequest> {
  return pbFetch(
    `/api/auth/device/requests/${encodeURIComponent(userCode)}/${decision}`,
    { method: "POST" },
  );
}

export function getAuthorizedClients(
  offset = 0,
  limit = 50,
): Promise<AuthorizedClientList> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return pbFetch(`/api/auth/clients?${query.toString()}`);
}

export function revokeAuthorizedClient(clientSessionId: string): Promise<void> {
  return pbFetch(`/api/auth/clients/${encodeURIComponent(clientSessionId)}`, {
    method: "DELETE",
  });
}

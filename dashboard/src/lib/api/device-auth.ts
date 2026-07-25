import { pbFetch } from "./client";
import type { CLIClientSessionList, DeviceRequest } from "./types";

export function getDeviceRequest(userCode: string): Promise<DeviceRequest> {
  return pbFetch(`/v1/auth/device/requests/${encodeURIComponent(userCode)}`);
}

export function decideDeviceRequest(
  userCode: string,
  decision: "approve" | "deny",
): Promise<DeviceRequest> {
  return pbFetch(
    `/v1/auth/device/requests/${encodeURIComponent(userCode)}/${decision}`,
    { method: "POST" },
  );
}

export function getCLIClientSessions(
  offset = 0,
  limit = 50,
): Promise<CLIClientSessionList> {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return pbFetch(`/v1/auth/cli-client-sessions?${query.toString()}`);
}

export function revokeCLIClientSession(clientSessionId: string): Promise<void> {
  return pbFetch(`/v1/auth/cli-client-sessions/${encodeURIComponent(clientSessionId)}`, {
    method: "DELETE",
  });
}

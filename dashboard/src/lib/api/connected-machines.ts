import { pbFetch } from "./client";
import type { ConnectedMachine, ConnectedMachineListResponse, ConnectedMachineOverview } from "./types";

export async function listConnectedMachines(): Promise<ConnectedMachine[]> {
  return (await pbFetch<ConnectedMachineListResponse>("/api/connected-machines")).items;
}
export function getConnectedMachineOverview(): Promise<ConnectedMachineOverview> {
  return pbFetch("/api/connected-machines/overview");
}
export function approveConnectedMachine(userCode: string): Promise<ConnectedMachine> {
  return pbFetch(`/api/connected-machines/pairings/${encodeURIComponent(userCode)}/approve`, { method: "POST" });
}
export function disconnectConnectedMachine(id: string): Promise<void> {
  return pbFetch(`/api/connected-machines/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
export function deleteConnectedMachine(id: string): Promise<void> {
  return pbFetch(`/api/connected-machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}

import { pbFetch } from "./client";
import type { ConnectedMachine, ConnectedMachineEnrollment, ConnectedMachineEnrollmentStart, ConnectedMachineListResponse, ConnectedMachineOverview } from "./types";

export async function listConnectedMachines(): Promise<ConnectedMachine[]> {
  return (await pbFetch<ConnectedMachineListResponse>("/api/connected-machines")).items;
}
export function getConnectedMachineOverview(): Promise<ConnectedMachineOverview> {
  return pbFetch("/api/connected-machines/overview");
}
export function approveConnectedMachine(userCode: string): Promise<ConnectedMachine> {
  return pbFetch(`/api/connected-machines/pairings/${encodeURIComponent(userCode)}/approve`, { method: "POST" });
}
export function denyConnectedMachine(userCode: string): Promise<void> {
  return pbFetch(`/api/connected-machines/pairings/${encodeURIComponent(userCode)}/deny`, { method: "POST" });
}
export function disconnectConnectedMachine(id: string): Promise<void> {
  return pbFetch(`/api/connected-machines/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
export function deleteConnectedMachine(id: string): Promise<void> {
  return pbFetch(`/api/connected-machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function startConnectedMachineEnrollment(idempotencyKey: string): Promise<ConnectedMachineEnrollmentStart> {
  return pbFetch("/api/connected-machine-enrollments", { method: "POST", idempotencyKey });
}
export function getConnectedMachineEnrollment(id: string): Promise<ConnectedMachineEnrollment> {
  return pbFetch(`/api/connected-machine-enrollments/${encodeURIComponent(id)}`);
}
export function cancelConnectedMachineEnrollment(id: string): Promise<void> {
  return pbFetch(`/api/connected-machine-enrollments/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
export function retryConnectedMachineEnrollment(id: string): Promise<ConnectedMachineEnrollmentStart> {
  return pbFetch(`/api/connected-machine-enrollments/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

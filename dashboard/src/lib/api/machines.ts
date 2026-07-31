import { pbFetch } from "./client";
import type { AvailabilityMode, AvailabilityPolicy, Machine, MachineEnrollment, MachineEnrollmentStart, MachineListResponse, MachineOverview } from "./types";

export async function listMachines(): Promise<Machine[]> {
  return (await pbFetch<MachineListResponse>("/v1/machines")).items;
}
export function getMachineOverview(): Promise<MachineOverview> {
  return pbFetch("/v1/machines/overview");
}
export function approveMachine(userCode: string): Promise<Machine> {
  return pbFetch(`/v1/machines/pairings/${encodeURIComponent(userCode)}/approve`, { method: "POST" });
}
export function denyMachine(userCode: string): Promise<void> {
  return pbFetch(`/v1/machines/pairings/${encodeURIComponent(userCode)}/deny`, { method: "POST" });
}
export function disconnectMachine(id: string): Promise<void> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
export function deleteMachine(id: string): Promise<void> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function setMachineAvailability(id: string, mode: AvailabilityMode, expectedVersion: number): Promise<AvailabilityPolicy> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/availability-policy`, {
    method: "PUT",
    body: { mode, expected_version: expectedVersion },
  });
}
export function startMachineEnrollment(idempotencyKey: string): Promise<MachineEnrollmentStart> {
  return pbFetch("/v1/machine-enrollments", { method: "POST", idempotencyKey });
}
export function getMachineEnrollment(id: string): Promise<MachineEnrollment> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}`);
}
export function cancelMachineEnrollment(id: string): Promise<void> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
export function retryMachineEnrollment(id: string): Promise<MachineEnrollmentStart> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

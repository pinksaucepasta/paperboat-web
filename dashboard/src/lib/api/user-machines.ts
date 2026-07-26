import { pbFetch } from "./client";
import type { AvailabilityMode, AvailabilityPolicy, UserMachine, UserMachineEnrollment, UserMachineEnrollmentStart, UserMachineListResponse, UserMachineOverview } from "./types";

export async function listUserMachines(): Promise<UserMachine[]> {
  return (await pbFetch<UserMachineListResponse>("/v1/user-machines")).items;
}
export function getUserMachineOverview(): Promise<UserMachineOverview> {
  return pbFetch("/v1/user-machines/overview");
}
export function approveUserMachine(userCode: string): Promise<UserMachine> {
  return pbFetch(`/v1/user-machines/pairings/${encodeURIComponent(userCode)}/approve`, { method: "POST" });
}
export function denyUserMachine(userCode: string): Promise<void> {
  return pbFetch(`/v1/user-machines/pairings/${encodeURIComponent(userCode)}/deny`, { method: "POST" });
}
export function disconnectUserMachine(id: string): Promise<void> {
  return pbFetch(`/v1/user-machines/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
export function deleteUserMachine(id: string): Promise<void> {
  return pbFetch(`/v1/user-machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function setUserMachineAvailability(id: string, mode: AvailabilityMode, expectedVersion: number): Promise<AvailabilityPolicy> {
  return pbFetch(`/v1/user-machines/${encodeURIComponent(id)}/availability-policy`, {
    method: "PUT",
    body: { mode, expected_version: expectedVersion },
  });
}
export function startUserMachineEnrollment(idempotencyKey: string): Promise<UserMachineEnrollmentStart> {
  return pbFetch("/v1/user-machine-enrollments", { method: "POST", idempotencyKey });
}
export function getUserMachineEnrollment(id: string): Promise<UserMachineEnrollment> {
  return pbFetch(`/v1/user-machine-enrollments/${encodeURIComponent(id)}`);
}
export function cancelUserMachineEnrollment(id: string): Promise<void> {
  return pbFetch(`/v1/user-machine-enrollments/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
export function retryUserMachineEnrollment(id: string): Promise<UserMachineEnrollmentStart> {
  return pbFetch(`/v1/user-machine-enrollments/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

import { pbDownload, pbFetch } from "./client";
import type { AvailabilityMode, AvailabilityPolicy, FleetUpdateSummary, Machine, MachineEnrollment, MachineEnrollmentStart, MachineListResponse, MachineOverview, MaintenanceApproval, UpdateObservation } from "./types";

export async function listMachines(): Promise<Machine[]> {
  return (await pbFetch<MachineListResponse>("/v1/machines")).items;
}
export function getMachineOverview(): Promise<MachineOverview> {
  return pbFetch("/v1/machines/overview");
}
export function getFleetUpdateSummary(): Promise<FleetUpdateSummary> {
  return pbFetch("/v1/machines/update-summary");
}
export function getMachineUpdateStatus(id: string): Promise<UpdateObservation> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/update-status`);
}
export async function listMaintenanceApprovals(id: string): Promise<MaintenanceApproval[]> {
  return (await pbFetch<{ approvals: MaintenanceApproval[] }>(`/v1/machines/${encodeURIComponent(id)}/maintenance-approvals`)).approvals;
}
export function requestMaintenanceApproval(id: string, input: { action: "update" | "restart" | "migration"; target_version: string; reason?: string; expires_in_seconds?: number }): Promise<MaintenanceApproval> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/maintenance-approvals`, { method: "POST", body: input });
}
export function decideMaintenanceApproval(id: string, approvalID: string, decision: "approved" | "rejected"): Promise<MaintenanceApproval> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/maintenance-approvals/${encodeURIComponent(approvalID)}/${decision}`, { method: "POST" });
}
export function disconnectMachine(id: string): Promise<void> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/disconnect`, { method: "POST" });
}
export function deleteMachine(id: string): Promise<void> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function renameMachine(id: string, displayName: string): Promise<Machine> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { display_name: displayName },
  });
}
export function setMachineAvailability(id: string, mode: AvailabilityMode, expectedVersion: number): Promise<AvailabilityPolicy> {
  return pbFetch(`/v1/machines/${encodeURIComponent(id)}/availability-policy`, {
    method: "PUT",
    body: { mode, expected_version: expectedVersion },
  });
}
export function startMachineEnrollment(idempotencyKey: string, role = "host", shell = "posix"): Promise<MachineEnrollmentStart> {
  return pbFetch("/v1/machine-enrollments", { method: "POST", idempotencyKey, body: { role, shell } });
}
export function getMachineEnrollment(id: string): Promise<MachineEnrollment> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}`);
}
export function cancelMachineEnrollment(id: string): Promise<void> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
export function retryMachineEnrollment(id: string, role = "host", shell = "posix"): Promise<MachineEnrollmentStart> {
  return pbFetch(`/v1/machine-enrollments/${encodeURIComponent(id)}/retry`, { method: "POST", body: { role, shell } });
}
export function downloadMachineEnrollmentToken(path: string): Promise<Blob> {
  return pbDownload(path);
}

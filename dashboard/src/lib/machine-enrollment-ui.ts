import type { MachineEnrollment, MachineEnrollmentStart } from "./api/types";

export interface MachineEnrollmentIdentity {
  id: string;
  generation: number;
}

type MachineEnrollmentValue = MachineEnrollment | MachineEnrollmentStart;

export function machineEnrollmentIdentity(enrollment: Pick<MachineEnrollment, "id" | "generation">): MachineEnrollmentIdentity {
  return { id: enrollment.id, generation: enrollment.generation };
}

export function mergeMachineEnrollmentStatus(
  current: MachineEnrollmentValue | undefined,
  next: MachineEnrollment,
  expected: MachineEnrollmentIdentity,
): MachineEnrollmentValue | undefined {
  if (!current || current.id !== expected.id || next.id !== expected.id) return current;
  if (next.generation < expected.generation || next.generation < current.generation) return current;
  if (next.generation > current.generation) return next;
  return { ...current, ...next };
}

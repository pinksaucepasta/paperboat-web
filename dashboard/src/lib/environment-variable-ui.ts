const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_VARIABLE_NAME_LENGTH = 128;
export const MAX_VARIABLE_VALUE_BYTES = 32_767;
const RESERVED_VARIABLE_PREFIXES = ["PAPERBOAT_", "LD_", "DYLD_"];
const RESERVED_VARIABLE_NAMES = new Set(["NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "GOTRACEBACK"]);
type StatusVariant = "secondary" | "warning" | "success" | "error";

function normalizedStatus(value: string | null | undefined):
  | "pending"
  | "applied"
  | "offline"
  | "failed"
  | "unknown" {
  switch (value) {
    case "pending":
      return "pending";
    case "applied":
      return "applied";
    case "offline":
      return "offline";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

export interface EnvironmentVariableStatusPresentation {
  label: string;
  variant: StatusVariant;
  dotClassName: string;
}

export function environmentVariableStatus(
  status: string | null | undefined,
  scope: "global" | "machine" = "machine",
): EnvironmentVariableStatusPresentation {
  if (scope === "global") {
    return { label: "Configured", variant: "secondary", dotClassName: "bg-muted-foreground" };
  }
  const normalized = normalizedStatus(status);
  switch (normalized) {
    case "pending":
      return { label: "Pending", variant: "warning", dotClassName: "bg-warning" };
    case "applied":
      return { label: "Applied", variant: "success", dotClassName: "bg-success" };
    case "offline":
      return { label: "Offline", variant: "warning", dotClassName: "bg-warning" };
    case "failed":
      return { label: "Failed", variant: "error", dotClassName: "bg-destructive" };
    case "unknown":
      return { label: "Not reported", variant: "secondary", dotClassName: "bg-muted-foreground" };
  }
}

export function validateEnvironmentVariableName(
  value: string,
  existingNames: readonly string[] = [],
): string | undefined {
  const name = value.trim();
  if (!name) return "Enter a variable name.";
  if (name.length > MAX_VARIABLE_NAME_LENGTH) {
    return `Variable names must be ${MAX_VARIABLE_NAME_LENGTH} characters or fewer.`;
  }
  if (!VARIABLE_NAME.test(name)) {
    return "Use letters, numbers, and underscores. Start with a letter or underscore.";
  }
  const foldedName = name.toUpperCase();
  if (RESERVED_VARIABLE_PREFIXES.some((prefix) => foldedName.startsWith(prefix)) || RESERVED_VARIABLE_NAMES.has(foldedName)) {
    return "This variable name is reserved by Paperboat and cannot be configured.";
  }
  const collidingName = existingNames.find((existingName) => {
    const trimmedExistingName = existingName.trim();
    return trimmedExistingName !== name && trimmedExistingName.toUpperCase() === foldedName;
  });
  if (collidingName) {
    return `A variable named ${collidingName} already exists in this scope.`;
  }
  return undefined;
}

export function environmentVariableValueByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function validateEnvironmentVariableValue(value: string): string | undefined {
  if (value.includes("\u0000")) return "Values cannot contain a NUL character.";
  const bytes = environmentVariableValueByteLength(value);
  if (bytes > MAX_VARIABLE_VALUE_BYTES) {
    return `Values must be ${MAX_VARIABLE_VALUE_BYTES.toLocaleString()} UTF-8 bytes or fewer.`;
  }
  return undefined;
}

export function environmentVariableStatusMessage(
  status: string | null | undefined,
  configured: boolean,
  scope: "global" | "machine" = "machine",
): string {
  if (!configured) return "Not configured";
  if (scope === "global") return "Configured; apply status is tracked per host machine.";
  switch (normalizedStatus(status)) {
    case "pending":
      return "The host will receive this change shortly.";
    case "applied":
      return "Applied to the host; only new processes receive it.";
    case "offline":
      return "The machine is offline. It will apply this when it reconnects.";
    case "failed":
      return "The host could not apply this variable. Review the error and retry.";
    case "unknown":
      return "The host has not reported an apply state yet.";
  }
}

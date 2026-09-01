import type { PreviewLease, PreviewTarget } from "./api/preview-tunnel-v1";

export type PreviewStatusVariant = "secondary" | "warning" | "error" | "info" | "success";

export interface PreviewStatusModel {
  label: string;
  detail: string;
  variant: PreviewStatusVariant;
}

export interface PreviewTargetInput {
  scheme: PreviewTarget["scheme"];
  address: string;
}

export function targetLabel(target: PreviewTarget): string {
  if (target.scheme === "unix") return `unix://${target.address}`;
  return `${target.scheme}://${target.address}`;
}

/**
 * A lease is only usable after every readiness dimension is authoritative.
 * The control plane may return a connecting resource before the host reports
 * that its origin and edge carrier are actually serving traffic.
 */
export function previewIsReady(preview: PreviewLease): boolean {
  return (
    preview.state === "ready" &&
    preview.allocation_state === "ready" &&
    preview.edge_state === "ready" &&
    preview.origin_state === "ready"
  );
}

/** Only the control-plane HTTPS endpoint can become a browser navigation. */
export function safePreviewEndpoint(value: string): string | undefined {
  if (!value || value !== value.trim()) return undefined;
  try {
    const endpoint = new URL(value);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function parsePreviewTarget(raw: string): PreviewTargetInput {
  const value = raw.trim();
  if (!value) throw new Error("Enter a port or local origin URL.");

  if (/^\d+$/.test(value)) {
    const port = Number(value);
    if (port < 1 || port > 65_535) throw new Error("Port must be between 1 and 65535.");
    return { scheme: "http", address: `127.0.0.1:${port}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(value.includes("://") ? value : `http://${value}`);
  } catch {
    throw new Error("Enter a port or a valid local origin URL.");
  }
  if (parsed.username || parsed.password) throw new Error("Origin URLs cannot contain credentials.");
  if (parsed.search || parsed.hash) throw new Error("Origin URLs cannot contain a query or fragment.");

  const scheme = parsed.protocol.slice(0, -1).toLowerCase();
  if (!["http", "https", "h2c", "unix", "tcp"].includes(scheme)) {
    throw new Error("Use http, https, h2c, unix, or tcp for the origin.");
  }
  if (scheme === "unix") {
    if (!parsed.pathname.startsWith("/") || parsed.pathname === "/") {
      throw new Error("Unix origins need an absolute socket path.");
    }
    return { scheme: "unix", address: parsed.pathname };
  }
  if (!parsed.hostname || !parsed.port) {
    throw new Error("Origin URLs must include a host and port, such as http://127.0.0.1:3000.");
  }
  if (parsed.pathname && parsed.pathname !== "/") throw new Error("Origin URLs cannot include a path.");
  if (scheme === "tcp") return { scheme: "tcp", address: parsed.host };
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) {
    throw new Error("Preview origins must use localhost or a loopback address.");
  }
  return { scheme: scheme as PreviewTargetInput["scheme"], address: parsed.host };
}

export function previewStatus(preview: PreviewLease): PreviewStatusModel {
  if (preview.state === "owner_disconnected") {
    return {
      label: "Owner disconnected",
      detail: "The device is offline. The temporary endpoint is preserved during reconnect grace.",
      variant: "warning",
    };
  }
  if (preview.state === "expired") {
    return { label: "Expired", detail: "The preview lifetime has ended.", variant: "secondary" };
  }
  if (preview.state === "stopped") {
    return { label: "Stopped", detail: "This preview no longer accepts traffic.", variant: "secondary" };
  }
  if (preview.origin_state === "unavailable") {
    return {
      label: "Origin unavailable",
      detail: "The device is connected, but the local origin refused a connection.",
      variant: "warning",
    };
  }
  if (preview.edge_state === "down") {
    return {
      label: "Edge offline",
      detail: "The public edge is not connected. Paperboat is retrying.",
      variant: "error",
    };
  }
  if (preview.edge_state === "degraded") {
    return {
      label: "Edge degraded",
      detail: "The preview is reachable with reduced edge health.",
      variant: "warning",
    };
  }
  if (
    preview.allocation_state !== "ready" ||
    preview.state === "allocating" ||
    preview.state === "connecting"
  ) {
    return {
      label: "Connecting",
      detail: "Paperboat is connecting the device, edge, and local origin.",
      variant: "info",
    };
  }
  return { label: "Ready", detail: "The preview is accepting traffic.", variant: "success" };
}

export function trafficLabel(preview: PreviewLease): string {
  if (preview.state === "stopped" || preview.state === "expired") return "Not accepting";
  if (preview.origin_state === "unavailable") return "Waiting for origin";
  if (preview.edge_state === "down") return "Not accepting";
  if (
    preview.state === "ready" &&
    preview.edge_state === "ready" &&
    preview.origin_state === "ready"
  ) {
    return "Accepting traffic";
  }
  return "Connecting";
}

export function originLabel(preview: PreviewLease): string {
  if (preview.origin_state === "ready") return "Reachable";
  if (preview.origin_state === "unavailable") return "Unavailable";
  return "Checking";
}

export function formatPreviewDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatPreviewCountdown(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "Indefinite";
  const deadline = new Date(value).getTime();
  if (!Number.isFinite(deadline)) return "Unknown";
  const remaining = deadline - now;
  if (remaining <= 0) return "Expired";
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

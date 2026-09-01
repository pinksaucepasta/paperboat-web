import type {
  Connector,
  Health,
  HealthDimension,
  Tunnel,
  TunnelRoute,
  V1Event,
} from "@/lib/api/preview-tunnel-v1";

export type TunnelBadgeVariant = "success" | "warning" | "error" | "secondary";

export function tunnelStatus(tunnel: Tunnel): { label: string; variant: TunnelBadgeVariant } {
  if (tunnel.desired_state === "deleted") return { label: "Deleting", variant: "error" };
  if (tunnel.desired_state === "paused") return { label: "Paused", variant: "secondary" };
  const code = tunnel.summary_code.toLowerCase();
  if (code.includes("ready") || code.includes("healthy")) return { label: "Ready", variant: "success" };
  if (code.includes("down") || code.includes("failed") || code.includes("error")) return { label: "Unavailable", variant: "error" };
  return { label: "Connecting", variant: "warning" };
}

export function safeTunnelEndpoint(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) return undefined;
    return url.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function formatTunnelTimestamp(value: string | null | undefined): string {
  if (!value) return "Indefinite";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function routeMatchLabel(route: TunnelRoute): string {
  const host = route.host_match.hostname || "Any managed hostname";
  const prefix = route.path_prefix && route.path_prefix !== "/" ? route.path_prefix : "";
  switch (route.host_match.type) {
    case "one_label_wildcard":
      return `*.${host}${prefix}`;
    case "catch_all":
      return `Any managed hostname${prefix}`;
    default:
      return `${host}${prefix}`;
  }
}

export function routeOriginLabel(route: TunnelRoute): string {
  if (route.origin.scheme === "unix") return `unix://${route.origin.address}`;
  return `${route.origin.scheme}://${route.origin.address}`;
}

export function connectorStatus(connector: Connector): { label: string; variant: TunnelBadgeVariant } {
  if (connector.desired_state === "revoked") return { label: "Revoked", variant: "error" };
  if (connector.drain_state === "draining") return { label: "Draining", variant: "warning" };
  if (connector.drain_state === "drained" || connector.drain_state === "forced_closed") return { label: "Offline", variant: "secondary" };
  if (connector.ready_at && connector.last_session_id) return { label: "Connected", variant: "success" };
  return { label: "Connecting", variant: "warning" };
}

export function healthDimensionLabel(dimension: HealthDimension): string {
  switch (dimension.status) {
    case "ready":
      return "Ready";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Unknown";
  }
}

export function healthVariant(dimension: HealthDimension): TunnelBadgeVariant {
  switch (dimension.status) {
    case "ready":
      return "success";
    case "degraded":
      return "warning";
    case "down":
      return "error";
    default:
      return "secondary";
  }
}

export function importantHealthDimensions(health: Health): Array<[string, HealthDimension]> {
  const order = ["service", "edge", "config", "route", "origin", "access", "dns", "certificate", "update"] as const;
  return order.map((key) => [key, health.dimensions[key]]);
}

export function operationIDFromEvent(event: V1Event): string | undefined {
  const value = event.safe_metadata.operation_id;
  return typeof value === "string" && /^op_[A-Za-z0-9_.:-]{3,124}$/.test(value) ? value : undefined;
}

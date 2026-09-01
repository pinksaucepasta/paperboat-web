"use client";

import * as React from "react";
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  RefreshIcon,
  Rotate01Icon,
  Shield01Icon,
  Tick01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  isPreviewTunnelError,
  makeIdempotencyKey,
  PreviewTunnelClient,
  type Connector,
  type DNSInstructions,
  type DomainBinding,
  type DomainCreateInput,
  type Health,
  type LogEntry,
  type LogListOptions,
  type Operation,
  type OriginTLS,
  type RouteHostMatch,
  type RouteOrigin,
  type Tunnel,
  type TunnelRoute,
  type V1Event,
} from "@/lib/api/preview-tunnel-v1";
import {
  connectorStatus,
  formatTunnelTimestamp,
  healthDimensionLabel,
  healthVariant,
  operationIDFromEvent,
  routeMatchLabel,
  routeOriginLabel,
} from "@/lib/tunnel-ui";

const DNS_PROVIDER_OPTIONS = [
  ["generic", "Generic DNS"],
  ["cloudflare", "Cloudflare"],
  ["route53", "Amazon Route 53"],
  ["google_cloud_dns", "Google Cloud DNS"],
  ["digitalocean", "DigitalOcean"],
  ["namecheap", "Namecheap"],
] as const;

function shortID(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 9)}…${value.slice(-5)}`;
}

function errorText(error: unknown, fallback: string): string {
  if (isPreviewTunnelError(error)) return error.message;
  return fallback;
}

function isOperation(value: unknown): value is Operation {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "operation";
}

async function waitForOperation(client: PreviewTunnelClient, operation: Operation): Promise<Operation> {
  const watcher = client.watchOperation(operation.id, { pollIntervalMs: 500, maxPollIntervalMs: 2_000 });
  try {
    return await watcher.done;
  } finally {
    watcher.stop();
  }
}

function operationMessage(operation: Operation): string {
  if (operation.state === "succeeded") return "The operation completed.";
  if (operation.state === "failed" || operation.state === "canceled") {
    return operation.error?.message || "The operation did not complete.";
  }
  return `${operation.phase.replaceAll("_", " ")} · ${operation.progress}%`;
}

function DomainStateBadge({ domain }: { domain: DomainBinding }): React.ReactElement {
  const variant = domain.state === "ready" ? "success" : domain.state === "conflict" || domain.state === "tls_error" || domain.state === "dns_error" || domain.state === "expired" ? "error" : "warning";
  return <Badge variant={variant}>{domain.state.replaceAll("_", " ")}</Badge>;
}

function DNSInstructionBlock({ instructions }: { instructions?: DNSInstructions }): React.ReactElement | null {
  if (!instructions) return null;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/28 p-3" data-testid="dns-instructions">
      <div>
        <p className="text-sm font-medium">DNS instructions</p>
        <p className="mt-1 text-xs text-muted-foreground">These provider-aware records are authoritative. Paperboat never guesses a target or TTL.</p>
      </div>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-left text-xs">
          <thead className="border-b text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Value</th><th className="px-3 py-2 font-medium">TTL</th></tr></thead>
          <tbody>{instructions.records.map((record) => <tr key={`${record.name}:${record.value}`} className="border-b last:border-0"><td className="px-3 py-2 font-mono">{record.name}</td><td className="px-3 py-2">{record.type}</td><td className="px-3 py-2 font-mono">{record.value}</td><td className="px-3 py-2 tabular-nums">{record.ttl}s</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{instructions.note}</p>
      <p className="text-xs text-muted-foreground">Strategy: <span className="font-medium text-foreground">{instructions.certificate_strategy.replaceAll("_", " ")}</span> · verification: <span className="font-medium text-foreground">{instructions.verification_state.replaceAll("_", " ")}</span></p>
    </div>
  );
}

export function TunnelDomainsPanel({
  tunnelID,
  routes,
  client,
}: {
  tunnelID: string;
  routes: TunnelRoute[];
  client: PreviewTunnelClient;
}): React.ReactElement {
  const [domains, setDomains] = React.useState<DomainBinding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [hostname, setHostname] = React.useState("");
  const [routeID, setRouteID] = React.useState(routes[0]?.id || "");
  const [provider, setProvider] = React.useState("generic");
  const [strategy, setStrategy] = React.useState<DomainCreateInput["certificate_strategy"]>("managed");
  const [busy, setBusy] = React.useState<string>();
  const [instructions, setInstructions] = React.useState<Record<string, DNSInstructions>>({});

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const page = await client.listDomains(tunnelID, { limit: 200 });
      setDomains(page.items);
    } catch (loadError) {
      setError(errorText(loadError, "Domain bindings are temporarily unavailable."));
    } finally {
      setLoading(false);
    }
  }, [client, tunnelID]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => { if (!routeID && routes[0]) setRouteID(routes[0].id); }, [routeID, routes]);

  async function createDomain(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const value = hostname.trim();
    if (!value || !routeID) return;
    if (strategy === "on_demand_leaf" && !value.startsWith("*.")) {
      toast.error("On-demand leaf certificates require a one-label wildcard.", { description: "Use *.example.com or choose Managed certificate for an exact hostname." });
      return;
    }
    setBusy("create");
    try {
      const result = await client.createDomain(tunnelID, { hostname: value, route_id: routeID, provider: provider || undefined, certificate_strategy: strategy }, { idempotencyKey: makeIdempotencyKey("domain-create") });
      if (isOperation(result)) {
        const completed = await waitForOperation(client, result);
        if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      }
      setHostname("");
      toast.success("Custom domain requested.", { description: "DNS verification and certificate issuance continue in the background." });
      await refresh();
    } catch (createError) {
      toast.error("Could not add custom domain.", { description: errorText(createError, "Check the hostname and retry.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function showInstructions(domain: DomainBinding): Promise<void> {
    if (instructions[domain.id]) return;
    setBusy(`instructions:${domain.id}`);
    try {
      const next = await client.getDomainInstructions(tunnelID, domain.id);
      setInstructions((current) => ({ ...current, [domain.id]: next }));
    } catch (instructionError) {
      toast.error("DNS instructions are unavailable.", { description: errorText(instructionError, "Retry when the control plane is available.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function verify(domain: DomainBinding): Promise<void> {
    setBusy(`verify:${domain.id}`);
    try {
      const current = await client.getDomain(tunnelID, domain.id);
      const result = await client.verifyDomain(tunnelID, domain.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("domain-verify") });
      if (isOperation(result)) {
        const completed = await waitForOperation(client, result);
        if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      }
      toast.success("Domain verification requested.");
      await refresh();
    } catch (verifyError) {
      toast.error("Could not verify the domain.", { description: errorText(verifyError, "Refresh the domain and retry.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function remove(domain: DomainBinding): Promise<void> {
    setBusy(`delete:${domain.id}`);
    try {
      const current = await client.getDomain(tunnelID, domain.id);
      const result = await client.deleteDomain(tunnelID, domain.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("domain-delete") });
      if (isOperation(result)) {
        const completed = await waitForOperation(client, result);
        if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      }
      toast.success("Custom domain removed.");
      await refresh();
    } catch (deleteError) {
      toast.error("Could not remove the domain.", { description: errorText(deleteError, "Refresh the domain and retry.") });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="space-y-4" data-testid="tunnel-domains-panel">
      <Card>
        <CardHeader><CardTitle className="font-heading text-base">Add a custom domain</CardTitle><CardDescription>Attach an exact, apex, or one-label wildcard alias to a route. DNS and TLS remain independent of connector availability.</CardDescription></CardHeader>
        <CardContent>
          {routes.length === 0 ? <p className="text-sm text-muted-foreground">Create a route on the owner host before attaching a domain.</p> : <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(10rem,auto)_minmax(10rem,auto)_auto] md:items-end" onSubmit={(event) => void createDomain(event)}>
            <div className="space-y-2"><label htmlFor="domain-hostname" className="text-sm font-medium">Hostname</label><Input id="domain-hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="app.example.com or *.example.com" autoComplete="off" spellCheck={false} disabled={Boolean(busy)} /></div>
            <div className="space-y-2"><label htmlFor="domain-route" className="text-sm font-medium">Route</label><NativeSelect id="domain-route" value={routeID} onChange={(event) => setRouteID(event.target.value)} disabled={Boolean(busy)}><NativeSelectOption value="">Choose route</NativeSelectOption>{routes.filter((route) => route.desired_state !== "deleted").map((route) => <NativeSelectOption key={route.id} value={route.id}>{route.name}</NativeSelectOption>)}</NativeSelect></div>
            <div className="space-y-2"><label htmlFor="domain-provider" className="text-sm font-medium">DNS provider</label><NativeSelect id="domain-provider" value={provider} onChange={(event) => setProvider(event.target.value)} disabled={Boolean(busy)}>{DNS_PROVIDER_OPTIONS.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></div>
            <div className="space-y-2"><label htmlFor="domain-strategy" className="text-sm font-medium">TLS strategy</label><NativeSelect id="domain-strategy" value={strategy} onChange={(event) => setStrategy(event.target.value as DomainCreateInput["certificate_strategy"])} disabled={Boolean(busy)}><NativeSelectOption value="managed">Managed certificate</NativeSelectOption><NativeSelectOption value="on_demand_leaf" disabled={!hostname.trim().startsWith("*.")}>On-demand wildcard leaf</NativeSelectOption></NativeSelect></div>
            <Button type="submit" disabled={Boolean(busy) || !hostname.trim() || !routeID}>{busy === "create" ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}Add domain</Button>
          </form>}
          <p className="mt-3 text-xs text-muted-foreground">For Coolify, prefer <span className="font-medium text-foreground">*.your-domain.example</span> with the origin preserving Host. Every generated application subdomain then uses the same Paperboat route.</p>
        </CardContent>
      </Card>

      {error ? <Alert variant="warning"><HugeiconsIcon icon={Cancel01Icon} /><div><AlertTitle>Domain state unavailable</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></AlertDescription></div></Alert> : null}
      {loading && domains.length === 0 ? <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Spinner />Loading domain bindings…</CardContent></Card> : domains.length === 0 ? <Card><Empty className="py-12"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={Shield01Icon} /></EmptyMedia><EmptyTitle>No custom domains</EmptyTitle><EmptyDescription>The managed Paperboat endpoint remains available. Add an alias when you are ready to configure DNS.</EmptyDescription></EmptyHeader></Empty></Card> : <div className="space-y-3">{domains.map((domain) => <Card key={domain.id} data-testid={`domain-card-${domain.id}`}><CardHeader className="gap-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="break-all font-heading text-base">{domain.hostname}</CardTitle><CardDescription className="mt-1">{domain.match_type === "one_label_wildcard" ? "One-label wildcard" : "Exact hostname"} · generation {domain.generation}</CardDescription></div><DomainStateBadge domain={domain} /></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">DNS</p><p className="mt-1 capitalize">{domain.state === "waiting_dns" || domain.state === "dns_error" ? "Needs attention" : domain.dns.observed_records?.length ? "Observed" : "Pending"}</p>{domain.dns.observed_records?.length ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{domain.dns.observed_records.join(", ")}</p> : null}</div><div><p className="text-xs text-muted-foreground">Certificate</p><p className="mt-1 capitalize">{domain.certificate.state.replaceAll("_", " ")}</p>{domain.certificate.expires_at ? <p className="mt-1 text-xs text-muted-foreground">Expires {formatTunnelTimestamp(domain.certificate.expires_at)}</p> : null}</div><div><p className="text-xs text-muted-foreground">Target</p><p className="mt-1 break-all font-mono text-xs">{domain.dns.target}</p></div></div>{domain.certificate.failure ? <Alert variant="warning"><HugeiconsIcon icon={Wrench01Icon} /><div><AlertTitle>Certificate needs attention</AlertTitle><AlertDescription>Paperboat kept the last known good certificate. Review DNS/CAA records, then retry verification.</AlertDescription></div></Alert> : null}{instructions[domain.id] ? <DNSInstructionBlock instructions={instructions[domain.id]} /> : null}</CardContent><CardFooter className="flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void showInstructions(domain)} disabled={Boolean(busy)}>{busy === `instructions:${domain.id}` ? <Spinner /> : null}{instructions[domain.id] ? "DNS instructions shown" : "Show DNS instructions"}</Button><Button variant="outline" size="sm" onClick={() => void verify(domain)} disabled={Boolean(busy) || domain.state === "ready"}>{busy === `verify:${domain.id}` ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />}Verify now</Button><Button variant="destructive-outline" size="sm" onClick={() => void remove(domain)} disabled={Boolean(busy)}>{busy === `delete:${domain.id}` ? <Spinner /> : <HugeiconsIcon icon={Delete02Icon} />}Remove</Button></CardFooter></Card>)}</div>}
    </div>
  );
}

function originTLSFor(route: TunnelRoute): OriginTLS {
  return route.origin.tls || { verification: "not_applicable", server_name: null, ca_reference: null, client_credential_reference: null };
}

function RouteEditor({ route, client, onSaved }: { route: TunnelRoute; client: PreviewTunnelClient; onSaved: () => Promise<void> }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(route.name);
  const [address, setAddress] = React.useState(route.origin.address);
  const [scheme, setScheme] = React.useState(route.origin.scheme);
  const [preserveHost, setPreserveHost] = React.useState(route.origin.preserve_host);
  const [hostOverride, setHostOverride] = React.useState(route.origin.host_override || "");
  const [verification, setVerification] = React.useState(originTLSFor(route).verification);
  const [serverName, setServerName] = React.useState(originTLSFor(route).server_name || "");
  const [caReference, setCAReference] = React.useState(originTLSFor(route).ca_reference || "");
  const [clientCredentialReference, setClientCredentialReference] = React.useState(originTLSFor(route).client_credential_reference || "");
  const [pathPrefix, setPathPrefix] = React.useState(route.path_prefix || "");
  const [connectTimeout, setConnectTimeout] = React.useState(String(route.connect_timeout_ms));
  const [idleTimeout, setIdleTimeout] = React.useState(String(route.idle_timeout_ms));
  const [maxStreams, setMaxStreams] = React.useState(String(route.max_concurrent_streams));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    if (!open) return;
    setName(route.name); setAddress(route.origin.address); setScheme(route.origin.scheme); setPreserveHost(route.origin.preserve_host); setHostOverride(route.origin.host_override || "");
    const tls = originTLSFor(route); setVerification(tls.verification); setServerName(tls.server_name || ""); setCAReference(tls.ca_reference || ""); setClientCredentialReference(tls.client_credential_reference || "");
    setPathPrefix(route.path_prefix || ""); setConnectTimeout(String(route.connect_timeout_ms)); setIdleTimeout(String(route.idle_timeout_ms)); setMaxStreams(String(route.max_concurrent_streams)); setError(undefined);
  }, [open, route]);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true); setError(undefined);
    const tls = scheme === "https" ? { verification, server_name: serverName || null, ca_reference: verification === "custom_ca" ? caReference || null : null, client_credential_reference: clientCredentialReference || null } : undefined;
    const origin: RouteOrigin = { scheme, address: address.trim(), preserve_host: preserveHost, host_override: hostOverride.trim() || null, ...(tls ? { tls } : {}) };
    try {
      const current = await client.getRoute(route.tunnel_id, route.id);
      const result = await client.updateRoute(route.tunnel_id, route.id, { name: name.trim(), path_prefix: pathPrefix.trim() || null, origin, connect_timeout_ms: Number(connectTimeout), idle_timeout_ms: Number(idleTimeout), max_concurrent_streams: Number(maxStreams) }, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("route-update") });
      if (isOperation(result)) {
        const completed = await waitForOperation(client, result);
        if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      }
      toast.success("Route update requested.");
      setOpen(false);
      await onSaved();
    } catch (saveError) {
      setError(errorText(saveError, "The route changed before it could be updated."));
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 border-t pt-3"><Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? "Hide origin controls" : "Edit origin controls"}</Button>{open ? <form className="mt-3 space-y-4 rounded-lg border bg-muted/20 p-3" onSubmit={(event) => void save(event)}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label htmlFor={`route-name-${route.id}`} className="text-xs font-medium">Route name</label><Input id={`route-name-${route.id}`} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></div><div className="space-y-2"><label htmlFor={`route-path-${route.id}`} className="text-xs font-medium">Path prefix</label><Input id={`route-path-${route.id}`} value={pathPrefix} onChange={(event) => setPathPrefix(event.target.value)} placeholder="/ (optional)" disabled={busy} /></div></div><div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]"><div className="space-y-2"><label htmlFor={`route-scheme-${route.id}`} className="text-xs font-medium">Origin scheme</label><NativeSelect id={`route-scheme-${route.id}`} value={scheme} onChange={(event) => setScheme(event.target.value as RouteOrigin["scheme"])} disabled={busy}>{["http", "https", "h2c", "unix", "tcp"].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}</NativeSelect></div><div className="space-y-2"><label htmlFor={`route-address-${route.id}`} className="text-xs font-medium">Origin address</label><Input id={`route-address-${route.id}`} value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy} /></div></div>{scheme === "https" ? <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label htmlFor={`route-tls-${route.id}`} className="text-xs font-medium">TLS verification</label><NativeSelect id={`route-tls-${route.id}`} value={verification} onChange={(event) => setVerification(event.target.value as OriginTLS["verification"])} disabled={busy}><NativeSelectOption value="system">System trust</NativeSelectOption><NativeSelectOption value="custom_ca">Custom CA reference</NativeSelectOption><NativeSelectOption value="insecure_development">Insecure development only</NativeSelectOption></NativeSelect></div><div className="space-y-2"><label htmlFor={`route-sni-${route.id}`} className="text-xs font-medium">SNI / server name</label><Input id={`route-sni-${route.id}`} value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="origin.example.com" disabled={busy} /></div>{verification === "custom_ca" ? <div className="space-y-2"><label htmlFor={`route-ca-${route.id}`} className="text-xs font-medium">CA reference</label><Input id={`route-ca-${route.id}`} value={caReference} onChange={(event) => setCAReference(event.target.value)} placeholder="ca_ref_…" autoComplete="off" disabled={busy} /></div> : null}<div className="space-y-2"><label htmlFor={`route-mtls-${route.id}`} className="text-xs font-medium">mTLS credential reference</label><Input id={`route-mtls-${route.id}`} value={clientCredentialReference} onChange={(event) => setClientCredentialReference(event.target.value)} placeholder="credential_ref_…" autoComplete="off" disabled={busy} /></div></div> : null}<div className="grid gap-3 sm:grid-cols-3"><div className="space-y-2"><label htmlFor={`route-connect-${route.id}`} className="text-xs font-medium">Connect timeout (ms)</label><Input id={`route-connect-${route.id}`} type="number" min={100} max={120000} value={connectTimeout} onChange={(event) => setConnectTimeout(event.target.value)} disabled={busy} /></div><div className="space-y-2"><label htmlFor={`route-idle-${route.id}`} className="text-xs font-medium">Idle timeout (ms)</label><Input id={`route-idle-${route.id}`} type="number" min={1000} max={3600000} value={idleTimeout} onChange={(event) => setIdleTimeout(event.target.value)} disabled={busy} /></div><div className="space-y-2"><label htmlFor={`route-streams-${route.id}`} className="text-xs font-medium">Concurrent streams</label><Input id={`route-streams-${route.id}`} type="number" min={1} max={10000} value={maxStreams} onChange={(event) => setMaxStreams(event.target.value)} disabled={busy} /></div></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={preserveHost} onChange={(event) => setPreserveHost(event.target.checked)} disabled={busy} />Preserve the public Host header at the origin</label>{preserveHost ? null : <div className="space-y-2"><label htmlFor={`route-host-${route.id}`} className="text-xs font-medium">Origin Host override</label><Input id={`route-host-${route.id}`} value={hostOverride} onChange={(event) => setHostOverride(event.target.value)} placeholder="origin.example.com" disabled={busy} /></div>}{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" size="sm" disabled={busy || !name.trim() || !address.trim()}>{busy ? <Spinner /> : <HugeiconsIcon icon={Tick01Icon} />}Save route</Button></div></form> : null}</div>;
}

export function RouteManagementPanel({ routes, client, onSaved }: { routes: TunnelRoute[]; client: PreviewTunnelClient; onSaved: () => Promise<void> }): React.ReactElement {
  if (routes.length === 0) return <Card><Empty className="py-12"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={Wrench01Icon} /></EmptyMedia><EmptyTitle>No active routes</EmptyTitle><EmptyDescription>Add a route from the tunnel&apos;s owner host. The dashboard does not invent an origin address.</EmptyDescription></EmptyHeader></Empty></Card>;
  return <div className="space-y-3">{routes.map((route) => <Card key={route.id}><CardContent className="p-4"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start"><div className="min-w-0"><p className="font-heading text-sm font-semibold">{route.name}</p><p className="mt-1 truncate font-mono text-xs text-muted-foreground">{routeMatchLabel(route)}</p><p className="mt-2 text-xs text-muted-foreground">Generation <span className="font-mono text-foreground">{route.generation}</span> · priority <span className="font-mono text-foreground">{route.priority}</span></p></div><div className="min-w-0"><p className="text-xs text-muted-foreground">Origin</p><p className="truncate font-mono text-xs">{routeOriginLabel(route)}</p><p className="mt-2 text-xs text-muted-foreground">{route.origin.preserve_host ? "Preserves public Host" : route.origin.host_override ? `Host → ${route.origin.host_override}` : "Origin Host policy not set"}</p></div><div className="flex items-center gap-2"><Badge variant={route.desired_state === "active" ? "success" : route.desired_state === "disabled" ? "secondary" : "error"}>{route.desired_state}</Badge><span className="font-mono text-xs text-muted-foreground">g{route.generation}</span></div></div><RouteEditor route={route} client={client} onSaved={onSaved} /></CardContent></Card>)}</div>;
}

export function ConnectorManagementPanel({ tunnelID, tunnel, connectors, client, onRefresh }: { tunnelID: string; tunnel: Tunnel; connectors: Connector[]; client: PreviewTunnelClient; onRefresh: () => Promise<void> }): React.ReactElement {
  const [busy, setBusy] = React.useState<string>();
  const [operation, setOperation] = React.useState<Operation>();

  async function rotate(): Promise<void> {
    setBusy("rotate");
    try {
      const result = await client.rotateTunnelCredentials(tunnelID, { ifMatch: tunnel.etag, idempotencyKey: makeIdempotencyKey("credential-rotate") });
      setOperation(result);
      const completed = await waitForOperation(client, result);
      setOperation(completed);
      if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      toast.success("Credential rotation completed.");
      await onRefresh();
    } catch (rotateError) {
      toast.error("Credential rotation did not complete.", { description: errorText(rotateError, "Refresh and retry when connectors are available.") });
    } finally { setBusy(undefined); }
  }

  async function action(connector: Connector, kind: "drain" | "revoke"): Promise<void> {
    setBusy(`${kind}:${connector.id}`);
    try {
      const current = await client.getConnector(tunnelID, connector.id);
      const result = kind === "drain"
        ? await client.drainConnector(tunnelID, connector.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("connector-drain") })
        : await client.revokeConnector(tunnelID, connector.id, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("connector-revoke") });
      if (isOperation(result)) {
        const completed = await waitForOperation(client, result);
        if (completed.state !== "succeeded") throw new Error(operationMessage(completed));
      }
      toast.success(kind === "drain" ? "Connector drain requested." : "Connector revoked.");
      await onRefresh();
    } catch (actionError) {
      toast.error(`Could not ${kind} connector.`, { description: errorText(actionError, "The connector changed; refresh and retry.") });
    } finally { setBusy(undefined); }
  }

  return <div className="space-y-3" data-testid="tunnel-connectors-panel"><Card><CardHeader className="gap-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="font-heading text-base">Connected hosts and replicas</CardTitle><CardDescription>Connector identities are host-owned. The dashboard never displays enrollment credentials.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void rotate()} disabled={Boolean(busy) || connectors.length === 0}>{busy === "rotate" ? <Spinner /> : <HugeiconsIcon icon={Rotate01Icon} />}Rotate credentials</Button></div></CardHeader><CardContent>{operation ? <div className="mb-4 rounded-lg border bg-muted/28 p-3" role="status" aria-live="polite"><div className="flex items-center justify-between gap-3 text-sm"><span>{operationMessage(operation)}</span><span className="font-mono text-xs">{shortID(operation.id)}</span></div><Progress value={operation.progress} className="mt-2"><ProgressTrack><ProgressIndicator /></ProgressTrack><ProgressValue /></Progress></div> : null}{connectors.length === 0 ? <Empty className="py-10"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={Shield01Icon} /></EmptyMedia><EmptyTitle>No connected replicas</EmptyTitle><EmptyDescription>Run <code className="font-mono text-foreground">pb tunnel connect {tunnel.name}</code> on another enrolled host. Enrollment is intentionally host-only.</EmptyDescription></EmptyHeader></Empty> : <div className="grid gap-3 lg:grid-cols-2">{connectors.map((connector) => { const status = connectorStatus(connector); const actionBusy = busy?.endsWith(connector.id); return <Card key={connector.id} className="bg-muted/12"><CardHeader className="gap-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-heading text-sm">Host {shortID(connector.host_id)}</CardTitle><CardDescription className="mt-1 font-mono text-xs">{shortID(connector.id)} · session {connector.last_session_id ? shortID(connector.last_session_id) : "none"}</CardDescription></div><Badge variant={status.variant}>{status.label}</Badge></div></CardHeader><CardContent><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Runtime</dt><dd className="mt-1">{connector.operating_system || "Unknown"}/{connector.architecture || "unknown"}</dd></div><div><dt className="text-xs text-muted-foreground">Version</dt><dd className="mt-1 font-mono text-xs">{connector.software_version || "Unknown"}</dd></div><div><dt className="text-xs text-muted-foreground">Config generation</dt><dd className="mt-1 font-mono text-xs">{connector.last_applied_config_generation ?? "Pending"}</dd></div><div><dt className="text-xs text-muted-foreground">Credential generation</dt><dd className="mt-1 font-mono text-xs">{connector.rotation_generation}</dd></div><div><dt className="text-xs text-muted-foreground">Last heartbeat</dt><dd className="mt-1 tabular-nums">{formatTunnelTimestamp(connector.last_heartbeat_at)}</dd></div><div><dt className="text-xs text-muted-foreground">Drain state</dt><dd className="mt-1 capitalize">{connector.drain_state.replaceAll("_", " ")}</dd></div></dl></CardContent><CardFooter className="flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void action(connector, "drain")} disabled={Boolean(busy) || connector.desired_state !== "active"}>{actionBusy && busy?.startsWith("drain") ? <Spinner /> : null}Drain</Button><Button variant="destructive-outline" size="sm" onClick={() => void action(connector, "revoke")} disabled={Boolean(busy) || connector.desired_state === "revoked"}>{actionBusy && busy?.startsWith("revoke") ? <Spinner /> : <HugeiconsIcon icon={Delete02Icon} />}Revoke</Button></CardFooter></Card>; })}</div>}</CardContent></Card><Alert variant="info"><HugeiconsIcon icon={Shield01Icon} /><div><AlertTitle>Replica enrollment stays on the host</AlertTitle><AlertDescription>For a new replica, use the host command shown above. Reusable connector credentials are never generated, copied, or rendered in this dashboard.</AlertDescription></div></Alert></div>;
}

export function AccessPolicyPanel({ tunnel, health, events }: { tunnel: Tunnel; health?: Health; events: V1Event[] }): React.ReactElement {
  const access = health?.dimensions.access;
  const accessEvents = events.filter((event) => event.event_type.includes("access"));
  return <div className="space-y-3" data-testid="tunnel-access-panel"><Card><CardHeader><CardTitle className="font-heading text-base">Access policy</CardTitle><CardDescription>Access is evaluated at the edge for every route-bound stream.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-2"><Badge variant={tunnel.access_mode === "private" ? "warning" : "success"}>{tunnel.access_mode === "private" ? "Private" : "Public"}</Badge>{access ? <Badge variant={healthVariant(access)}>{healthDimensionLabel(access)} · {access.code}</Badge> : <Badge variant="secondary">Access health unavailable</Badge>}</div>{tunnel.access_mode === "private" ? <Alert variant="info"><HugeiconsIcon icon={Shield01Icon} /><div><AlertTitle>Local Paperboat runtime required</AlertTitle><AlertDescription>Private traffic uses the narrow PAC/system proxy through stable hostd. The browser sends no Paperboat credentials, cookies, redirects, or proof. A logged-out, revoked, expired, or unauthorized device is denied at the local/edge boundary.</AlertDescription></div></Alert> : <p className="text-sm text-muted-foreground">Public routes can be opened with their HTTPS endpoint. Connector authentication and route generation checks still apply behind the edge.</p>}<dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Policy</dt><dd className="mt-1">{tunnel.access_mode === "private" ? "Same-account device" : "Anyone with the URL"}</dd></div><div><dt className="text-xs text-muted-foreground">Recent access events</dt><dd className="mt-1">{accessEvents.length || "None reported"}</dd></div><div><dt className="text-xs text-muted-foreground">Generation</dt><dd className="mt-1 font-mono">{tunnel.generation}</dd></div></dl></CardContent></Card></div>;
}

export function LogsAndEventsPanel({ tunnelID, client, events, operations }: { tunnelID: string; client: PreviewTunnelClient; events: V1Event[]; operations: Operation[] }): React.ReactElement {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState<LogListOptions["level"]>();
  const [component, setComponent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();

  const loadLogs = React.useCallback(async (next?: string, append = false): Promise<void> => {
    setLoading(true); setError(undefined);
    try {
      const page = await client.listTunnelLogs(tunnelID, { limit: 50, cursor: next, level, component: component.trim() || undefined });
      setLogs((current) => append ? [...current, ...page.items] : page.items);
      setNextCursor(page.next_cursor || null);
    } catch (loadError) {
      setError(errorText(loadError, "Logs are temporarily unavailable."));
    } finally { setLoading(false); }
  }, [client, component, level, tunnelID]);

  React.useEffect(() => { void loadLogs(); }, [loadLogs]);

  return <div className="grid gap-4 xl:grid-cols-2" data-testid="tunnel-activity-panel"><Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-heading text-base">Operations</CardTitle><CardDescription>Resumable state from correlated operations and events.</CardDescription></div><Button variant="ghost" size="icon-sm" aria-label="Refresh logs" onClick={() => void loadLogs()} disabled={loading}><HugeiconsIcon icon={RefreshIcon} /></Button></div></CardHeader><CardContent className="space-y-3">{operations.length === 0 ? <p className="text-sm text-muted-foreground">No correlated operations are available.</p> : operations.map((operation) => <div key={operation.id} className="space-y-2 border-b pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-xs">{shortID(operation.id)}</p><p className="mt-1 text-xs text-muted-foreground">{operation.phase.replaceAll("_", " ")} · {operation.progress}%</p></div><Badge variant={operation.state === "succeeded" ? "success" : operation.state === "failed" || operation.state === "canceled" ? "error" : "warning"}>{operation.state}</Badge></div><Progress value={operation.progress}><ProgressTrack><ProgressIndicator /></ProgressTrack><ProgressValue /></Progress></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="font-heading text-base">Logs and events</CardTitle><CardDescription>Filtered, secret-safe records with an opaque cursor for resume.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"><NativeSelect aria-label="Filter log level" value={level || "all"} onChange={(event) => setLevel(event.target.value === "all" ? undefined : event.target.value as LogListOptions["level"])}><NativeSelectOption value="all">All levels</NativeSelectOption><NativeSelectOption value="debug">Debug</NativeSelectOption><NativeSelectOption value="info">Info</NativeSelectOption><NativeSelectOption value="warn">Warning</NativeSelectOption><NativeSelectOption value="error">Error</NativeSelectOption></NativeSelect><Input aria-label="Filter log component" value={component} onChange={(event) => setComponent(event.target.value)} placeholder="Filter component" /><Button variant="outline" size="sm" onClick={() => void loadLogs()} disabled={loading}>{loading ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />}Apply</Button></div>{error ? <Alert variant="warning"><HugeiconsIcon icon={Cancel01Icon} /><div><AlertTitle>Logs unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></div></Alert> : null}{logs.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No logs match these filters.</p> : <div className="max-h-96 space-y-3 overflow-auto" aria-live="polite">{logs.map((log) => <div key={`${log.id}:${log.cursor}`} className="border-b pb-3 last:border-0"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Badge variant={log.level === "error" ? "error" : log.level === "warn" ? "warning" : "secondary"}>{log.level}</Badge><span className="truncate text-sm font-medium">{log.component}</span></div><time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={log.occurred_at}>{formatTunnelTimestamp(log.occurred_at)}</time></div><p className="mt-1 text-sm">{log.message}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{log.code} · {shortID(log.correlation_id)}</p></div>)}</div>}{nextCursor ? <Button variant="outline" size="sm" onClick={() => void loadLogs(nextCursor, true)} disabled={loading}>{loading ? <Spinner /> : null}Load older logs</Button> : null}<div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Recent events</p>{events.length === 0 ? <p className="text-sm text-muted-foreground">No recent events.</p> : <div className="space-y-3">{events.slice(0, 12).map((event) => <div key={event.id} className="border-b pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{event.event_type.replaceAll("_", " ")}</p><time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={event.occurred_at}>{formatTunnelTimestamp(event.occurred_at)}</time></div><p className="mt-1 font-mono text-xs text-muted-foreground">{shortID(event.correlation_id)}{operationIDFromEvent(event) ? ` · ${shortID(operationIDFromEvent(event) || "")}` : ""}</p></div>)}</div>}</div></CardContent></Card></div>;
}

export function TunnelSettingsPanel({ tunnel, client, onSaved }: { tunnel: Tunnel; client: PreviewTunnelClient; onSaved: () => Promise<void> }): React.ReactElement {
  const [name, setName] = React.useState(tunnel.name);
  const [accessMode, setAccessMode] = React.useState(tunnel.access_mode);
  const [expiresAt, setExpiresAt] = React.useState(tunnel.expires_at ? tunnel.expires_at.slice(0, 16) : "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => { setName(tunnel.name); setAccessMode(tunnel.access_mode); setExpiresAt(tunnel.expires_at ? tunnel.expires_at.slice(0, 16) : ""); }, [tunnel]);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy(true); setError(undefined);
    try {
      const current = await client.getTunnel(tunnel.id);
      const result = await client.updateTunnel(tunnel.id, { name: name.trim(), access_mode: accessMode, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null }, { ifMatch: current.etag, idempotencyKey: makeIdempotencyKey("tunnel-settings") });
      if (isOperation(result)) { const completed = await waitForOperation(client, result); if (completed.state !== "succeeded") throw new Error(operationMessage(completed)); }
      toast.success("Tunnel settings update requested."); await onSaved();
    } catch (saveError) { setError(errorText(saveError, "The tunnel changed before settings could be saved.")); } finally { setBusy(false); }
  }

  return <div className="space-y-3" data-testid="tunnel-settings-panel"><Card><CardHeader><CardTitle className="font-heading text-base">Tunnel settings</CardTitle><CardDescription>Changes create a new durable configuration generation. The last known good route stays active until the replacement is ready.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(event) => void save(event)}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="tunnel-settings-name" className="text-sm font-medium">Name</label><Input id="tunnel-settings-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></div><div className="space-y-2"><label htmlFor="tunnel-settings-access" className="text-sm font-medium">Access mode</label><NativeSelect id="tunnel-settings-access" value={accessMode} onChange={(event) => setAccessMode(event.target.value as Tunnel["access_mode"])} disabled={busy}><NativeSelectOption value="public">Public</NativeSelectOption><NativeSelectOption value="private">Private</NativeSelectOption></NativeSelect></div></div><div className="space-y-2"><label htmlFor="tunnel-settings-expires" className="text-sm font-medium">Expiry</label><Input id="tunnel-settings-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">Leave empty for no maximum lifetime. Existing DNS and certificates are preserved through connector loss.</p></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<Button type="submit" disabled={busy || !name.trim()}>{busy ? <Spinner /> : <HugeiconsIcon icon={Tick01Icon} />}Save settings</Button></form></CardContent></Card><Alert variant="info"><HugeiconsIcon icon={Wrench01Icon} /><div><AlertTitle>Repair actions stay explicit</AlertTitle><AlertDescription>Use the health panel&apos;s repair guidance, refresh after a retry, and repair the owner host with <code className="font-mono">pb tunnel repair</code>. The dashboard never marks a tunnel repaired until the server reports the new generation.</AlertDescription></div></Alert></div>;
}

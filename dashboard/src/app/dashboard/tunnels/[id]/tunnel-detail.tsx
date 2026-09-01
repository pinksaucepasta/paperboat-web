"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  LinkSquare02Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import {
  AccessPolicyPanel,
  ConnectorManagementPanel,
  LogsAndEventsPanel,
  RouteManagementPanel,
  TunnelDomainsPanel,
  TunnelSettingsPanel,
} from "@/components/tunnels/tunnel-management-panels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import {
  isPreviewTunnelError,
  makeIdempotencyKey,
  PreviewTunnelClient,
  type Connector,
  type Health,
  type Operation,
  type Tunnel,
  type TunnelRoute,
  type V1Event,
} from "@/lib/api/preview-tunnel-v1";
import {
  formatTunnelTimestamp,
  healthDimensionLabel,
  healthVariant,
  importantHealthDimensions,
  operationIDFromEvent,
  safeTunnelEndpoint,
  tunnelStatus,
} from "@/lib/tunnel-ui";

interface TunnelData {
  tunnel: Tunnel;
  health?: Health;
  routes: TunnelRoute[];
  connectors: Connector[];
  events: V1Event[];
  operations: Operation[];
  partialErrors: string[];
}

function messageFor(error: unknown, fallback: string): string {
  if (isPreviewTunnelError(error)) return error.message;
  return fallback;
}

function shortID(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 9)}…${value.slice(-5)}`;
}

async function loadTunnelData(client: PreviewTunnelClient, tunnelID: string): Promise<TunnelData> {
  const [tunnelResult, healthResult, routesResult, connectorsResult, eventsResult] = await Promise.allSettled([
    client.getTunnel(tunnelID),
    client.getTunnelStatus(tunnelID),
    client.listRoutes(tunnelID, { limit: 200 }),
    client.listConnectors(tunnelID, { limit: 200 }),
    client.listEvents("tunnel", tunnelID, { limit: 100 }),
  ]);
  if (tunnelResult.status === "rejected") throw tunnelResult.reason;
  const partialErrors: string[] = [];
  if (healthResult.status === "rejected") partialErrors.push("Health dimensions are unavailable.");
  if (routesResult.status === "rejected") partialErrors.push("Routes are unavailable.");
  if (connectorsResult.status === "rejected") partialErrors.push("Connected hosts are unavailable.");
  if (eventsResult.status === "rejected") partialErrors.push("Recent activity is unavailable.");
  const events = eventsResult.status === "fulfilled" ? eventsResult.value.items : [];
  const operationIDs = [...new Set(events.map(operationIDFromEvent).filter((value): value is string => Boolean(value)))].slice(0, 20);
  const operationResults = await Promise.allSettled(operationIDs.map((id) => client.getOperation(id)));
  const operations = operationResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (operationResults.some((result) => result.status === "rejected")) partialErrors.push("Some operation details are unavailable.");
  return {
    tunnel: tunnelResult.value,
    health: healthResult.status === "fulfilled" ? healthResult.value : undefined,
    routes: routesResult.status === "fulfilled" ? routesResult.value.items : [],
    connectors: connectorsResult.status === "fulfilled" ? connectorsResult.value.items : [],
    events,
    operations,
    partialErrors,
  };
}

function TunnelDetailLoading(): React.ReactElement {
  return (
    <div className="space-y-6" role="status" aria-label="Loading tunnel" aria-busy="true">
      <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((value) => <Skeleton key={value} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

function TunnelBadge({ tunnel }: { tunnel: Tunnel }): React.ReactElement {
  const status = tunnelStatus(tunnel);
  return <Badge variant={status.variant} role="status" className="gap-1.5"><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status.label}</Badge>;
}

export function TunnelDetail({ tunnelID }: { tunnelID: string }): React.ReactElement {
  const router = useRouter();
  const client = React.useMemo(() => new PreviewTunnelClient(), []);
  const [data, setData] = React.useState<TunnelData>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState<"pause" | "resume" | "delete">();
  const [activeOperation, setActiveOperation] = React.useState<Operation>();
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = React.useCallback(async (background = false) => {
    if (!background) setLoading(true);
    if (!background) setError(undefined);
    try {
      const next = await loadTunnelData(client, tunnelID);
      if (mounted.current) {
        setData(next);
        setError(undefined);
      }
    } catch (loadError) {
      if (mounted.current) setError(messageFor(loadError, "This tunnel is temporarily unavailable."));
    } finally {
      if (mounted.current && !background) setLoading(false);
    }
  }, [client, tunnelID]);

  React.useEffect(() => {
    const request = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(request);
  }, [refresh]);

  React.useEffect(() => {
    if (!data?.tunnel.id) return;
    const subscription = client.subscribeEvents("tunnel", data.tunnel.id, {
      maxReconnectAttempts: 3,
      onEvent: () => void refresh(true),
      onError: (subscriptionError) => setError(subscriptionError.message),
    });
    return () => subscription.close();
  }, [client, data?.tunnel.id, refresh]);

  async function mutate(action: "pause" | "resume" | "delete"): Promise<void> {
    if (!data) return;
    setBusy(action);
    setActiveOperation(undefined);
    try {
      const options = { ifMatch: data.tunnel.etag, idempotencyKey: makeIdempotencyKey(`tunnel-${action}`) };
      const result = action === "pause"
        ? await client.pauseTunnel(data.tunnel.id, options)
        : action === "resume"
          ? await client.resumeTunnel(data.tunnel.id, options)
          : await client.deleteTunnel(data.tunnel.id, options);
      if (result?.kind === "operation") setActiveOperation(result);
      toast.success(action === "pause" ? "Tunnel pause requested." : action === "resume" ? "Tunnel resume requested." : "Tunnel deletion requested.");
      if (action === "delete") {
        router.replace("/dashboard/tunnels");
        return;
      }
      await refresh();
    } catch (mutationError) {
      const conflict = isPreviewTunnelError(mutationError) && mutationError.isConflict;
      toast.error(conflict ? "Tunnel changed before the action was applied." : `Could not ${action} the tunnel.`, {
        description: messageFor(mutationError, "Refresh the tunnel and retry."),
      });
      if (conflict) await refresh();
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  }

  async function copyEndpoint(): Promise<void> {
    const endpoint = data ? safeTunnelEndpoint(data.tunnel.stable_endpoint) : undefined;
    try {
      if (!endpoint || !navigator.clipboard) throw new Error("copy unavailable");
      await navigator.clipboard.writeText(endpoint);
      toast.success("Stable endpoint copied.");
    } catch {
      toast.error("Could not copy the stable endpoint.");
    }
  }

  if (loading && !data) return <TunnelDetailLoading />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/dashboard/tunnels" />}><HugeiconsIcon icon={ArrowLeft01Icon} />Back to tunnels</Button>
        <Alert variant="error"><HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" /><div><AlertTitle>Tunnel unavailable</AlertTitle><AlertDescription><p>{error || "Paperboat could not load this tunnel."}</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></AlertDescription></div></Alert>
      </div>
    );
  }

  const { tunnel, health, routes, connectors, events, operations, partialErrors } = data;
  const endpoint = safeTunnelEndpoint(tunnel.stable_endpoint);

  return (
    <div className="space-y-6" data-testid="tunnel-detail-page">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/dashboard/tunnels" />}><HugeiconsIcon icon={ArrowLeft01Icon} />Back to tunnels</Button>
      <PageHeader
        eyebrow="Tunnel"
        title={tunnel.name}
        description={`Stable identity ${shortID(tunnel.id)} · generation ${tunnel.generation}`}
        actions={<><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>{loading ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />}Refresh</Button><TunnelBadge tunnel={tunnel} /></>}
      />

      {error ? <Alert variant="warning"><HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" /><div><AlertTitle>Live updates interrupted</AlertTitle><AlertDescription>{error} The last confirmed state remains visible.</AlertDescription></div></Alert> : null}
      {partialErrors.length > 0 ? <Alert variant="warning" data-testid="tunnel-partial-error"><HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" /><div><AlertTitle>Some tunnel details are unavailable</AlertTitle><AlertDescription>{partialErrors.join(" ")}</AlertDescription></div></Alert> : null}
      {activeOperation ? <Alert variant="info" role="status"><Spinner /><div><AlertTitle>Operation in progress</AlertTitle><AlertDescription>{activeOperation.phase.replaceAll("_", " ")} · {activeOperation.progress}% · {shortID(activeOperation.id)}</AlertDescription></div></Alert> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]" aria-label="Tunnel summary">
        <Card>
          <CardHeader><CardTitle className="font-heading text-base">Stable endpoint</CardTitle><CardDescription>The endpoint does not change when connectors restart or routes are replaced.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted/64 p-3 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1 break-all font-mono text-sm">{endpoint || "Endpoint unavailable"}</span>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void copyEndpoint()} disabled={!endpoint}><HugeiconsIcon icon={Copy01Icon} />Copy</Button>{endpoint ? <Button variant="outline" size="sm" nativeButton={false} render={<a href={endpoint} target="_blank" rel="noreferrer noopener" aria-label={tunnel.access_mode === "private" ? "Open through Paperboat" : "Open in a new tab"} />}><HugeiconsIcon icon={LinkSquare02Icon} />{tunnel.access_mode === "private" ? "Open through Paperboat" : "Open"}</Button> : null}</div>
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Access</dt><dd className="mt-1 capitalize">{tunnel.access_mode}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Desired state</dt><dd className="mt-1 capitalize">{tunnel.desired_state}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expires</dt><dd className="mt-1 tabular-nums">{formatTunnelTimestamp(tunnel.expires_at)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Created by host</dt><dd className="mt-1 font-mono text-xs">{shortID(tunnel.created_by_host_id)}</dd></div>
            </dl>
            {tunnel.access_mode === "private" ? <p className="rounded-md border border-dashed bg-muted/36 p-2 text-xs text-muted-foreground">Private traffic requires the Paperboat runtime on this machine to be installed and running with its narrow local proxy/PAC rule enabled. The browser sends no Paperboat credentials.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-base">Lifecycle</CardTitle><CardDescription>Pause preserves identity. Delete permanently retires the tunnel.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {tunnel.desired_state === "paused" ? <Button onClick={() => void mutate("resume")} disabled={Boolean(busy)}>{busy === "resume" ? <Spinner /> : <HugeiconsIcon icon={PlayIcon} />}Resume</Button> : <Button variant="outline" onClick={() => void mutate("pause")} disabled={Boolean(busy)}>{busy === "pause" ? <Spinner /> : <HugeiconsIcon icon={PauseIcon} />}Pause</Button>}
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive-outline" disabled={Boolean(busy)} />}><HugeiconsIcon icon={Delete02Icon} />Delete</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete {tunnel.name}?</AlertDialogTitle><AlertDialogDescription>This permanently retires the stable endpoint and all routes. Pausing is safer when you may use this tunnel again.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Keep tunnel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void mutate("delete")}>{busy === "delete" ? <Spinner /> : null}Delete tunnel</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="overview">
        <TabsList variant="underline" className="max-w-full overflow-x-auto">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="routes">Routes <Badge variant="secondary" size="sm">{routes.length}</Badge></TabsTab>
          <TabsTab value="domains">Domains &amp; TLS</TabsTab>
          <TabsTab value="hosts">Connected hosts <Badge variant="secondary" size="sm">{connectors.length}</Badge></TabsTab>
          <TabsTab value="access">Access</TabsTab>
          <TabsTab value="activity">Operations &amp; events</TabsTab>
          <TabsTab value="settings">Settings</TabsTab>
        </TabsList>
        <TabsPanel value="overview" className="pt-3"><HealthPanel health={health} /></TabsPanel>
        <TabsPanel value="routes" className="pt-3"><RouteManagementPanel routes={routes} client={client} onSaved={() => refresh()} /></TabsPanel>
        <TabsPanel value="domains" className="pt-3"><TunnelDomainsPanel tunnelID={tunnel.id} routes={routes} client={client} /></TabsPanel>
        <TabsPanel value="hosts" className="pt-3"><ConnectorManagementPanel tunnelID={tunnel.id} tunnel={tunnel} connectors={connectors} client={client} onRefresh={() => refresh()} /></TabsPanel>
        <TabsPanel value="access" className="pt-3"><AccessPolicyPanel tunnel={tunnel} health={health} events={events} /></TabsPanel>
        <TabsPanel value="activity" className="pt-3"><LogsAndEventsPanel tunnelID={tunnel.id} client={client} events={events} operations={operations} /></TabsPanel>
        <TabsPanel value="settings" className="pt-3"><TunnelSettingsPanel tunnel={tunnel} client={client} onSaved={() => refresh()} /></TabsPanel>
      </Tabs>
    </div>
  );
}

function HealthPanel({ health }: { health?: Health }): React.ReactElement {
  if (!health) return <EmptyPanel icon={Route01Icon} title="Health unavailable" description="Paperboat could not read the tunnel health dimensions. Refresh to retry." />;
  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-base">Health dimensions</CardTitle><CardDescription>{health.summary} {health.retrying && health.next_retry_at ? `Next retry ${formatTunnelTimestamp(health.next_retry_at)}.` : ""}</CardDescription></CardHeader>
      <CardContent className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {importantHealthDimensions(health).map(([name, dimension]) => <div key={name} className="flex items-center justify-between gap-3 bg-card p-3"><div className="min-w-0"><p className="text-sm font-medium capitalize">{name}</p><p className="truncate font-mono text-xs text-muted-foreground">{dimension.code}</p></div><Badge variant={healthVariant(dimension)}>{healthDimensionLabel(dimension)}</Badge></div>)}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ icon, title, description }: { icon: typeof Route01Icon; title: string; description: string }): React.ReactElement {
  return <Card><Empty className="py-12"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={icon} aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty></Card>;
}

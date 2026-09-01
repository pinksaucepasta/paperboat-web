"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  RefreshIcon,
  Route01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { isPreviewTunnelError, PreviewTunnelClient, type Tunnel } from "@/lib/api/preview-tunnel-v1";
import { formatTunnelTimestamp, safeTunnelEndpoint, tunnelStatus } from "@/lib/tunnel-ui";

function tunnelError(error: unknown): string {
  if (isPreviewTunnelError(error)) return error.message;
  return "Tunnels are temporarily unavailable. Retry in a moment.";
}

function shortID(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function TunnelStatusBadge({ tunnel }: { tunnel: Tunnel }): React.ReactElement {
  const status = tunnelStatus(tunnel);
  return (
    <Badge variant={status.variant} role="status" aria-label={`Tunnel status: ${status.label}`} className="gap-1.5">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status.label}
    </Badge>
  );
}

function TunnelLoading(): React.ReactElement {
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading tunnels" aria-busy="true">
      {["first", "second"].map((key) => (
        <Card key={key}>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4"><Skeleton className="h-5 w-36" /><Skeleton className="h-5 w-20" /></div>
            <Skeleton className="h-4 w-4/5" />
            <div className="grid grid-cols-2 gap-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TunnelCard({ tunnel }: { tunnel: Tunnel }): React.ReactElement {
  const endpoint = safeTunnelEndpoint(tunnel.stable_endpoint);

  async function copyEndpoint(): Promise<void> {
    try {
      if (!endpoint || !navigator.clipboard) throw new Error("copy unavailable");
      await navigator.clipboard.writeText(endpoint);
      toast.success("Stable endpoint copied.");
    } catch {
      toast.error("Could not copy the stable endpoint.");
    }
  }

  return (
    <Card className="overflow-hidden" data-testid={`tunnel-card-${tunnel.id}`}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate font-heading text-base">{tunnel.name}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{shortID(tunnel.id)}</CardDescription>
          </div>
          <TunnelStatusBadge tunnel={tunnel} />
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/64 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{endpoint || "Endpoint unavailable"}</span>
          <Button variant="ghost" size="icon-sm" aria-label={`Copy ${tunnel.name} stable endpoint`} disabled={!endpoint} onClick={() => void copyEndpoint()}>
            <HugeiconsIcon icon={Copy01Icon} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Access</dt><dd className="mt-0.5 capitalize">{tunnel.access_mode}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Expires</dt><dd className="mt-0.5 tabular-nums">{formatTunnelTimestamp(tunnel.expires_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Generation</dt><dd className="mt-0.5 font-mono text-xs">{tunnel.generation}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Last changed</dt><dd className="mt-0.5 tabular-nums">{formatTunnelTimestamp(tunnel.updated_at)}</dd></div>
        </dl>
        {tunnel.access_mode === "private" ? <p className="rounded-md border border-dashed bg-muted/36 p-2 text-xs text-muted-foreground">Private traffic requires the Paperboat runtime on this machine to be installed and running with its narrow local proxy/PAC rule enabled. The browser sends no Paperboat credentials.</p> : null}
        <Button variant="outline" className="w-full" nativeButton={false} render={<Link href={`/dashboard/tunnels/${encodeURIComponent(tunnel.id)}`} />}>
          View tunnel <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function TunnelsPage(): React.ReactElement {
  const client = React.useMemo(() => new PreviewTunnelClient(), []);
  const [tunnels, setTunnels] = React.useState<Tunnel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const page = await client.listTunnels({ limit: 200 });
      if (mounted.current) setTunnels(page.items.filter((item) => item.desired_state !== "deleted"));
    } catch (loadError) {
      if (mounted.current) setError(tunnelError(loadError));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    const request = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(request);
  }, [refresh]);

  return (
    <div className="space-y-6" data-testid="tunnels-page">
      <PageHeader
        eyebrow="Workspace"
        title="Tunnels"
        description="Stable endpoints and routes owned by Paperboat hosts. Create a tunnel from the host that can reach its origins."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />} Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="error" data-testid="tunnel-load-error">
          <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
          <div><AlertTitle>Tunnels unavailable</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></AlertDescription></div>
        </Alert>
      ) : null}

      <section aria-labelledby="tunnel-list-title" className="space-y-3">
        <div>
          <h2 id="tunnel-list-title" className="font-heading text-base font-semibold">Durable tunnels</h2>
          <p className="text-sm text-muted-foreground">{tunnels.length === 0 ? "No tunnel endpoints are configured." : `${tunnels.length} ${tunnels.length === 1 ? "tunnel" : "tunnels"}`}</p>
        </div>
        {loading && tunnels.length === 0 ? <TunnelLoading /> : error && tunnels.length === 0 ? null : tunnels.length === 0 ? (
          <Card data-testid="tunnel-empty">
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon"><HugeiconsIcon icon={Route01Icon} aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>Create your first tunnel from a host</EmptyTitle>
                <EmptyDescription>Tunnel identity and origins are host-owned, so the dashboard cannot create one on the browser&apos;s machine.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="rounded-lg border bg-muted/48 px-4 py-3 text-left">
                  <p className="text-xs text-muted-foreground">Run on the host that can reach your service:</p>
                  <code className="mt-1 block font-mono text-sm">pb tunnel create</code>
                </div>
              </EmptyContent>
            </Empty>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{tunnels.map((tunnel) => <TunnelCard key={tunnel.id} tunnel={tunnel} />)}</div>
        )}
      </section>
    </div>
  );
}

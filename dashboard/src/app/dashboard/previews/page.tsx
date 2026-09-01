"use client";

import * as React from "react";
import {
  Add01Icon,
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  Globe02Icon,
  LinkSquare02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PreviewDomainPanel } from "@/components/tunnels/preview-domain-panel";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, displayErrorMessage } from "@/lib/api/client";
import {
  isPreviewTunnelError,
  makeIdempotencyKey,
  PreviewTunnelClient,
  type AccessMode,
  type Operation,
  type PreviewLease,
} from "@/lib/api/preview-tunnel-v1";
import { listMachines } from "@/lib/api/machines";
import type { Machine } from "@/lib/api/types";
import {
  formatPreviewCountdown,
  formatPreviewDate,
  originLabel,
  parsePreviewTarget,
  previewIsReady,
  previewStatus,
  safePreviewEndpoint,
  targetLabel,
  trafficLabel,
  type PreviewTargetInput,
} from "@/lib/preview-ui";

const DEFAULT_TARGET = "3000";
const DEFAULT_DURATION = "24h";
const PREVIEW_OPERATION_TIMEOUT_MS = 15_000;

const DURATION_OPTIONS = [
  { value: "30m", label: "30 minutes", milliseconds: 30 * 60 * 1_000 },
  { value: "2h", label: "2 hours", milliseconds: 2 * 60 * 60 * 1_000 },
  { value: "24h", label: "24 hours", milliseconds: 24 * 60 * 60 * 1_000 },
  { value: "7d", label: "7 days", milliseconds: 7 * 24 * 60 * 60 * 1_000 },
  { value: "indefinite", label: "Indefinite", milliseconds: undefined },
] as const;

type DurationValue = (typeof DURATION_OPTIONS)[number]["value"];

interface CreateFormState {
  deviceID: string;
  target: string;
  accessMode: AccessMode;
  duration: DurationValue;
}

function isOnlineDevice(machine: Machine): boolean {
  return machine.online && machine.state === "online";
}

function machineLabel(machine: Machine | undefined, deviceID: string): string {
  return machine?.display_name || (deviceID ? `Device ${shortID(deviceID)}` : "Unknown device");
}

function shortID(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function createDeadline(duration: DurationValue): string | null {
  const option = DURATION_OPTIONS.find((item) => item.value === duration);
  if (!option?.milliseconds) return null;
  return new Date(Date.now() + option.milliseconds).toISOString();
}

function errorMessage(error: unknown, fallback: string): string {
  if (isPreviewTunnelError(error)) return error.message;
  if (error instanceof ApiError) return error.message;
  return displayErrorMessage(error, fallback);
}

function operationFailure(operation: Operation): Error {
  return new Error(operation.error?.message || "Paperboat could not finish the preview request.");
}

interface PreviewOperationWait {
  operation?: Operation;
  timedOut: boolean;
}

async function waitForPreviewOperation(
  client: PreviewTunnelClient,
  operation: Operation,
  onProgress: (next: Operation) => void,
): Promise<PreviewOperationWait> {
  const watcher = client.watchOperation(operation.id, {
    pollIntervalMs: 500,
    maxPollIntervalMs: 2_000,
    onProgress,
  });
  let timeout: number | undefined;
  try {
    return await new Promise<PreviewOperationWait>((resolve, reject) => {
      timeout = window.setTimeout(() => resolve({ timedOut: true }), PREVIEW_OPERATION_TIMEOUT_MS);
      void watcher.done.then(
        (completed) => resolve({ operation: completed, timedOut: false }),
        reject,
      );
    });
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
    watcher.stop();
  }
}

async function readPreviewReadiness(
  client: PreviewTunnelClient,
  previewID: string,
): Promise<{ preview: PreviewLease; authoritativeReady: boolean }> {
  const preview = await client.getPreview(previewID);
  let readyEvent = false;
  try {
    const events = await client.listEvents("preview_lease", previewID, { limit: 200 });
    readyEvent = events.items.some(
      (event) =>
        event.event_type === "preview.ready" &&
        event.resource_kind === "preview_lease" &&
        event.resource_id === previewID,
    );
  } catch {
    // A missing event is deliberately treated as pending. The dashboard must
    // never turn a merely persisted lease into a ready success state.
  }
  return { preview, authoritativeReady: readyEvent && previewIsReady(preview) };
}

function PreviewStatusBadge({ preview }: { preview: PreviewLease }): React.ReactElement {
  const status = previewStatus(preview);
  return (
    <Badge variant={status.variant} role="status" aria-label={`Preview status: ${status.label}`} className="gap-1.5">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status.label}
    </Badge>
  );
}

function PreviewSkeleton(): React.ReactElement {
  return (
    <Card role="status" aria-label="Loading previews" aria-busy="true" data-testid="preview-loading">
      <CardContent className="space-y-4 p-6">
        {["wide", "medium", "short"].map((width) => (
          <div key={width} className="flex items-center gap-4">
            <Skeleton className="size-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className={width === "wide" ? "h-4 w-1/3" : width === "medium" ? "h-4 w-1/2" : "h-4 w-1/4"} />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function NoDeviceGuidance({ deviceCount, machineError }: { deviceCount: number; machineError?: string }): React.ReactElement {
  const title = machineError ? "Device availability is unknown" : deviceCount === 0 ? "Connect a device to create a preview" : "No online device is available";
  const description = machineError
    ? "Paperboat could not confirm which devices can launch a preview. Retry before creating one."
    : "The dashboard cannot expose the browser's localhost. Choose an online Paperboat device, or run the preview directly on the machine that can reach your service.";
  return (
    <Alert variant={machineError ? "warning" : "info"} data-testid="no-device-guidance">
      <HugeiconsIcon icon={Globe02Icon} aria-hidden="true" />
      <div>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
          <p>Run this on the host that can reach your service:</p>
          <code className="inline-flex rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">pb preview &lt;port&gt;</code>
          {machineError ? <p>{machineError}</p> : null}
        </AlertDescription>
      </div>
    </Alert>
  );
}

function PreviewFields({ preview, machines, liveError, liveRetry }: { preview: PreviewLease; machines: Machine[]; liveError?: string; liveRetry?: string }): React.ReactElement {
  const owner = machines.find((machine) => machine.id === preview.owner_device_id);
  const status = previewStatus(preview);
  const ownerOnline = owner ? isOnlineDevice(owner) : undefined;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PreviewStatusBadge preview={preview} />
        <Badge variant="outline">{preview.access_mode === "private" ? "Private" : "Public"}</Badge>
        {ownerOnline === false ? <Badge variant="warning">Device offline</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">{status.detail}</p>
      {preview.access_mode === "private" ? (
        <p className="rounded-md border border-dashed bg-muted/36 p-2 text-xs text-muted-foreground" data-testid={`preview-private-access-${preview.id}`}>
          Private traffic requires the Paperboat runtime on this machine to be installed and running with its narrow local proxy/PAC rule enabled. The browser sends no Paperboat credentials.
        </p>
      ) : null}
      {preview.state === "allocating" || preview.state === "connecting" ? (
        <p role="status" className="rounded-md border border-dashed bg-muted/36 p-2 text-xs text-muted-foreground" data-testid={`preview-pending-${preview.id}`}>
          Waiting for the device to report readiness. If this stays pending, run <code className="font-mono text-foreground">pb preview &lt;port&gt;</code> on the owner device.
        </p>
      ) : null}
      {liveRetry ? <p role="status" className="text-xs text-muted-foreground">Live updates retrying: {liveRetry}</p> : null}
      {liveError ? <p role="status" className="text-xs text-warning-foreground">Live updates unavailable. Refresh to check the latest state.</p> : null}
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Owner device</dt>
          <dd className="mt-1 font-medium">{machineLabel(owner, preview.owner_device_id)}</dd>
          <dd className="break-all font-mono text-xs text-muted-foreground">{preview.owner_device_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Owner session</dt>
          <dd className="mt-1 break-all font-mono text-xs text-foreground">{preview.owner_session_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Target</dt>
          <dd className="mt-1 break-all font-mono text-xs text-foreground">{targetLabel(preview.target)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Traffic</dt>
          <dd className="mt-1 font-medium">{trafficLabel(preview)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Origin</dt>
          <dd className="mt-1 font-medium">{originLabel(preview)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="mt-1 font-medium">{formatPreviewCountdown(preview.user_deadline, Date.now())}</dd>
          <dd className="text-xs text-muted-foreground">{preview.user_deadline ? formatPreviewDate(preview.user_deadline) : "No maximum lifetime"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd className="mt-1 text-foreground">{formatPreviewDate(preview.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lease deadline</dt>
          <dd className="mt-1 text-foreground">{formatPreviewDate(preview.lease_deadline)}</dd>
        </div>
      </dl>
    </>
  );
}

function PreviewCard({ preview, machines, selected, busy, liveError, liveRetry, onSelect, onCopy, onStop }: { preview: PreviewLease; machines: Machine[]; selected: boolean; busy: boolean; liveError?: string; liveRetry?: string; onSelect: () => void; onCopy: () => void; onStop: () => void }): React.ReactElement {
  const stopped = preview.state === "stopped" || preview.state === "expired";
  const endpoint = safePreviewEndpoint(preview.endpoint);
  return (
    <Card data-testid={`preview-card-${preview.id}`} className={selected ? "border-primary/48 shadow-raised" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate font-heading text-base">{targetLabel(preview.target)}</CardTitle>
            <CardDescription className="truncate font-mono text-xs" title={endpoint}>{endpoint ?? "Endpoint unavailable"}</CardDescription>
          </div>
          <PreviewStatusBadge preview={preview} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PreviewFields preview={preview} machines={machines} liveError={liveError} liveRetry={liveRetry} />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onSelect} aria-expanded={selected} aria-controls={`preview-detail-${preview.id}`}>
          {selected ? "Hide details" : "View details"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCopy} disabled={!endpoint || stopped}>
          <HugeiconsIcon icon={Copy01Icon} />Copy URL
        </Button>
        {endpoint && !stopped ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={endpoint} target="_blank" rel="noreferrer noopener" aria-label={`Open preview ${targetLabel(preview.target)}${preview.access_mode === "private" ? " through the local Paperboat proxy" : " in a new tab"}`} />}
          >
            <HugeiconsIcon icon={LinkSquare02Icon} />{preview.access_mode === "private" ? "Open through Paperboat" : "Open"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <HugeiconsIcon icon={LinkSquare02Icon} />Open
          </Button>
        )}
        {!stopped ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={busy} />}>
              {busy ? <Spinner aria-label="Stopping preview" /> : <HugeiconsIcon icon={Delete02Icon} />}
              Stop preview
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop this preview?</AlertDialogTitle>
                <AlertDialogDescription>
                  This immediately revokes the temporary lease and disables the preview URL. The device and its other resources are not changed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep preview</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onStop}>Stop preview</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default function PreviewsPage(): React.ReactElement {
  const client = React.useMemo(() => new PreviewTunnelClient(), []);
  const [items, setItems] = React.useState<PreviewLease[]>([]);
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [machineError, setMachineError] = React.useState<string>();
  const [selectedID, setSelectedID] = React.useState<string>();
  const [liveError, setLiveError] = React.useState<string>();
  const [liveRetry, setLiveRetry] = React.useState<string>();
  const [busyID, setBusyID] = React.useState<string>();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string>();
  const [createOperation, setCreateOperation] = React.useState<Operation>();
  const [form, setForm] = React.useState<CreateFormState>({ deviceID: "", target: DEFAULT_TARGET, accessMode: "public", duration: DEFAULT_DURATION });
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = React.useCallback(async (background = false) => {
    if (!background) setLoading(true);
    if (!background) setError(undefined);
    const [previewResult, machineResult] = await Promise.allSettled([client.listPreviews({ limit: 200 }), listMachines()]);
    if (!mounted.current) return;
    if (previewResult.status === "fulfilled") {
      setItems(previewResult.value.items);
      setError(undefined);
    } else {
      setError(errorMessage(previewResult.reason, "Previews are temporarily unavailable. Retry in a moment."));
    }
    if (machineResult.status === "fulfilled") {
      setMachines(machineResult.value);
      setMachineError(undefined);
    } else {
      setMachineError(errorMessage(machineResult.reason, "Device availability is temporarily unavailable."));
    }
    if (!background) setLoading(false);
  }, [client]);

  React.useEffect(() => {
    const request = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(request);
  }, [refresh]);

  React.useEffect(() => {
    if (selectedID && !items.some((item) => item.id === selectedID)) setSelectedID(undefined);
  }, [items, selectedID]);

  const selectedPreview = items.find((item) => item.id === selectedID);
  const selectedEndpoint = selectedPreview ? safePreviewEndpoint(selectedPreview.endpoint) : undefined;
  React.useEffect(() => {
    if (!selectedID) {
      setLiveError(undefined);
      setLiveRetry(undefined);
      return;
    }
    setLiveError(undefined);
    setLiveRetry(undefined);
    const subscription = client.subscribeEvents("preview_lease", selectedID, {
      maxReconnectAttempts: 3,
      onEvent: () => void refresh(true),
      onRetry: ({ error: retryError }) => setLiveRetry(retryError.message),
      onError: (subscriptionError) => setLiveError(subscriptionError.message),
    });
    return () => subscription.close();
  }, [client, refresh, selectedID]);

  const onlineDevices = machines.filter(isOnlineDevice);
  const ownerOffline = items.some((item) => {
    const owner = machines.find((machine) => machine.id === item.owner_device_id);
    return owner && !isOnlineDevice(owner);
  });

  function openCreateDialog() {
    setForm({
      deviceID: onlineDevices[0]?.id || "",
      target: DEFAULT_TARGET,
      accessMode: "public",
      duration: DEFAULT_DURATION,
    });
    setCreateError(undefined);
    setCreateOperation(undefined);
    setCreateOpen(true);
  }

  async function createPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const device = onlineDevices.find((item) => item.id === form.deviceID);
    if (!device) {
      setCreateError("Choose an online device before creating a preview.");
      return;
    }
    let target: PreviewTargetInput;
    try {
      target = parsePreviewTarget(form.target);
    } catch (targetError) {
      setCreateError(targetError instanceof Error ? targetError.message : "Enter a valid local origin.");
      return;
    }
    if (target.scheme === "tcp" && form.accessMode !== "private") {
      setCreateError("TCP previews require Private access.");
      return;
    }
    setCreating(true);
    setCreateError(undefined);
    setCreateOperation(undefined);
    // The server binds this opaque nonce to one preview lease and its create
    // operation. It is deliberately not the browser/dashboard session: one
    // dashboard can own several previews, and closing the browser must not
    // accidentally couple their lifetimes.
    const ownerSessionID = makeIdempotencyKey("preview-owner");
    try {
      const result = await client.createPreview({ owner_device_id: device.id, owner_session_id: ownerSessionID, target, access_mode: form.accessMode, expires_at: createDeadline(form.duration), domains: [] });
      let previewID: string;
      let preview: PreviewLease;
      if (result.kind === "operation") {
        setCreateOperation(result);
        const outcome = await waitForPreviewOperation(client, result, (operation) => setCreateOperation(operation));
        if (outcome.operation && outcome.operation.state !== "succeeded") throw operationFailure(outcome.operation);
        previewID = result.resource_id;
      } else {
        previewID = result.id;
      }
      const readiness = await readPreviewReadiness(client, previewID);
      preview = readiness.preview;
      if (!mounted.current) return;
      setItems((current) => [preview, ...current.filter((item) => item.id !== preview.id)]);
      setSelectedID(preview.id);
      setCreateOpen(false);
      if (readiness.authoritativeReady) {
        toast.success("Preview ready.");
      } else {
        toast.info("Preview request accepted.", {
          description: "Waiting for the device to report ready. If it stays pending, run pb preview <port> on the owner device.",
        });
      }
      void refresh(true);
    } catch (createRequestError) {
      if (mounted.current) setCreateError(errorMessage(createRequestError, "Preview creation failed. Retry when the device is online."));
    } finally {
      if (mounted.current) {
        setCreating(false);
        setCreateOperation(undefined);
      }
    }
  }

  async function copyPreviewURL(preview: PreviewLease) {
    try {
      const endpoint = safePreviewEndpoint(preview.endpoint);
      if (!endpoint) throw new Error("The preview endpoint is unavailable.");
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(endpoint);
      toast.success("Preview URL copied.");
    } catch (copyError) {
      toast.error("Could not copy the preview URL.", { description: errorMessage(copyError, "Copy it from the preview details instead.") });
    }
  }

  async function stopPreview(preview: PreviewLease) {
    setBusyID(preview.id);
    try {
      const current = await client.getPreviewWithETag(preview.id);
      const result = await client.stopPreview(preview.id, { ifMatch: current.etag });
      if (result?.kind === "operation") {
        const watcher = client.watchOperation(result.id, { pollIntervalMs: 500, maxPollIntervalMs: 2_000 });
        try {
          const completed = await watcher.done;
          if (completed.state !== "succeeded") throw operationFailure(completed);
        } finally {
          watcher.stop();
        }
      }
      toast.success("Preview stopped.");
      await refresh();
    } catch (stopError) {
      const conflict = isPreviewTunnelError(stopError) && stopError.isConflict;
      toast.error(conflict ? "Preview changed before it could be stopped." : "Could not stop preview.", { description: errorMessage(stopError, "Refresh the page and retry.") });
    } finally {
      if (mounted.current) setBusyID(undefined);
    }
  }

  return (
    <div className="space-y-6" data-testid="previews-page">
      <PageHeader
        eyebrow="Workspace"
        title="Previews"
        description="Temporary URLs for local services, owned by an online Paperboat device."
        actions={<><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>{loading ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} />}Refresh</Button><Button size="sm" onClick={openCreateDialog}><HugeiconsIcon icon={Add01Icon} />Create preview</Button></>}
      />

      {error ? <Alert variant="error" data-testid="preview-load-error"><HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" /><div><AlertTitle>Previews unavailable</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry</Button></AlertDescription></div></Alert> : null}
      {!machineError && ownerOffline ? <Alert variant="warning" data-testid="preview-offline-state"><HugeiconsIcon icon={Globe02Icon} aria-hidden="true" /><div><AlertTitle>Owner device offline</AlertTitle><AlertDescription>The preview endpoint is preserved, but its local origin cannot serve requests until the device reconnects.</AlertDescription></div></Alert> : null}
      {machineError ? <NoDeviceGuidance deviceCount={machines.length} machineError={machineError} /> : null}
      {!loading && !machineError && onlineDevices.length === 0 ? <NoDeviceGuidance deviceCount={machines.length} /> : null}

      <section aria-labelledby="preview-list-title" className="space-y-3" data-testid="preview-list">
        <div className="flex items-center justify-between gap-3"><div><h2 id="preview-list-title" className="font-heading text-base font-semibold">Active previews</h2><p className="text-sm text-muted-foreground">{items.length === 0 ? "No temporary endpoints are active." : `${items.length} ${items.length === 1 ? "preview" : "previews"}`}</p></div>{loading && items.length > 0 ? <span role="status" className="text-xs text-muted-foreground">Refreshing…</span> : null}</div>
        {loading && items.length === 0 ? <PreviewSkeleton /> : error && items.length === 0 ? null : items.length === 0 ? <Card data-testid="preview-empty"><Empty className="py-14"><EmptyHeader><EmptyMedia variant="icon"><HugeiconsIcon icon={Globe02Icon} aria-hidden="true" /></EmptyMedia><EmptyTitle>No active previews</EmptyTitle><EmptyDescription>Create a temporary URL for a local service from an online Paperboat device.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={openCreateDialog} disabled={onlineDevices.length === 0}><HugeiconsIcon icon={Add01Icon} />Create preview</Button></EmptyContent></Empty></Card> : <div className="grid gap-4 xl:grid-cols-2">{items.map((preview) => <PreviewCard key={preview.id} preview={preview} machines={machines} selected={selectedID === preview.id} busy={busyID === preview.id} liveError={selectedID === preview.id ? liveError : undefined} liveRetry={selectedID === preview.id ? liveRetry : undefined} onSelect={() => setSelectedID((current) => current === preview.id ? undefined : preview.id)} onCopy={() => void copyPreviewURL(preview)} onStop={() => void stopPreview(preview)} />)}</div>}
      </section>

      {selectedPreview ? <div id={`preview-detail-${selectedPreview.id}`} data-testid="preview-detail" className="space-y-4"><Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-heading text-base">Preview details</CardTitle><CardDescription>{targetLabel(selectedPreview.target)} · created {formatPreviewDate(selectedPreview.created_at)}</CardDescription></div><Button variant="ghost" size="icon-sm" aria-label="Close preview details" onClick={() => setSelectedID(undefined)}><HugeiconsIcon icon={Cancel01Icon} /></Button></div></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-2">{selectedEndpoint ? <a className="break-all font-mono text-sm text-primary underline underline-offset-4" href={selectedEndpoint} target="_blank" rel="noreferrer noopener">{selectedEndpoint}</a> : <span className="text-sm text-muted-foreground">Endpoint unavailable</span>}<Button variant="outline" size="sm" onClick={() => void copyPreviewURL(selectedPreview)} disabled={!selectedEndpoint}><HugeiconsIcon icon={Copy01Icon} />Copy URL</Button></div><PreviewFields preview={selectedPreview} machines={machines} liveError={liveError} liveRetry={liveRetry} /></CardContent></Card><PreviewDomainPanel preview={selectedPreview} client={client} onRefresh={() => refresh(true)} /></div> : null}

      <CreatePreviewDialog open={createOpen} form={form} devices={onlineDevices} creating={creating} operation={createOperation} error={createError} onOpenChange={(open) => { if (!creating) setCreateOpen(open); }} onChange={setForm} onSubmit={createPreview} />
    </div>
  );
}

function CreatePreviewDialog({ open, form, devices, creating, operation, error, onOpenChange, onChange, onSubmit }: { open: boolean; form: CreateFormState; devices: Machine[]; creating: boolean; operation?: Operation; error?: string; onOpenChange: (open: boolean) => void; onChange: React.Dispatch<React.SetStateAction<CreateFormState>>; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }): React.ReactElement {
  const selectedDevice = devices.find((device) => device.id === form.deviceID);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader><DialogTitle>Create preview</DialogTitle><DialogDescription>Choose an online device that can reach the local service. The browser itself cannot expose its localhost.</DialogDescription></DialogHeader>
          <DialogPanel>
            {devices.length === 0 ? <NoDeviceGuidance deviceCount={0} /> : <div className="space-y-5">
              <div className="space-y-2"><label htmlFor="preview-device" className="text-sm font-medium">Online device</label><NativeSelect id="preview-device" value={form.deviceID} onChange={(event) => onChange((current) => ({ ...current, deviceID: event.target.value }))} aria-describedby="preview-device-help" disabled={creating} className="w-full"><NativeSelectOption value="">Choose a device</NativeSelectOption>{devices.map((device) => <NativeSelectOption key={device.id} value={device.id}>{device.display_name} · {device.platform}/{device.architecture}</NativeSelectOption>)}</NativeSelect><p id="preview-device-help" className="text-xs text-muted-foreground">The selected device owns the temporary preview lease.</p></div>
              <div className="space-y-2"><label htmlFor="preview-target" className="text-sm font-medium">Port or origin URL</label><Input id="preview-target" value={form.target} onChange={(event) => onChange((current) => ({ ...current, target: event.target.value }))} placeholder="3000 or http://127.0.0.1:3000" autoComplete="off" spellCheck={false} disabled={creating} aria-describedby="preview-target-help" /><p id="preview-target-help" className="text-xs text-muted-foreground">Use a local port, loopback HTTP(S)/h2c address, or an absolute Unix socket path.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="preview-access" className="text-sm font-medium">Access</label><NativeSelect id="preview-access" value={form.accessMode} onChange={(event) => onChange((current) => ({ ...current, accessMode: event.target.value as AccessMode }))} disabled={creating} className="w-full"><NativeSelectOption value="public">Public</NativeSelectOption><NativeSelectOption value="private">Private</NativeSelectOption></NativeSelect></div><div className="space-y-2"><label htmlFor="preview-duration" className="text-sm font-medium">Maximum duration</label><NativeSelect id="preview-duration" value={form.duration} onChange={(event) => onChange((current) => ({ ...current, duration: event.target.value as DurationValue }))} disabled={creating} className="w-full">{DURATION_OPTIONS.map((option) => <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>)}</NativeSelect></div></div>
              {form.accessMode === "public" ? <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Public previews are reachable by anyone with the URL. Use Private when the edge must authorize same-account devices before forwarding.</p> : <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Private previews require the Paperboat runtime on the browsing machine to be installed and running with its narrow local proxy/PAC rule enabled. The browser sends no Paperboat credentials.</p>}
              {selectedDevice && !isOnlineDevice(selectedDevice) ? <p role="alert" className="text-sm text-destructive">This device went offline. Choose another device and retry.</p> : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              {operation ? <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border bg-muted/48 p-3 text-sm"><Spinner />{operationPhaseLabel(operation.phase)}{operation.progress > 0 ? ` · ${operation.progress}%` : ""}</div> : null}
            </div>}
          </DialogPanel>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button><Button type="submit" disabled={creating || !selectedDevice || !isOnlineDevice(selectedDevice)}>{creating ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}{creating ? "Creating…" : "Create preview"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function operationPhaseLabel(phase: Operation["phase"]): string {
  switch (phase) {
    case "validating": return "Checking request";
    case "persisting": return "Requesting device";
    case "connecting": return "Connecting edge";
    case "checking_origin": return "Checking origin";
    case "ready": return "Ready";
    case "failed": return "Creation failed";
    case "draining": return "Stopping previous state";
    case "rolling_back": return "Rolling back";
    case "waiting_for_dns": return "Waiting for DNS";
    case "issuing_certificate": return "Issuing certificate";
    case "installing_service": return "Installing service";
    default: return "Working";
  }
}

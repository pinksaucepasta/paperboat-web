"use client";

import * as React from "react";
import {
  Add01Icon,
  Cancel01Icon,
  CloudServerIcon,
  Copy01Icon,
  Delete02Icon,
  LinkSquare02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  approveMachine,
  cancelMachineEnrollment,
  deleteMachine,
  denyMachine,
  disconnectMachine,
  getMachineEnrollment,
  getMachineOverview,
  listMachines,
  retryMachineEnrollment,
  setMachineAvailability,
  startMachineEnrollment,
} from "@/lib/api/machines";
import type {
  Machine,
  MachineEnrollment,
  MachineEnrollmentStart,
  MachineEnrollmentState,
  MachineOverview,
  AvailabilityMode,
} from "@/lib/api/types";
import { Switch } from "@/components/ui/switch";

const ACTIVE_ENROLLMENT_KEY = "paperboat.active-machine-enrollment";
const POLLED_STATES = new Set<MachineEnrollmentState>([
  "awaiting_bootstrap",
  "awaiting_approval",
  "approved",
  "material_issued",
  "installing",
  "connecting",
]);

export default function MachinesPage() {
  const [items, setItems] = React.useState<Machine[]>([]);
  const [overview, setOverview] = React.useState<MachineOverview>();
  const [enrollment, setEnrollment] = React.useState<MachineEnrollment | MachineEnrollmentStart>();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string>();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<string>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [machines, usage] = await Promise.all([listMachines(), getMachineOverview()]);
      setItems(machines);
      setOverview(usage);
    } catch (error) {
      setLoadError(errorMessage(error, "Unable to load machines."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const enrollmentID = sessionStorage.getItem(ACTIVE_ENROLLMENT_KEY);
    if (enrollmentID) {
      void getMachineEnrollment(enrollmentID)
        .then(setEnrollment)
        .catch(() => sessionStorage.removeItem(ACTIVE_ENROLLMENT_KEY));
    }
    return () => window.clearTimeout(initialRefresh);
  }, [refresh]);

  React.useEffect(() => {
    if (!enrollment || !POLLED_STATES.has(enrollment.state)) return;
    const timer = window.setInterval(() => {
      void getMachineEnrollment(enrollment.id)
        .then((next) => {
          setEnrollment((current) => ({ ...current, ...next }));
          if (next.state === "ready") void refresh();
        })
        .catch((error) => toast.error("Enrollment status is unavailable.", { description: errorMessage(error, "Retry shortly.") }));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [enrollment, refresh]);

  async function startEnrollment() {
    setBusy("start");
    try {
      const result = await startMachineEnrollment(`dashboard-${crypto.randomUUID()}`);
      setEnrollment(result);
      sessionStorage.setItem(ACTIVE_ENROLLMENT_KEY, result.id);
      toast.success("Enrollment started.");
    } catch (error) {
      toast.error("Couldn't start enrollment.", { description: errorMessage(error, "Try again.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function approve() {
    setBusy("approve");
    try {
      await approveMachine(code.trim());
      setCode("");
      toast.success("User machine approved.");
      if (enrollment) setEnrollment(await getMachineEnrollment(enrollment.id));
      await refresh();
    } catch (error) {
      toast.error("Couldn't approve machine.", { description: errorMessage(error, "Check the pairing code and available seats.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function deny() {
    setBusy("deny");
    try {
      await denyMachine(code.trim());
      setCode("");
      toast.success("Pairing denied.");
      if (enrollment) setEnrollment(await getMachineEnrollment(enrollment.id));
    } catch (error) {
      toast.error("Couldn't deny pairing.", { description: errorMessage(error, "Check the pairing code and try again.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function updateEnrollment(action: "retry" | "cancel") {
    if (!enrollment) return;
    setBusy(action);
    try {
      if (action === "retry") {
        setEnrollment(await retryMachineEnrollment(enrollment.id));
        toast.success("Enrollment restarted with new installation material.");
      } else {
        await cancelMachineEnrollment(enrollment.id);
        setEnrollment(await getMachineEnrollment(enrollment.id));
        toast.success("Enrollment cancelled.");
      }
    } catch (error) {
      toast.error(`Couldn't ${action} enrollment.`, { description: errorMessage(error, "Refresh the enrollment state and try again.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function act(id: string, kind: "disconnect" | "delete") {
    setBusy(id + kind);
    try {
      if (kind === "disconnect") await disconnectMachine(id);
      else await deleteMachine(id);
      toast.success(kind === "disconnect" ? "User machine disconnected." : "User machine deleted.");
      await refresh();
    } catch (error) {
      toast.error(`Couldn't ${kind} machine.`, { description: errorMessage(error, "Try again.") });
    } finally {
      setBusy(undefined);
    }
  }

  async function updateAvailability(machine: Machine, mode: AvailabilityMode) {
    setBusy(machine.id + "availability");
    try {
      const availability = await setMachineAvailability(machine.id, mode, machine.availability.desired_version);
      setItems((current) => current.map((item) => item.id === machine.id ? { ...item, availability } : item));
      toast.success(mode === "keep_awake" ? "Keep awake saved." : "Normal sleep restored.", {
        description: availability.status === "applied" ? "The machine confirmed the change." : "Paperboat will apply it when the machine reconnects.",
      });
    } catch (error) {
      toast.error("Couldn't update availability.", { description: errorMessage(error, "Refresh the machine state and try again.") });
    } finally {
      setBusy(undefined);
    }
  }

  const includedPercent = overview?.included_bytes
    ? Math.min(100, Math.round((overview.consumed_included_bytes / overview.included_bytes) * 100))
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Machines"
        description="Manage macOS and Linux machines that keep their workspace on your hardware."
        actions={
          <Button disabled={busy === "start" || overview?.available_seats === 0} onClick={() => void startEnrollment()}>
            {busy === "start" ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}
            Add machine
          </Button>
        }
      />

      {enrollment ? (
        <EnrollmentPanel
          enrollment={enrollment}
          busy={busy}
          onCancel={() => void updateEnrollment("cancel")}
          onRetry={() => void updateEnrollment("retry")}
        />
      ) : null}

      {loading ? <OverviewSkeleton /> : overview ? (
        <section aria-label="User-machine usage" className="grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x">
          <Metric label="Seats" value={`${overview.occupied_seats} / ${overview.seat_quantity}`} detail={`${overview.available_seats} available`} />
          <Metric label="Included bandwidth" value={`${includedPercent}%`} detail={`${formatBytes(overview.consumed_included_bytes)} used`} />
          <Metric label="Paid bandwidth remaining" value={formatBytes(overview.paid_topup_remaining_bytes)} detail={overview.entitlement_state} />
        </section>
      ) : null}

      {loadError ? (
        <section role="alert" className="flex flex-col gap-3 border-y py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-medium">Machines unavailable</h2><p className="text-sm text-muted-foreground">{loadError}</p></div>
          <Button variant="outline" onClick={() => void refresh()}><HugeiconsIcon icon={RefreshIcon} />Retry</Button>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Enrolled machines" className="grid content-start gap-4 md:grid-cols-2">
          {!loading && !loadError && items.length === 0 ? (
            <div className="col-span-full flex min-h-56 flex-col items-center justify-center gap-3 border-y text-center">
              <HugeiconsIcon icon={CloudServerIcon} className="size-7 text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold">No machines</h2>
              <Button variant="outline" onClick={() => void startEnrollment()}><HugeiconsIcon icon={Add01Icon} />Add machine</Button>
            </div>
          ) : items.map((machine) => (
            <Card key={machine.id} className="rounded-lg">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle className="font-heading text-base">{machine.display_name}</CardTitle><CardDescription className="font-mono text-xs">{machine.platform} / {machine.architecture}</CardDescription></div>
                  <Badge variant={machine.online ? "success" : "outline"}>{machine.online ? "Online" : machine.state}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="truncate text-muted-foreground" title={machine.workspace_root}>{machine.workspace_root}</p>
                <p className="text-xs text-muted-foreground">Seat {machine.seat_state}</p>
                <AvailabilityControl machine={machine} busy={busy === machine.id + "availability"} onChange={(mode) => void updateAvailability(machine, mode)} onRetry={() => void refresh()} />
              </CardContent>
              <CardFooter className="gap-2">
                <AlertDialog>
                  <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={busy === machine.id + "disconnect"} />}>
                    <HugeiconsIcon icon={LinkSquare02Icon} />Disconnect
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {machine.display_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Paperboat will revoke this machine&apos;s host runtime, route, and terminal access. Its interactive identity remains available, but active hosted sessions will stop.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => void act(machine.id, "disconnect")}>Disconnect machine</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${machine.display_name}`} disabled={busy === machine.id + "delete"} />}>
                    <HugeiconsIcon icon={Delete02Icon} />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {machine.display_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the machine record, revokes its access, closes active sessions, and releases its seat. Enroll it again to reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => void act(machine.id, "delete")}>Delete machine</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </section>

        <aside>
          <Card className="rounded-lg">
            <CardHeader><CardTitle className="font-heading text-base">Approve pairing</CardTitle><CardDescription>Confirm the code shown on the machine.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Input aria-label="Pairing code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABCD1234" className="font-mono" maxLength={32} />
              {enrollment?.user_code ? <button className="text-left font-mono text-sm text-primary underline-offset-4 hover:underline" onClick={() => setCode(enrollment.user_code ?? "")}>Use {enrollment.user_code}</button> : null}
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="outline" disabled={!code.trim() || busy === "deny"} />}><HugeiconsIcon icon={Cancel01Icon} />Deny</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Deny this pairing?</AlertDialogTitle><AlertDialogDescription>No machine or seat will be created. This pairing code cannot be used again.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void deny()}>Deny pairing</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button disabled={!code.trim() || busy === "approve"} onClick={() => void approve()}>{busy === "approve" ? <Spinner /> : <HugeiconsIcon icon={LinkSquare02Icon} />}Approve</Button>
            </CardFooter>
          </Card>
          <Button className="mt-3 w-full" variant="ghost" onClick={() => void refresh()}><HugeiconsIcon icon={RefreshIcon} />Refresh</Button>
        </aside>
      </div>
    </>
  );
}

function AvailabilityControl({ machine, busy, onChange, onRetry }: { machine: Machine; busy: boolean; onChange: (mode: AvailabilityMode) => void; onRetry: () => void }) {
  const policy = machine.availability;
  const keepAwake = policy.desired_mode === "keep_awake";
  const drifted = policy.observed_version !== policy.desired_version || policy.observed_mode !== policy.desired_mode;
  const variant = policy.status === "applied" && !drifted ? "success" : policy.status === "error" || policy.status === "unsupported" ? "error" : "warning";
  const status = policy.status === "applied" && drifted ? "Pending" : stateLabel(policy.status);
  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium">Keep awake</p><Badge variant={variant}>{status}</Badge></div>
          <p className="text-xs text-muted-foreground">{keepAwake ? "Blocks idle and lid-close sleep." : "Uses the machine's normal sleep settings."}</p>
        </div>
        {keepAwake ? (
          <Switch aria-label={`Allow ${machine.display_name} to sleep`} checked disabled={busy} onCheckedChange={(checked) => { if (!checked) onChange("allow_sleep"); }} />
        ) : (
          <AlertDialog>
            <AlertDialogTrigger render={<Switch aria-label={`Keep ${machine.display_name} awake`} checked={false} disabled={busy} />} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Keep {machine.display_name} awake?</AlertDialogTitle>
                <AlertDialogDescription>
                  Paperboat will prevent idle and lid-close sleep on battery and AC power. This can increase battery use and heat. macOS machines still require the first FileVault unlock after reboot.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onChange("keep_awake")}>Keep awake</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {policy.status === "offline" ? <p className="text-xs text-amber-700 dark:text-amber-400">Saved. The machine will apply this automatically after it reconnects.</p> : null}
      {policy.status === "unsupported" ? <p className="text-xs text-destructive">This host service cannot manage sleep. Update Paperboat on the machine, then retry.</p> : null}
      {policy.status === "error" ? <div className="flex items-center justify-between gap-3"><p className="text-xs text-destructive">The host service could not apply this setting. Run <code className="font-mono">pb doctor</code> locally; uninstall restores the original power settings.</p><Button size="sm" variant="outline" onClick={onRetry}><HugeiconsIcon icon={RefreshIcon} />Retry</Button></div> : null}
    </div>
  );
}

function EnrollmentPanel({ enrollment, busy, onCancel, onRetry }: { enrollment: MachineEnrollment | MachineEnrollmentStart; busy?: string; onCancel: () => void; onRetry: () => void }) {
  const command = "bootstrap_command" in enrollment ? enrollment.bootstrap_command : "";
  const retryable = ["cancelled", "expired", "denied", "failed_retryable"].includes(enrollment.state);
  const cancellable = ["awaiting_bootstrap", "awaiting_approval", "failed_retryable"].includes(enrollment.state);
  const variant = enrollmentVariant(enrollment.state);
  return (
    <section aria-labelledby="enrollment-title" className="space-y-4 border-y py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h2 id="enrollment-title" className="font-heading text-base font-semibold">User-machine enrollment</h2><Badge variant={variant}>{stateLabel(enrollment.state)}</Badge></div>
          <p className="text-sm text-muted-foreground">Generation {enrollment.generation} · expires {formatTimestamp(enrollment.expires_at)}</p>
        </div>
        <div className="flex gap-2">
          {retryable ? <Button size="sm" variant="outline" disabled={busy === "retry"} onClick={onRetry}><HugeiconsIcon icon={RefreshIcon} />Retry</Button> : null}
          {cancellable ? <Button size="sm" variant="ghost" disabled={busy === "cancel"} onClick={onCancel}><HugeiconsIcon icon={Cancel01Icon} />Cancel</Button> : null}
        </div>
      </div>
      {command ? (
        <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs">{command}</code>
          <Button size="icon-sm" variant="ghost" aria-label="Copy bootstrap command" onClick={() => void navigator.clipboard.writeText(command).then(() => toast.success("Bootstrap command copied."))}><HugeiconsIcon icon={Copy01Icon} /></Button>
        </div>
      ) : null}
      {enrollment.requested_display_name ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <EnrollmentDetail label="User machine" value={enrollment.requested_display_name} />
          <EnrollmentDetail label="Platform" value={[enrollment.platform, enrollment.architecture].filter(Boolean).join(" / ")} />
          <EnrollmentDetail label="Workspace scope" value={enrollment.workspace_root ?? "Pending"} mono />
        </dl>
      ) : null}
    </section>
  );
}

function EnrollmentDetail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={mono ? "truncate font-mono text-xs" : "truncate font-medium"} title={value}>{value}</dd></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function OverviewSkeleton() {
  return <section aria-label="Loading machine usage" className="grid rounded-lg border sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="space-y-3 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-20" /></div>)}</section>;
}

function enrollmentVariant(state: MachineEnrollmentState): "success" | "warning" | "error" | "outline" | "info" {
  if (state === "ready") return "success";
  if (["cancelled", "expired", "denied", "failed_retryable", "revoked", "deleted"].includes(state)) return "error";
  if (["awaiting_bootstrap", "awaiting_approval"].includes(state)) return "warning";
  if (["approved", "material_issued", "installing", "connecting"].includes(state)) return "info";
  return "outline";
}

function stateLabel(state: string) {
  return state.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toLocaleString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

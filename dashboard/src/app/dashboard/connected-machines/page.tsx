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
  approveConnectedMachine,
  cancelConnectedMachineEnrollment,
  deleteConnectedMachine,
  denyConnectedMachine,
  disconnectConnectedMachine,
  getConnectedMachineEnrollment,
  getConnectedMachineOverview,
  listConnectedMachines,
  retryConnectedMachineEnrollment,
  startConnectedMachineEnrollment,
} from "@/lib/api/connected-machines";
import type {
  ConnectedMachine,
  ConnectedMachineEnrollment,
  ConnectedMachineEnrollmentStart,
  ConnectedMachineEnrollmentState,
  ConnectedMachineOverview,
} from "@/lib/api/types";

const ACTIVE_ENROLLMENT_KEY = "paperboat.active-connected-machine-enrollment";
const POLLED_STATES = new Set<ConnectedMachineEnrollmentState>([
  "awaiting_bootstrap",
  "awaiting_approval",
  "approved",
  "material_issued",
  "installing",
  "connecting",
]);

export default function ConnectedMachinesPage() {
  const [items, setItems] = React.useState<ConnectedMachine[]>([]);
  const [overview, setOverview] = React.useState<ConnectedMachineOverview>();
  const [enrollment, setEnrollment] = React.useState<ConnectedMachineEnrollment | ConnectedMachineEnrollmentStart>();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string>();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<string>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [machines, usage] = await Promise.all([listConnectedMachines(), getConnectedMachineOverview()]);
      setItems(machines);
      setOverview(usage);
    } catch (error) {
      setLoadError(errorMessage(error, "Unable to load connected machines."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const enrollmentID = sessionStorage.getItem(ACTIVE_ENROLLMENT_KEY);
    if (enrollmentID) {
      void getConnectedMachineEnrollment(enrollmentID)
        .then(setEnrollment)
        .catch(() => sessionStorage.removeItem(ACTIVE_ENROLLMENT_KEY));
    }
    return () => window.clearTimeout(initialRefresh);
  }, [refresh]);

  React.useEffect(() => {
    if (!enrollment || !POLLED_STATES.has(enrollment.state)) return;
    const timer = window.setInterval(() => {
      void getConnectedMachineEnrollment(enrollment.id)
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
      const result = await startConnectedMachineEnrollment(`dashboard-${crypto.randomUUID()}`);
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
      await approveConnectedMachine(code.trim());
      setCode("");
      toast.success("Machine approved.");
      if (enrollment) setEnrollment(await getConnectedMachineEnrollment(enrollment.id));
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
      await denyConnectedMachine(code.trim());
      setCode("");
      toast.success("Pairing denied.");
      if (enrollment) setEnrollment(await getConnectedMachineEnrollment(enrollment.id));
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
        setEnrollment(await retryConnectedMachineEnrollment(enrollment.id));
        toast.success("Enrollment restarted with new installation material.");
      } else {
        await cancelConnectedMachineEnrollment(enrollment.id);
        setEnrollment(await getConnectedMachineEnrollment(enrollment.id));
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
      if (kind === "disconnect") await disconnectConnectedMachine(id);
      else await deleteConnectedMachine(id);
      toast.success(kind === "disconnect" ? "Machine disconnected." : "Machine deleted.");
      await refresh();
    } catch (error) {
      toast.error(`Couldn't ${kind} machine.`, { description: errorMessage(error, "Try again.") });
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
        title="Connected machines"
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
        <section aria-label="Connected-machine usage" className="grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x">
          <Metric label="Seats" value={`${overview.occupied_seats} / ${overview.seat_quantity}`} detail={`${overview.available_seats} available`} />
          <Metric label="Included bandwidth" value={`${includedPercent}%`} detail={`${formatBytes(overview.consumed_included_bytes)} used`} />
          <Metric label="Paid bandwidth remaining" value={formatBytes(overview.paid_topup_remaining_bytes)} detail={overview.entitlement_state} />
        </section>
      ) : null}

      {loadError ? (
        <section role="alert" className="flex flex-col gap-3 border-y py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-medium">Connected machines unavailable</h2><p className="text-sm text-muted-foreground">{loadError}</p></div>
          <Button variant="outline" onClick={() => void refresh()}><HugeiconsIcon icon={RefreshIcon} />Retry</Button>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Enrolled machines" className="grid content-start gap-4 md:grid-cols-2">
          {!loading && !loadError && items.length === 0 ? (
            <div className="col-span-full flex min-h-56 flex-col items-center justify-center gap-3 border-y text-center">
              <HugeiconsIcon icon={CloudServerIcon} className="size-7 text-muted-foreground" />
              <h2 className="font-heading text-lg font-semibold">No connected machines</h2>
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
                        Paperboat will revoke this machine&apos;s helper, route, and terminal access. Its identity remains available for repair, but active sessions will stop.
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
                        This permanently removes the machine record, revokes its access, closes active sessions, and releases its connected-machine seat. Enroll it again to reconnect.
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
                  <AlertDialogHeader><AlertDialogTitle>Deny this pairing?</AlertDialogTitle><AlertDialogDescription>No machine or connected-machine seat will be created. This pairing code cannot be used again.</AlertDialogDescription></AlertDialogHeader>
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

function EnrollmentPanel({ enrollment, busy, onCancel, onRetry }: { enrollment: ConnectedMachineEnrollment | ConnectedMachineEnrollmentStart; busy?: string; onCancel: () => void; onRetry: () => void }) {
  const command = "bootstrap_command" in enrollment ? enrollment.bootstrap_command : "";
  const retryable = ["cancelled", "expired", "denied", "failed_retryable"].includes(enrollment.state);
  const cancellable = ["awaiting_bootstrap", "awaiting_approval", "failed_retryable"].includes(enrollment.state);
  const variant = enrollmentVariant(enrollment.state);
  return (
    <section aria-labelledby="enrollment-title" className="space-y-4 border-y py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2"><h2 id="enrollment-title" className="font-heading text-base font-semibold">Machine enrollment</h2><Badge variant={variant}>{stateLabel(enrollment.state)}</Badge></div>
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
          <EnrollmentDetail label="Machine" value={enrollment.requested_display_name} />
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
  return <section aria-label="Loading connected-machine usage" className="grid rounded-lg border sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="space-y-3 p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-20" /></div>)}</section>;
}

function enrollmentVariant(state: ConnectedMachineEnrollmentState): "success" | "warning" | "error" | "outline" | "info" {
  if (state === "ready") return "success";
  if (["cancelled", "expired", "denied", "failed_retryable", "revoked", "deleted"].includes(state)) return "error";
  if (["awaiting_bootstrap", "awaiting_approval"].includes(state)) return "warning";
  if (["approved", "material_issued", "installing", "connecting"].includes(state)) return "info";
  return "outline";
}

function stateLabel(state: ConnectedMachineEnrollmentState) {
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

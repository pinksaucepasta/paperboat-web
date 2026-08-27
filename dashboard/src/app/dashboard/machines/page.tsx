"use client";

import * as React from "react";
import {
  Add01Icon,
  Cancel01Icon,
  CloudServerIcon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import {
  cancelMachineEnrollment,
  deleteMachine,
  disconnectMachine,
  decideMaintenanceApproval,
  getFleetUpdateSummary,
  getMachineEnrollment,
  getMachineOverview,
  listMachines,
  listMaintenanceApprovals,
  retryMachineEnrollment,
  renameMachine,
  setMachineAvailability,
  startMachineEnrollment,
} from "@/lib/api/machines";
import type {
  Machine,
  MachineEnrollment,
  MachineEnrollmentStart,
  MachineEnrollmentState,
  MachineOverview,
  FleetUpdateSummary,
  MaintenanceApproval,
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
	const [updates, setUpdates] = React.useState<FleetUpdateSummary>();
	const [maintenance, setMaintenance] = React.useState<Record<string, MaintenanceApproval[]>>({});
	const [updateError, setUpdateError] = React.useState<string>();
  const [enrollment, setEnrollment] = React.useState<MachineEnrollment | MachineEnrollmentStart>();
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string>();
  const [busy, setBusy] = React.useState<string>();
  const [machineToRename, setMachineToRename] = React.useState<Machine>();
  const [machineName, setMachineName] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      const [machines, usage] = await Promise.all([listMachines(), getMachineOverview()]);
      setItems(machines);
      setOverview(usage);
		try {
			const updateSummary = await getFleetUpdateSummary();
			setUpdates(updateSummary);
			setUpdateError(undefined);
			const awaitingApproval = updateSummary.items.filter((item) => item.state === "deferred").map((item) => item.machine_id);
			const pendingApprovals = await Promise.all(awaitingApproval.map(async (machineID) => [machineID, await listMaintenanceApprovals(machineID)] as const));
			setMaintenance(Object.fromEntries(pendingApprovals));
		} catch (error) {
			setUpdates(undefined);
			setMaintenance({});
			setUpdateError(errorMessage(error, "Update status is unavailable."));
		}
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
          setEnrollment((current) => current?.id === enrollment.id ? { ...current, ...next } : current);
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

  async function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!machineToRename) return;
    const displayName = machineName.trim();
    if (!displayName || displayName === machineToRename.display_name) return;

    setBusy(machineToRename.id + "rename");
    try {
      const updated = await renameMachine(machineToRename.id, displayName);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMachineToRename(undefined);
      toast.success("Machine renamed.");
    } catch (error) {
      toast.error("Couldn't rename machine.", { description: errorMessage(error, "Check the name and try again.") });
    } finally {
      setBusy(undefined);
    }
  }

	async function decideMaintenance(machineID: string, approval: MaintenanceApproval, decision: "approved" | "rejected") {
		setBusy(`${machineID}:${approval.id}:${decision}`);
		try {
			const updated = await decideMaintenanceApproval(machineID, approval.id, decision);
			setMaintenance((current) => ({ ...current, [machineID]: (current[machineID] ?? []).map((item) => item.id === updated.id ? updated : item) }));
			toast.success(decision === "approved" ? "Maintenance approved." : "Maintenance declined.");
		} catch (error) {
			toast.error(`Couldn't ${decision === "approved" ? "approve" : "decline"} maintenance.`, { description: errorMessage(error, "Refresh the machine state and try again.") });
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
        description="Manage native Windows, macOS, and Linux machines that keep their workspace on your hardware."
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

		{!loading && !loadError && updates ? <UpdateFleetSummary summary={updates} /> : null}
		{updateError ? <section role="status" className="flex items-center justify-between gap-3 border-y py-3 text-sm"><p className="text-muted-foreground">{updateError}</p><Button size="sm" variant="outline" onClick={() => void refresh()}><HugeiconsIcon icon={RefreshIcon} />Retry</Button></section> : null}

      <div>
        <section aria-label="Enrolled machines" className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  <div><CardTitle className="font-heading text-base">{machine.display_name}</CardTitle><CardDescription className="flex items-center gap-2 font-mono text-xs">{machine.platform} / {machine.architecture}</CardDescription></div>
                  <Badge variant={machine.online ? "success" : "outline"}>{machine.online ? "Online" : machine.state}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="truncate text-muted-foreground" title={machine.workspace_root}>{machine.workspace_root}</p>
                <div className="flex flex-wrap gap-1.5" aria-label={`${machine.display_name} capabilities`}>
                  <Badge variant="outline">{machine.setup_mode}</Badge>
                  {machine.capabilities.file_receive.configured ? <Badge variant={machine.capabilities.file_receive.observed ? "success" : "outline"}>Files</Badge> : null}
                  {machine.capabilities.preview_launch.configured ? <Badge variant={machine.capabilities.preview_launch.observed ? "success" : "outline"}>Previews</Badge> : null}
                  {machine.capabilities.terminal_host.configured ? <Badge variant={machine.capabilities.terminal_host.observed ? "success" : "outline"}>Terminal</Badge> : null}
                  {machine.capabilities.codex_host.configured ? <Badge variant={machine.capabilities.codex_host.observed ? "success" : "outline"}>Codex</Badge> : null}
                </div>
                {machine.setup_mode === "host" ? <p className="text-xs text-muted-foreground">Seat {machine.seat_state}</p> : null}
                {machine.setup_mode === "host" ? <AvailabilityControl machine={machine} busy={busy === machine.id + "availability"} onChange={(mode) => void updateAvailability(machine, mode)} onRetry={() => void refresh()} /> : null}
						<MachineUpdateControl machine={machine} update={updates?.items.find((item) => item.machine_id === machine.id)} approvals={maintenance[machine.id] ?? []} busy={busy} onDecision={(approval, decision) => void decideMaintenance(machine.id, approval, decision)} />
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === machine.id + "rename"}
                  onClick={() => {
                    setMachineToRename(machine);
                    setMachineName(machine.display_name);
                  }}
                >
                  <HugeiconsIcon icon={Edit02Icon} />Rename
                </Button>
                {machine.setup_mode === "host" ? <AlertDialog>
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
                </AlertDialog> : null}
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

      </div>

      <Dialog open={Boolean(machineToRename)} onOpenChange={(open) => { if (!open && busy !== machineToRename?.id + "rename") setMachineToRename(undefined); }}>
        <DialogContent>
          <form onSubmit={(event) => void submitRename(event)}>
            <DialogHeader>
              <DialogTitle>Rename machine</DialogTitle>
              <DialogDescription>Use a clear name that helps you identify this machine.</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <label className="grid gap-2 text-sm font-medium" htmlFor="machine-display-name">
                Machine name
                <Input
                  id="machine-display-name"
                  name="display_name"
                  value={machineName}
                  onChange={(event) => setMachineName(event.target.value)}
                  maxLength={128}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </label>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={busy === machineToRename?.id + "rename"} />}>Cancel</DialogClose>
              <Button type="submit" disabled={!machineName.trim() || machineName.trim() === machineToRename?.display_name || busy === machineToRename?.id + "rename"}>
                {busy === machineToRename?.id + "rename" ? <Spinner /> : null}
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UpdateFleetSummary({ summary }: { summary: FleetUpdateSummary }) {
	const reporting = summary.items.length - (summary.counts.not_reporting ?? 0);
	const attention = (summary.counts.failed ?? 0) + (summary.counts.rolled_back ?? 0) + (summary.counts.deferred ?? 0);
	return <section aria-label="Paperboat updates" className="grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x">
		<Metric label="Reporting" value={`${reporting} / ${summary.items.length}`} detail="machines have update status" />
		<Metric label="Needs attention" value={String(attention)} detail={attention ? "Review affected machines" : "No action required"} />
		<Metric label="Active updates" value={String((summary.counts.checking ?? 0) + (summary.counts.downloading ?? 0) + (summary.counts.staged ?? 0) + (summary.counts.activating ?? 0))} detail="checking, staging, or activating" />
	</section>;
}

function MachineUpdateControl({ machine, update, approvals, busy, onDecision }: { machine: Machine; update?: FleetUpdateSummary["items"][number]; approvals: MaintenanceApproval[]; busy?: string; onDecision: (approval: MaintenanceApproval, decision: "approved" | "rejected") => void }) {
	const pending = approvals.find((approval) => approval.status === "pending");
	const state = update?.state ?? "not_reporting";
	const variant = state === "healthy" || state === "idle" ? "success" : state === "failed" || state === "rolled_back" ? "error" : state === "deferred" ? "warning" : "outline";
	return <div className="mt-4 space-y-2 border-t pt-4">
		<div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><p className="font-medium">Paperboat update</p><Badge variant={variant}>{stateLabel(state)}</Badge></div>{update?.observation?.target_version ? <span className="font-mono text-xs text-muted-foreground">{update.observation.current_version} → {update.observation.target_version}</span> : update?.observation ? <span className="font-mono text-xs text-muted-foreground">{update.observation.current_version}</span> : null}</div>
		{state === "not_reporting" ? <p className="text-xs text-muted-foreground">This machine has not reported update status yet.</p> : null}
		{state === "failed" || state === "rolled_back" ? <p className="text-xs text-destructive">The last update did not complete{update?.observation?.error_code ? ` (${update.observation.error_code})` : ""}. The machine kept its previous verified version.</p> : null}
		{pending ? <div className="flex flex-col gap-2 border-l-2 border-amber-500 pl-3 text-sm"><p>Maintenance is required to install {pending.target_version}. This can interrupt active work.</p><p className="text-xs text-muted-foreground">Requested action: {pending.action}. Approval expires {formatTimestamp(pending.expires_at)}.</p><div className="flex gap-2"><AlertDialog><AlertDialogTrigger render={<Button size="sm" disabled={busy === `${machine.id}:${pending.id}:approved`} />}>Approve maintenance</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Approve maintenance for {machine.display_name}?</AlertDialogTitle><AlertDialogDescription>Paperboat will allow the signed {pending.target_version} maintenance update during the next 15-minute window. Active work may be interrupted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDecision(pending, "approved")}>Approve maintenance</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><Button size="sm" variant="outline" disabled={busy === `${machine.id}:${pending.id}:rejected`} onClick={() => onDecision(pending, "rejected")}>Decline</Button></div></div> : state === "deferred" ? <p className="text-xs text-muted-foreground">This update is waiting for a maintenance approval from the machine.</p> : null}
	</div>;
}

function AvailabilityControl({ machine, busy, onChange, onRetry }: { machine: Machine; busy: boolean; onChange: (mode: AvailabilityMode) => void; onRetry: () => void }) {
  const policy = machine.availability;
  const keepAwake = policy.desired_mode === "keep_awake";
  const offline = !machine.online || policy.status === "offline";
  const drifted = policy.observed_version !== policy.desired_version || policy.observed_mode !== policy.desired_mode;
  const variant = offline ? "warning" : policy.status === "applied" && !drifted ? "success" : policy.status === "error" || policy.status === "unsupported" ? "error" : "warning";
  const status = offline ? "Offline" : policy.status === "applied" && drifted ? "Pending" : stateLabel(policy.status);
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
            <AlertDialogTrigger nativeButton={false} render={<Switch aria-label={`Keep ${machine.display_name} awake`} checked={false} disabled={busy} />} />
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
      {offline ? <p className="text-xs text-amber-700 dark:text-amber-400">Saved. The machine will apply this automatically after it reconnects.</p> : null}
      {policy.status === "unsupported" ? <p className="text-xs text-destructive">This host service cannot manage sleep. Update Paperboat on the machine, then retry.</p> : null}
      {policy.status === "error" ? <div className="flex items-center justify-between gap-3"><p className="text-xs text-destructive">The host service could not apply this setting. Run <code className="font-mono">pb doctor</code> locally; uninstall restores the original power settings.</p><Button size="sm" variant="outline" onClick={onRetry}><HugeiconsIcon icon={RefreshIcon} />Retry</Button></div> : null}
    </div>
  );
}

function EnrollmentPanel({ enrollment, busy, onCancel, onRetry }: { enrollment: MachineEnrollment | MachineEnrollmentStart; busy?: string; onCancel: () => void; onRetry: () => void }) {
  const bootstrapToken = "bootstrap_token" in enrollment ? enrollment.bootstrap_token : undefined;
  const serverURL = "server_url" in enrollment ? enrollment.server_url : undefined;
  const retryable = ["cancelled", "expired", "denied", "failed_retryable"].includes(enrollment.state);
  const cancellable = ["awaiting_bootstrap", "awaiting_approval", "failed_retryable"].includes(enrollment.state);
  const variant = enrollmentVariant(enrollment.state);
  const [role, setRole] = React.useState<"host" | "client">("host");
  const [platform, setPlatform] = React.useState<"unix" | "windows">("unix");
  const [hostname, setHostname] = React.useState("");
  const command = enrollmentCommand(bootstrapToken, serverURL, platform, role, hostname);
  const hostnameInvalid = hostname.trim() !== "" && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(hostname.trim());

  async function copyCommand() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      toast.success("One-shot enrollment command copied.");
    } catch {
      toast.error("Couldn't copy the Windows command.");
    }
  }

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
      {bootstrapToken && serverURL ? (
        <section aria-labelledby="windows-enrollment-title" className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <h3 id="windows-enrollment-title" className="font-heading text-base font-semibold">Install a machine</h3>
            <p className="text-sm text-muted-foreground">Choose the machine role, optionally set a hostname, then paste one command. The installer detects the operating system and architecture and finishes setup automatically.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={platform === "unix" ? "default" : "outline"} onClick={() => setPlatform("unix")}>Linux / macOS</Button>
            <Button size="sm" variant={platform === "windows" ? "default" : "outline"} onClick={() => setPlatform("windows")}>Windows</Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button size="sm" variant={role === "host" ? "default" : "outline"} onClick={() => setRole("host")}>Host machine</Button>
            <Button size="sm" variant={role === "client" ? "default" : "outline"} onClick={() => setRole("client")}>Client machine</Button>
            <Input className="max-w-xs" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="Hostname (optional)" aria-label="Hostname (optional)" />
          </div>
          {hostnameInvalid ? <p className="text-xs text-destructive">Use 1-63 letters, numbers, or hyphens. Do not start or end with a hyphen.</p> : null}
          <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3"><code className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">{command}</code><Button size="icon-sm" variant="ghost" aria-label="Copy one-shot enrollment command" onClick={() => void copyCommand()}><HugeiconsIcon icon={Copy01Icon} /></Button></div>
          <p className="text-xs text-muted-foreground">The command is single-use and expires {formatTimestamp(enrollment.expires_at)}.</p>
        </section>
      ) : null}
      {enrollment.requested_display_name ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <EnrollmentDetail label="User machine" value={enrollment.requested_display_name} />
          <EnrollmentDetail label="Platform" value={[enrollment.platform, enrollment.architecture].join(" / ")} />
          <EnrollmentDetail label="Workspace scope" value={enrollment.workspace_root ?? "Pending"} mono />
        </dl>
      ) : null}
    </section>
  );
}

function enrollmentCommand(token: string | undefined, serverURL: string | undefined, platform: "unix" | "windows", role: "host" | "client", hostname: string) {
  if (!token || !serverURL) return "";
  // The release endpoint's enrollment parameter is a DNS label and is
  // intentionally canonicalized to lowercase before it is sent over HTTP.
  // Keep the generated command aligned with that contract even when a user
  // enters a mixed-case Windows hostname.
  const name = hostname.trim().toLowerCase();
  if (name && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(name)) return "";
  const escaped = (value: string) => value.replace(/'/g, "''");
  const boundToken = bindEnrollmentMetadata(token, role, platform);
  const parameter = name ? `${name}-${boundToken}` : boundToken;
  if (platform === "unix") {
    return `curl -fsSL 'https://get.pprbt.dev/install?p=${escaped(parameter)}' | bash`;
  }
  const url = `https://get.pprbt.dev/install?p=${escaped(parameter)}`;
  return `powershell -c "irm '${url}' | iex"`;
}

function bindEnrollmentMetadata(token: string, role: "host" | "client", platform: "unix" | "windows") {
  if (!/^[0-9A-Z]{26}$/.test(token)) return token;
  return metadataCharacter(token[0], role === "host") + metadataCharacter(token[1], platform === "unix") + token.slice(2);
}

function metadataCharacter(character: string, even: boolean) {
  const value = character >= "0" && character <= "9" ? character.charCodeAt(0) - 48 : character.charCodeAt(0) - 64;
  if ((value % 2 === 0) === even) return character;
  const next = value === 9 || value === 26 ? value - 1 : value + 1;
  return character >= "0" && character <= "9" ? String.fromCharCode(48 + next) : String.fromCharCode(64 + next);
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

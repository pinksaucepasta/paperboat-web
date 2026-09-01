"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CloudServerIcon,
  Delete02Icon,
  InformationCircleIcon,
  RefreshIcon,
  VariableIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiError, displayErrorMessage } from "@/lib/api/client";
import {
  getEnvironmentAuthority,
  getEnvironmentAuthorityDocuments,
  getEnvironmentManifest,
  listEnvironmentVariables,
  proveEnvironmentEnrollment,
  putEnvironmentManifest,
  requestEnvironmentEnrollment,
  type EnvironmentVariableMetadata,
  type EnvironmentAuthorityState,
  type EnvironmentEnrollmentState,
  type EnvironmentVariableSnapshot,
  type EnvironmentVariableTarget,
} from "@/lib/api/environment-variables";
import {
  createEnvironmentEnrollmentRequest,
  decodeEnvironmentEnvelope,
  encodeEnvironmentBase64Url,
  environmentManagerStatus,
  generateEnvironmentManagerKeys,
  getEnvironmentAuthorityCheckpoint,
  getEnvironmentEnrollmentJournal,
  getStoredEnvironmentManagerKeys,
  openEnvironmentEnrollmentChallenge,
  parseEnvironmentAuthority,
  parseEnvironmentManifest,
  persistEnvironmentAuthorityCheckpoint,
  persistEnvironmentEnrollmentJournal,
  createEnvironmentManifest,
  environmentScopeRefKey,
  verifyEnvironmentAuthorityChain,
  type EnvironmentAuthority,
  type EnvironmentEnrollmentJournal,
  type EnvironmentManagerStatus,
} from "@/lib/environment-e2ee";
import { listMachines } from "@/lib/api/machines";
import { formatTimestamp } from "@/components/dashboard/config-sync-state";
import type { Machine } from "@/lib/api/types";
import {
  environmentVariableStatus,
  environmentVariableStatusMessage,
  validateEnvironmentVariableValue,
  validateEnvironmentVariableName,
  MAX_VARIABLE_VALUE_BYTES,
} from "@/lib/environment-variable-ui";

type MutationResult = { ok: true } | { ok: false; message: string };

const POLL_INTERVAL_MS = 5_000;

function newOperationID(): string {
  return `envop_${crypto.randomUUID().replaceAll("-", "")}`;
}

function targetKey(target: EnvironmentVariableTarget): string {
  return environmentScopeRefKey(target.scope, target.machineId);
}

function sameBytes(left: Uint8Array | undefined, right: Uint8Array): boolean {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function enrollmentStateFromJournal(journal: EnvironmentEnrollmentJournal): EnvironmentEnrollmentState | undefined {
  if (!journal.requestId || journal.state !== "pending") return undefined;
  return {
    schema: "paperboat.environment-key-enrollment-state/v1",
    request_id: journal.requestId,
    state: "pending",
    expires_at: journal.requestExpiresAt,
    safety_code: journal.safetyCode,
    enrollment_request: encodeEnvironmentBase64Url(journal.canonical),
    signing_proof: null,
  };
}

function enrollmentStateMatchesJournal(
  state: EnvironmentEnrollmentState,
  journal: EnvironmentEnrollmentJournal,
): boolean {
  const expectedRequest = encodeEnvironmentBase64Url(journal.canonical);
  const expectedProof = journal.requestBody.signing_proof;
  return state.request_id === journal.requestId &&
    state.enrollment_request === expectedRequest &&
    state.safety_code === journal.safetyCode &&
    Number.isFinite(Date.parse(state.expires_at)) &&
    Date.parse(state.expires_at) === Date.parse(journal.requestExpiresAt) &&
    state.signing_proof === expectedProof;
}

function enrollmentJournalMatchesRecord(
  journal: EnvironmentEnrollmentJournal,
  record: { subjectId: string; subjectGeneration: number; keyGeneration: number; recipientKeyId: string; recipientPublicKey: Uint8Array; signingKeyId: string; signingPublicKey: Uint8Array },
): boolean {
  return journal.subjectId === record.subjectId &&
    journal.subjectGeneration === record.subjectGeneration &&
    journal.keyGeneration === record.keyGeneration &&
    journal.requestBody.signing_key_id === record.signingKeyId &&
    journal.requestBody.recipient_key_id === record.recipientKeyId &&
    journal.requestBody.signing_public_key === encodeEnvironmentBase64Url(record.signingPublicKey) &&
    journal.requestBody.recipient_public_key === encodeEnvironmentBase64Url(record.recipientPublicKey);
}

async function configuredEnvironmentRoot(): Promise<Uint8Array> {
  const encoded = process.env.NEXT_PUBLIC_PAPERBOAT_ENV_ROOT_PUBLIC_KEY;
  if (!encoded) throw new Error("The ENV root key is not configured.");
  const root = await decodeEnvironmentEnvelope(encoded, 32);
  if (root.length !== 32) throw new Error("The ENV root key is invalid.");
  return root;
}

/**
 * Reconcile the browser's durable authority high-water before accepting any
 * server-provided authority as trust data. Every document is verified and
 * committed one generation at a time, so a refresh race cannot roll this
 * browser back to a previously valid authority.
 */
async function synchronizeEnvironmentAuthority(root: Uint8Array): Promise<{
  state: EnvironmentAuthorityState;
  authority: EnvironmentAuthority;
}> {
  const state = await getEnvironmentAuthority();
  let checkpoint = await getEnvironmentAuthorityCheckpoint();
  const seen = new Set<string>();
  let hasMore = true;
  while (hasMore) {
    const page = await getEnvironmentAuthorityDocuments(
      checkpoint?.generation ?? 0,
      checkpoint?.authorityId,
    );
    if (page.authority_head.generation < (checkpoint?.generation ?? 0)) {
      throw new Error("The ENV authority head moved backwards.");
    }
    if (page.authority_documents.length === 0) {
      if (page.has_more) throw new Error("The ENV authority page is incomplete.");
      if (checkpoint && (checkpoint.generation !== page.authority_head.generation || checkpoint.authorityId !== page.authority_head.authority_id)) {
        throw new Error("The ENV authority page head is inconsistent.");
      }
      hasMore = false;
      break;
    }
    for (const encoded of page.authority_documents) {
      const raw = await decodeEnvironmentEnvelope(encoded, 2 << 20);
      const authority = await verifyEnvironmentAuthorityChain(
        [raw],
        root,
        checkpoint ?? undefined,
      );
      if (!authority || seen.has(authority.id)) {
        throw new Error("The ENV authority chain is not sequential.");
      }
      seen.add(authority.id);
      checkpoint = await persistEnvironmentAuthorityCheckpoint(authority, root);
      raw.fill(0);
    }
    if (!page.has_more && (
      !checkpoint ||
      checkpoint.generation !== page.authority_head.generation ||
      checkpoint.authorityId !== page.authority_head.authority_id
    )) {
      throw new Error("The ENV authority page head is inconsistent.");
    }
    hasMore = page.has_more;
  }

  const authority = await parseEnvironmentAuthority(
    await decodeEnvironmentEnvelope(state.authority, 2 << 20),
    root,
  );
  if (
    !checkpoint ||
    checkpoint.accountId !== authority.accountId ||
    checkpoint.generation !== authority.generation ||
    checkpoint.authorityId !== authority.id ||
    state.generation !== authority.generation ||
    state.authority_id !== authority.id
  ) {
    throw new Error("The ENV authority high-water is behind the active authority.");
  }
  return { state, authority };
}

function isHostCapableMachine(machine: Machine): boolean {
  return machine.setup_mode === "host" || machine.setup_roles.includes("host");
}

function targetLabel(target: EnvironmentVariableTarget, machineName?: string): string {
  return target.scope === "global"
    ? "account defaults"
    : `${machineName ?? "machine"} overrides`;
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && (
    error.status === 409 ||
    error.status === 412 ||
    error.code.includes("conflict") ||
    error.code.includes("stale")
  );
}

function mutationError(error: unknown, fallback: string): string {
  if (isConflict(error)) {
    return "Another change landed before this one. Refresh the current variables and retry.";
  }
  return displayErrorMessage(error, fallback);
}

export default function EnvironmentVariablesPage() {
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = React.useState<string>();
  const [globalSnapshot, setGlobalSnapshot] = React.useState<EnvironmentVariableSnapshot>();
  const [machineSnapshot, setMachineSnapshot] = React.useState<EnvironmentVariableSnapshot>();
  const [machinesLoading, setMachinesLoading] = React.useState(true);
  const [globalLoading, setGlobalLoading] = React.useState(true);
  const [machineLoading, setMachineLoading] = React.useState(false);
  const [machinesError, setMachinesError] = React.useState<string>();
  const [globalError, setGlobalError] = React.useState<string>();
  const [machineError, setMachineError] = React.useState<string>();
  const [authorityState, setAuthorityState] = React.useState<EnvironmentAuthorityState>();
  const [authority, setAuthority] = React.useState<EnvironmentAuthority>();
  const [managerStatus, setManagerStatus] = React.useState<EnvironmentManagerStatus>({ enrolled: false, reason: "local_key_missing" });
  const [authorityError, setAuthorityError] = React.useState<string>();
  const [enrollmentState, setEnrollmentState] = React.useState<EnvironmentEnrollmentState>();
  const [enrollmentError, setEnrollmentError] = React.useState<string>();
  const [enrollmentBusy, setEnrollmentBusy] = React.useState(false);
  const [busy, setBusy] = React.useState<string>();
  const [conflict, setConflict] = React.useState<string>();
  const machineRequestSequence = React.useRef(0);

  const refreshAuthority = React.useCallback(async () => {
    setAuthorityError(undefined);
    try {
      const root = await configuredEnvironmentRoot();
      const synchronized = await synchronizeEnvironmentAuthority(root);
      setAuthorityState(synchronized.state);
      setAuthority(synchronized.authority);
      setManagerStatus(await environmentManagerStatus(synchronized.authority, root));
    } catch (error) {
      setAuthorityState(undefined);
      setAuthority(undefined);
      setManagerStatus({ enrolled: false, reason: process.env.NEXT_PUBLIC_PAPERBOAT_ENV_ROOT_PUBLIC_KEY ? "authority_unavailable" : "root_unavailable" });
      setAuthorityError(displayErrorMessage(error, "Environment key authorization could not be checked."));
    }
  }, []);

  const refreshGlobal = React.useCallback(async () => {
    setGlobalLoading(true);
    setGlobalError(undefined);
    try {
      setGlobalSnapshot(await listEnvironmentVariables({ scope: "global" }));
    } catch (error) {
      setGlobalError(displayErrorMessage(error, "Account variables could not be loaded."));
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  const refreshMachines = React.useCallback(async () => {
    setMachinesLoading(true);
    setMachinesError(undefined);
    try {
      const nextMachines = (await listMachines()).filter((machine) => (
        machine.state !== "deleted" && isHostCapableMachine(machine)
      ));
      setMachines(nextMachines);
      setSelectedMachineId((current) => {
        if (current && nextMachines.some((machine) => machine.id === current)) return current;
        return nextMachines[0]?.id;
      });
    } catch (error) {
      setMachinesError(displayErrorMessage(error, "Machines could not be loaded."));
    } finally {
      setMachinesLoading(false);
    }
  }, []);

  const refreshMachine = React.useCallback(async (machineId: string | undefined) => {
    const requestSequence = machineRequestSequence.current + 1;
    machineRequestSequence.current = requestSequence;
    if (!machineId) {
      setMachineSnapshot(undefined);
      setMachineError(undefined);
      setMachineLoading(false);
      return;
    }
    setMachineLoading(true);
    setMachineError(undefined);
    try {
      const nextSnapshot = await listEnvironmentVariables({ scope: "machine", machineId });
      if (requestSequence !== machineRequestSequence.current) return;
      setMachineSnapshot(nextSnapshot);
    } catch (error) {
      if (requestSequence !== machineRequestSequence.current) return;
      setMachineError(displayErrorMessage(error, "Machine overrides could not be loaded."));
    } finally {
      if (requestSequence === machineRequestSequence.current) setMachineLoading(false);
    }
  }, []);

  const startBrowserEnrollment = React.useCallback(async () => {
    setEnrollmentBusy(true);
    setEnrollmentError(undefined);
    try {
      const root = await configuredEnvironmentRoot();
      if (!authority) throw new Error("The ENV authority is not available yet. Refresh and retry.");

      let record = await getStoredEnvironmentManagerKeys();
      let journal = await getEnvironmentEnrollmentJournal();
      const checkpoint = await getEnvironmentAuthorityCheckpoint();
      // A browser key is pinned to the deployment root. If the root changed,
      // start a fresh principal and deliberately discard the old request
      // journal. Never submit a request whose signer is not locally held.
      if (!record || !sameBytes(record.rootPublicKey, root) || managerStatus.reason === "binding_missing" || checkpoint && checkpoint.accountId !== authority.accountId) {
        record = await generateEnvironmentManagerKeys(
          `envbrowser_${crypto.randomUUID().replaceAll("-", "")}`,
          root,
        );
        journal = null;
      }
      if (journal && (
        journal.accountId !== authority.accountId ||
        journal.subjectId !== record.subjectId ||
        journal.subjectGeneration !== record.subjectGeneration ||
        journal.keyGeneration !== record.keyGeneration ||
        !enrollmentJournalMatchesRecord(journal, record)
      )) {
        throw new Error("This browser has an enrollment request for a different account or key.");
      }
      if (journal && Date.parse(journal.requestExpiresAt) <= Date.now()) {
        record = await generateEnvironmentManagerKeys(
          `envbrowser_${crypto.randomUUID().replaceAll("-", "")}`,
          root,
        );
        journal = null;
      }
      if (!journal) {
        const requestExpiresAt = new Date(
          Math.floor((Date.now() + 4 * 60 * 1000) / 1000) * 1000,
        );
        const request = await createEnvironmentEnrollmentRequest({
          accountId: authority.accountId,
          operationId: newOperationID(),
          requestExpiresAt,
          record,
        });
        journal = {
          accountId: authority.accountId,
          operationId: request.body.operation_id as string,
          subjectId: record.subjectId,
          subjectGeneration: record.subjectGeneration,
          keyGeneration: record.keyGeneration,
          requestExpiresAt: requestExpiresAt.toISOString(),
          canonical: request.canonical,
          digest: request.digest,
          safetyCode: request.safetyCode,
          requestBody: request.body,
          state: "created",
        } satisfies EnvironmentEnrollmentJournal;
        await persistEnvironmentEnrollmentJournal(journal);
      }

      // Replaying the exact idempotency key is the only supported way to
      // resume a challenge/pending request. It never sends a private key or
      // an environment value.
      let state = await requestEnvironmentEnrollment(journal.requestBody, journal.operationId);
      if (journal.requestId && state.request_id !== journal.requestId) {
        throw new Error("The server returned a different enrollment request.");
      }
      journal = { ...journal, requestId: state.request_id, state: state.state };
      if (!enrollmentStateMatchesJournal(state, journal)) {
        throw new Error("The enrollment response does not match this browser's request.");
      }
      await persistEnvironmentEnrollmentJournal(journal);
      setEnrollmentState(state);

      if (state.state === "challenge") {
        if (!state.challenge) throw new Error("The enrollment challenge was not returned.");
        const challenge = await openEnvironmentEnrollmentChallenge(record, {
          requestId: state.request_id,
          enrollmentRequest: state.enrollment_request,
          challenge: state.challenge,
          expiresAt: state.expires_at,
        });
        try {
          const proof = await enrollmentProof(record, {
            accountId: journal.accountId,
            requestId: state.request_id,
            operationId: journal.operationId,
            requestDigest: journal.digest,
            challenge,
          });
          try {
            state = await proveEnvironmentEnrollment(
              state.request_id,
              encodeEnvironmentBase64Url(proof),
            );
          } finally {
            proof.fill(0);
          }
          if (state.state !== "pending" || !enrollmentStateMatchesJournal(state, journal)) {
            throw new Error("The enrollment proof was not accepted.");
          }
          journal = { ...journal, state: "pending" };
          await persistEnvironmentEnrollmentJournal(journal);
          setEnrollmentState(state);
        } finally {
          challenge.fill(0);
        }
      }
      toast.success("Browser enrollment request submitted. A trusted ENV manager must approve this key.");
      await refreshAuthority();
    } catch (error) {
      const message = displayErrorMessage(error, "Browser ENV key enrollment could not be completed.");
      setEnrollmentError(message);
      toast.error("Browser ENV enrollment could not be completed.", { description: message });
    } finally {
      setEnrollmentBusy(false);
    }
  }, [authority, managerStatus.reason, refreshAuthority]);

  React.useEffect(() => {
    const request = window.setTimeout(() => {
      void Promise.all([refreshGlobal(), refreshMachines(), refreshAuthority()]);
    }, 0);
    return () => window.clearTimeout(request);
  }, [refreshAuthority, refreshGlobal, refreshMachines]);

  React.useEffect(() => {
    let active = true;
    void getEnvironmentEnrollmentJournal()
      .then((journal) => {
        if (!active || !journal) return;
        const state = enrollmentStateFromJournal(journal);
        if (state) setEnrollmentState(state);
      })
      .catch(() => {
        // A malformed or unavailable local journal is handled when the user
        // explicitly retries enrollment. It must not hide scope metadata.
      });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const request = window.setTimeout(() => {
      void refreshMachine(selectedMachineId);
    }, 0);
    return () => window.clearTimeout(request);
  }, [refreshMachine, selectedMachineId]);

  const selectedMachine = machines.find((machine) => machine.id === selectedMachineId);
  const machineTarget: EnvironmentVariableTarget | undefined = selectedMachineId
    ? { scope: "machine", machineId: selectedMachineId }
    : undefined;

  const hasPendingState = machineSnapshot?.status === "pending" || machineSnapshot?.status === "offline";

  React.useEffect(() => {
    if (!hasPendingState) return;
    const interval = window.setInterval(() => {
      if (selectedMachineId) void refreshMachine(selectedMachineId);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [hasPendingState, refreshGlobal, refreshMachine, selectedMachineId]);

  React.useEffect(() => {
    if (managerStatus.enrolled || enrollmentState?.state !== "pending") return;
    const interval = window.setInterval(() => {
      void refreshAuthority();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enrollmentState?.state, managerStatus.enrolled, refreshAuthority]);

  async function refreshTarget(target: EnvironmentVariableTarget) {
    if (target.scope === "global") {
      await Promise.all([
        refreshGlobal(),
        selectedMachineId ? refreshMachine(selectedMachineId) : Promise.resolve(),
      ]);
    } else {
      await refreshMachine(target.machineId);
    }
  }

  async function saveVariable(
    target: EnvironmentVariableTarget,
    name: string,
    value: string,
  ): Promise<MutationResult> {
    const snapshot = target.scope === "global" ? globalSnapshot : machineSnapshot;
    const key = `${targetKey(target)}:save:${name}`;
    setBusy(key);
    setConflict(undefined);
    try {
      if (!managerStatus.enrolled || !authority) {
        return { ok: false, message: "This browser is not enrolled as an ENV manager. Saving is blocked until key authorization is complete." };
      }
      if (!snapshot || snapshot.key_state !== "ready" || !snapshot.manifest_id) {
        return { ok: false, message: "This scope is not key-authorized yet. Refresh after its ENV manager key is activated." };
      }
      const state = await getEnvironmentManifest(target);
      const current = await parseEnvironmentManifest(await decodeEnvironmentEnvelope(state.envelope), authority);
      if (current.version !== snapshot.version || current.id !== snapshot.manifest_id) {
        throw new ApiError("environment_version_conflict", "The environment scope changed.", 409);
      }
      const next = await createEnvironmentManifest({
        authority,
        current,
        record: managerStatus.record,
        scope: target.scope,
        machineId: target.machineId,
        operationId: newOperationID(),
        value: { name, value },
      });
      await putEnvironmentManifest(target, {
        schema: "paperboat.environment-manifest-mutation/v1",
        expected_version: current.version,
        operation_id: next.manifest.operationId,
        envelope: next.envelope,
      }, state.etag);
      await refreshTarget(target);
      toast.success(`${name} saved for ${targetLabel(target, selectedMachine?.display_name)}.`);
      return { ok: true };
    } catch (error) {
      const message = mutationError(error, "The variable could not be saved.");
      if (isConflict(error)) {
        setConflict(`${targetLabel(target, selectedMachine?.display_name)} changed before the save landed.`);
        await refreshTarget(target);
      } else {
        toast.error("Environment variable could not be saved.", { description: message });
      }
      return { ok: false, message };
    } finally {
      setBusy(undefined);
    }
  }

  async function removeVariable(
    target: EnvironmentVariableTarget,
    item: EnvironmentVariableMetadata,
  ): Promise<MutationResult> {
    const snapshot = target.scope === "global" ? globalSnapshot : machineSnapshot;
    const key = `${targetKey(target)}:delete:${item.name}`;
    setBusy(key);
    setConflict(undefined);
    try {
      if (!managerStatus.enrolled || !authority) {
        return { ok: false, message: "This browser is not enrolled as an ENV manager. Removing is blocked until key authorization is complete." };
      }
      if (!snapshot || snapshot.key_state !== "ready" || !snapshot.manifest_id) {
        return { ok: false, message: "This scope is not key-authorized yet. Refresh after its ENV manager key is activated." };
      }
      const state = await getEnvironmentManifest(target);
      const current = await parseEnvironmentManifest(await decodeEnvironmentEnvelope(state.envelope), authority);
      if (current.version !== snapshot.version || current.id !== snapshot.manifest_id) {
        throw new ApiError("environment_version_conflict", "The environment scope changed.", 409);
      }
      const next = await createEnvironmentManifest({
        authority,
        current,
        record: managerStatus.record,
        scope: target.scope,
        machineId: target.machineId,
        operationId: newOperationID(),
        unsetName: item.name,
      });
      await putEnvironmentManifest(target, {
        schema: "paperboat.environment-manifest-mutation/v1",
        expected_version: current.version,
        operation_id: next.manifest.operationId,
        envelope: next.envelope,
      }, state.etag);
      await refreshTarget(target);
      toast.success(`${item.name} removed from ${targetLabel(target, selectedMachine?.display_name)}.`);
      return { ok: true };
    } catch (error) {
      const message = mutationError(error, "The variable could not be removed.");
      if (isConflict(error)) {
        setConflict(`${targetLabel(target, selectedMachine?.display_name)} changed before the removal landed.`);
        await refreshTarget(target);
      } else {
        toast.error("Environment variable could not be removed.", { description: message });
      }
      return { ok: false, message };
    } finally {
      setBusy(undefined);
    }
  }

  const globalTarget: EnvironmentVariableTarget = { scope: "global" };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="ENV Injection"
        description="Environment variables for account defaults and machine-specific overrides, without exposing stored values."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void Promise.all([refreshGlobal(), refreshMachines(), refreshAuthority()]);
              if (selectedMachineId) void refreshMachine(selectedMachineId);
            }}
            disabled={Boolean(busy)}
          >
            <HugeiconsIcon icon={RefreshIcon} />
            Refresh
          </Button>
        }
      />

      <Alert variant="info" aria-labelledby="precedence-heading">
        <HugeiconsIcon icon={InformationCircleIcon} />
        <AlertTitle id="precedence-heading">How values are resolved</AlertTitle>
        <AlertDescription>
          <span>Account defaults apply to every host machine. A machine override with the same name wins on that host.</span>
          <span>Changes are delivered asynchronously and are visible only to processes started after the host applies them. Restart a running process to pick up a change.</span>
          <span>Values are visible to processes that receive them and may be inspected by sufficiently privileged users or software on the host. Privileged or system services that do not inherit the host environment may not see them.</span>
        </AlertDescription>
      </Alert>

      <Alert variant={managerStatus.enrolled ? "success" : "warning"} aria-labelledby="encryption-heading">
        <HugeiconsIcon icon={InformationCircleIcon} />
        <AlertTitle id="encryption-heading">Browser encryption {managerStatus.enrolled ? "is ready" : "is required"}</AlertTitle>
        <AlertDescription>
          <span>{managerStatus.enrolled ? "Values are encrypted and signed in this browser before they reach Paperboat." : "This browser has no active, root-authorized ENV manager key. Saving and removing variables are blocked until the browser is enrolled."}</span>
          <span>Values are never sent to the dashboard BFF or stored on the control plane in plaintext. Key authorization is separate from login.</span>
          {authorityState ? <span className="font-mono text-[0.6875rem]">Authority generation {authorityState.generation}</span> : null}
          {authorityError ? <span>{authorityError}</span> : null}
          {!managerStatus.enrolled ? (
            <span className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void startBrowserEnrollment()}
                disabled={enrollmentBusy || !authority || Boolean(busy)}
              >
                {enrollmentBusy ? <Spinner className="size-4" /> : null}
                {enrollmentState?.state === "pending" ? "Check authorization" : "Enroll this browser"}
              </Button>
              {enrollmentState?.state === "pending" ? (
                <span role="status">Pending approval. Compare safety code <code className="font-mono">{enrollmentState.safety_code}</code> with a trusted ENV manager.</span>
              ) : null}
            </span>
          ) : null}
          {enrollmentError ? <span className="text-destructive" role="alert">{enrollmentError}</span> : null}
        </AlertDescription>
      </Alert>

      {machinesError ? (
        <Alert variant="error">
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>Machine data is unavailable</AlertTitle>
          <AlertDescription>
            <span>{machinesError}</span>
            <Button variant="outline" size="sm" onClick={() => void refreshMachines()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {conflict ? (
        <Alert variant="warning">
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>Refresh required</AlertTitle>
          <AlertDescription>
            <span>{conflict}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConflict(undefined);
                void refreshGlobal();
                if (selectedMachineId) void refreshMachine(selectedMachineId);
              }}
            >
              Refresh variables
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ScopePanel
          target={globalTarget}
          title="Account defaults"
          description="Applied to every host machine unless that machine has an override."
          snapshot={globalSnapshot}
          loading={globalLoading}
          error={globalError}
          busy={busy}
          managerReady={managerStatus.enrolled}
          onRefresh={() => void refreshGlobal()}
          onSave={(name, value) => saveVariable(globalTarget, name, value)}
          onDelete={managerStatus.enrolled ? (item) => removeVariable(globalTarget, item) : undefined}
        />

        <ScopePanel
          target={machineTarget}
          title="Machine overrides"
          description="Override an account default for one host machine."
          snapshot={machineSnapshot}
          loading={machineLoading || machinesLoading}
          error={machineError}
          busy={busy}
          managerReady={managerStatus.enrolled}
          machine={selectedMachine}
          machineSelector={
            <NativeSelect
              aria-label="Machine for environment variables"
              value={selectedMachineId ?? ""}
              disabled={machinesLoading || machines.length === 0 || Boolean(busy)}
              onChange={(event) => {
                // Do not let a previous machine's ETag/version remain
                // actionable while the newly selected scope is loading.
                setMachineSnapshot(undefined);
                setMachineError(undefined);
                setMachineLoading(true);
                setSelectedMachineId(event.target.value || undefined);
              }}
            >
              {machines.length === 0 ? (
                <NativeSelectOption value="">No machines</NativeSelectOption>
              ) : (
                machines.map((machine) => (
                  <NativeSelectOption key={machine.id} value={machine.id}>
                    {machine.display_name} · {machine.state}
                  </NativeSelectOption>
                ))
              )}
            </NativeSelect>
          }
          onRefresh={() => void refreshMachine(selectedMachineId)}
          onSave={machineTarget ? (name, value) => saveVariable(machineTarget, name, value) : undefined}
          onDelete={machineTarget && managerStatus.enrolled ? (item) => removeVariable(machineTarget, item) : undefined}
        />
      </div>
    </>
  );
}

function ScopePanel({
  target,
  title,
  description,
  snapshot,
  loading,
  error,
  busy,
  managerReady,
  machine,
  machineSelector,
  onRefresh,
  onSave,
  onDelete,
}: {
  target?: EnvironmentVariableTarget;
  title: string;
  description: string;
  snapshot?: EnvironmentVariableSnapshot;
  loading: boolean;
  error?: string;
  busy?: string;
  managerReady: boolean;
  machine?: Machine;
  machineSelector?: React.ReactNode;
  onRefresh: () => void;
  onSave?: (name: string, value: string) => Promise<MutationResult>;
  onDelete?: (item: EnvironmentVariableMetadata) => Promise<MutationResult>;
}) {
  const key = target ? targetKey(target) : "machine";
  const canEdit = Boolean(target && snapshot && onSave && managerReady && snapshot.key_state === "ready");
  const headingID = `${key.replace(/[^a-z0-9_-]/gi, "-")}-heading`;

  return (
    <Card role="region" aria-labelledby={headingID}>
      <CardHeader className="border-b p-5 pb-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle id={headingID} className="font-heading text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          {machineSelector}
          {snapshot ? (
            <span className="whitespace-nowrap font-mono text-[0.6875rem] text-muted-foreground">
              v{snapshot.version}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Refresh ${title}`}
            onClick={onRefresh}
            disabled={loading || Boolean(busy)}
          >
            <HugeiconsIcon icon={RefreshIcon} />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {machine && !machine.online ? (
          <Alert variant="warning">
            <HugeiconsIcon icon={CloudServerIcon} />
            <AlertTitle>{machine.display_name} is offline</AlertTitle>
            <AlertDescription>
              Changes can be saved now and will apply when the machine reconnects. Existing processes are not changed.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="error">
            <HugeiconsIcon icon={Alert02Icon} />
            <AlertTitle>Variables could not be loaded</AlertTitle>
            <AlertDescription>
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <LoadingRows />
        ) : !target ? (
          <EmptyVariables
            title="Choose a machine"
            description="Select a machine above to manage its overrides."
          />
        ) : !snapshot ? (
          <EmptyVariables
            title="No variable state"
            description="Refresh this scope before making a change."
            action={<Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>}
          />
        ) : (
          <>
            {target.scope === "machine" ? <ScopeStatus snapshot={snapshot} /> : null}
            {!managerReady ? (
              <p className="rounded-lg border border-warning/32 bg-warning/4 px-3 py-2.5 text-xs text-muted-foreground" role="status">
                Browser ENV key authorization is required before this scope can be changed.
              </p>
            ) : snapshot.key_state !== "ready" ? (
              <p className="rounded-lg border border-warning/32 bg-warning/4 px-3 py-2.5 text-xs text-muted-foreground" role="status">
                This scope is waiting for ENV key authorization and is read-only.
              </p>
            ) : null}
            {canEdit ? (
              <VariableForm
                scopeKey={key}
                existingNames={snapshot.items.map((item) => item.name)}
                disabled={!canEdit || Boolean(busy)}
                onSave={onSave!}
              />
            ) : null}
            {snapshot.items.length === 0 ? (
              <EmptyVariables
                title="No variables configured"
                description="Add a variable above. Stored values are write-only and will not be shown after saving."
              />
            ) : (
              <VariableList
                items={snapshot.items}
                scopeStatus={snapshot.status}
                busy={busy}
                onDelete={onDelete}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScopeStatus({ snapshot }: { snapshot: EnvironmentVariableSnapshot }) {
  const presentation = environmentVariableStatus(snapshot.status, "machine");
  const message = environmentVariableStatusMessage(snapshot.status, true, "machine");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium">Host delivery status</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        {snapshot.error_code ? <p className="mt-1 text-xs text-destructive">Error code: {snapshot.error_code}</p> : null}
      </div>
      <Badge variant={presentation.variant} role="status" aria-label={presentation.label}>
        <span className={`size-1.5 rounded-full ${presentation.dotClassName}`} aria-hidden="true" />
        {presentation.label}
      </Badge>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3" aria-label="Loading environment variables">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyVariables({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="min-h-48 border border-dashed border-border py-8">
      <EmptyMedia variant="icon">
        <HugeiconsIcon icon={VariableIcon} className="size-4 text-muted-foreground" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}

function VariableForm({
  scopeKey,
  existingNames,
  disabled,
  onSave,
}: {
  scopeKey: string;
  existingNames: readonly string[];
  disabled: boolean;
  onSave: (name: string, value: string) => Promise<MutationResult>;
}) {
  const [name, setName] = React.useState("");
  const [value, setValue] = React.useState("");
  const [nameTouched, setNameTouched] = React.useState(false);
  const [formError, setFormError] = React.useState<string>();
  const nameError = nameTouched ? validateEnvironmentVariableName(name, existingNames) : undefined;
  const nameID = `${scopeKey.replace(/[^a-z0-9_-]/gi, "-")}-variable-name`;
  const valueID = `${scopeKey.replace(/[^a-z0-9_-]/gi, "-")}-variable-value`;
  const helpID = `${scopeKey.replace(/[^a-z0-9_-]/gi, "-")}-variable-help`;
  const errorID = `${scopeKey.replace(/[^a-z0-9_-]/gi, "-")}-variable-error`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedValue = value;
    // Clear the password input before validating the name or starting the
    // request. A rejected submission must not leave a secret in the form.
    setValue("");
    setFormError(undefined);
    setNameTouched(true);
    const validationError = validateEnvironmentVariableName(name, existingNames);
    if (validationError) return;

    const submittedName = name.trim();
    const valueValidationError = validateEnvironmentVariableValue(submittedValue);
    if (valueValidationError) {
      setFormError(valueValidationError);
      return;
    }
    const result = await onSave(submittedName, submittedValue);
    if (result.ok) {
      setName("");
      setNameTouched(false);
    } else {
      setFormError(result.message);
    }
  }

  return (
    <form className="space-y-3 border-b border-border pb-5" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={nameID}>Variable name</Label>
          <Input
            id={nameID}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="API_BASE_URL"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? errorID : helpID}
            disabled={disabled}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={valueID}>Value</Label>
          <Input
            id={valueID}
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Write-only value"
            maxLength={MAX_VARIABLE_VALUE_BYTES}
            autoComplete="new-password"
            aria-describedby={helpID}
            disabled={disabled}
          />
        </div>
        <Button type="submit" disabled={disabled || !name.trim()}>
          Save
        </Button>
      </div>
      <p id={helpID} className="text-xs leading-relaxed text-muted-foreground">
        Values are write-only and are never shown after saving. An empty value is valid; use Remove to unset it. Values are limited to 32,767 UTF-8 bytes. Paperboat-reserved names cannot be configured.
      </p>
      {nameError ? <p id={errorID} className="text-xs text-destructive">{nameError}</p> : null}
      {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
    </form>
  );
}

function VariableList({
  items,
  scopeStatus,
  busy,
  onDelete,
}: {
  items: EnvironmentVariableMetadata[];
  scopeStatus?: string;
  busy?: string;
  onDelete?: (item: EnvironmentVariableMetadata) => Promise<MutationResult>;
}) {
  return (
    <ul className="divide-y divide-border" aria-label="Configured environment variables">
      {items.map((item) => (
        <VariableRow
          key={`${item.scope}:${item.machine_id ?? "global"}:${item.name}`}
          item={item}
          scopeStatus={scopeStatus}
          busy={busy}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function VariableRow({
  item,
  scopeStatus,
  busy,
  onDelete,
}: {
  item: EnvironmentVariableMetadata;
  scopeStatus?: string;
  busy?: string;
  onDelete?: (item: EnvironmentVariableMetadata) => Promise<MutationResult>;
}) {
  const presentation = environmentVariableStatus(scopeStatus, item.scope);
  const message = environmentVariableStatusMessage(scopeStatus, item.configured, item.scope);
  const deleting = busy?.endsWith(`:delete:${item.name}`) ?? false;

  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="min-w-0">
        <code className="break-all font-mono text-sm font-medium">{item.name}</code>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={presentation.variant} role="status" aria-label={presentation.label}>
          <span className={`size-1.5 rounded-full ${presentation.dotClassName}`} aria-hidden="true" />
          {presentation.label}
        </Badge>
        <span className="font-mono">v{item.version}</span>
        {item.updated_at ? <time dateTime={item.updated_at}>{formatTimestamp(item.updated_at)}</time> : null}
      </div>
      {onDelete ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="destructive-outline"
                size="sm"
                disabled={Boolean(busy) || !item.configured}
              />
            }
          >
            <HugeiconsIcon icon={Delete02Icon} />
            Remove
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {item.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the stored value from this scope. Existing processes keep their current environment; new processes will stop receiving it after the change is applied.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep variable</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={Boolean(busy)}
                onClick={() => void onDelete(item)}
              >
                {deleting ? <Spinner className="size-4" /> : null}
                Remove variable
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </li>
  );
}

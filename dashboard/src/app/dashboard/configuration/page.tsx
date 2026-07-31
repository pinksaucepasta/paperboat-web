"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Configuration01Icon,
  GitBranchIcon,
  GithubIcon,
  InformationCircleIcon,
  Link01Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { configSyncBadge, formatBytes, formatTimestamp } from "@/components/dashboard/config-sync-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  acceptConfigConsent,
  assignConfigRepository,
  connectConfigRepository,
  disconnectConfigRepository,
  forceConfigSync,
  getConfigWarning,
  listConfigRepositories,
  listConfigRepositoryCandidates,
  removeConfigConsent,
  resolveConfigConflict,
  unassignConfigRepository,
  useConfigSyncStatus,
	type ConfigAssignmentMode,
  type ConfigForceAction,
  type ConfigRepositoryCandidate,
  type ConfigConflictResolutionAction,
} from "@/lib/api/config-sync";
import { startGitHubOAuth } from "@/lib/api/github";
import { displayErrorMessage } from "@/lib/api/client";
import type {
  ConfigRepository,
  ConfigSyncEnvironmentStatus,
  ConfigSyncPathSummary,
  ConfigSyncStatus,
  ConfigWarningFacts,
} from "@/lib/api/types";

export default function ConfigurationPage() {
  const searchParams = useSearchParams();
  const status = useConfigSyncStatus();
  const [repositories, setRepositories] = React.useState<ConfigRepository[]>([]);
  const [candidates, setCandidates] = React.useState<ConfigRepositoryCandidate[]>([]);
  const [catalogError, setCatalogError] = React.useState<string>();
  const [loadingCatalog, setLoadingCatalog] = React.useState(true);

  const refreshCatalog = React.useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [connected, available] = await Promise.all([
        listConfigRepositories(),
        listConfigRepositoryCandidates(),
      ]);
      setRepositories(connected.items);
      setCandidates(available.items);
      setCatalogError(undefined);
    } catch (error) {
      setCatalogError(displayErrorMessage(error, "Repository access is unavailable. Refresh the page and retry."));
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  React.useEffect(() => {
    const request = window.setTimeout(() => { void refreshCatalog(); }, 0);
    return () => window.clearTimeout(request);
  }, [refreshCatalog]);

  React.useEffect(() => {
    const result = searchParams.get("github");
    if (result === "connected") toast.success("GitHub authorized. Choose a repository below.");
    if (result === "error") toast.error("GitHub authorization failed.");
  }, [searchParams]);

  if (status.loading && !status.data) return <ConfigurationLoading />;
  if (!status.data) {
    return <ConfigurationError message={status.error?.message ?? "The control plane did not return a sync status."} />;
  }
  return (
    <ConfigurationStatusView
      data={status.data}
      repositories={repositories}
      candidates={candidates}
      catalogError={catalogError}
      catalogLoading={loadingCatalog}
      refresh={() => { status.refresh(); void refreshCatalog(); }}
      refreshError={status.error?.message}
    />
  );
}

interface ConfigurationStatusViewProps {
  data: ConfigSyncStatus;
  repositories: ConfigRepository[];
  candidates: ConfigRepositoryCandidate[];
  catalogError?: string;
  catalogLoading?: boolean;
  refresh: () => void;
  refreshError?: string;
}

export function ConfigurationStatusView({
  data, repositories, candidates, catalogError, catalogLoading, refresh, refreshError,
}: ConfigurationStatusViewProps) {
  const overall = configSyncBadge(data.state);
  const [busy, setBusy] = React.useState<string>();
  const [selectedCandidate, setSelectedCandidate] = React.useState("");
  const [warning, setWarning] = React.useState<{ environment: ConfigSyncEnvironmentStatus; facts: ConfigWarningFacts }>();
  const [accepted, setAccepted] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState<ConfigRepository>();
  const [force, setForce] = React.useState<{ environment: ConfigSyncEnvironmentStatus; conflict?: ConfigSyncPathSummary; action: ConfigForceAction }>();
  const [forceAccepted, setForceAccepted] = React.useState(false);
  const [authorizing, setAuthorizing] = React.useState(false);

  const connectedIDs = new Set(repositories.map((repository) => repository.external_ref));
  const connectable = candidates.filter((candidate) => !connectedIDs.has(candidate.external_id));
  const skipped = flattenSummaries(data.environments, "skipped");
  const conflicts = data.environments.flatMap((environment) =>
    environment.conflicts.map((item) => ({ ...item, environment })),
  );

  async function mutate(key: string, operation: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(key);
    try {
      await operation();
      toast.success(success);
      refresh();
      return true;
    } catch (error) {
      toast.error("Configuration could not be changed.", {
        description: displayErrorMessage(error, "Refresh the page and try again."),
      });
      return false;
    } finally {
      setBusy(undefined);
    }
  }

  async function authorizeGitHub() {
    setAuthorizing(true);
    try {
      const redirectUri =
        window.location.origin + "/github/callback?return_to=configuration";
      const { authorization_url } = await startGitHubOAuth(redirectUri);
      window.location.href = authorization_url;
    } catch (error) {
      toast.error("GitHub authorization could not be started.", {
        description: displayErrorMessage(error, "Please try again."),
      });
      setAuthorizing(false);
    }
  }

  async function connectRepository() {
    const candidate = connectable.find((item) => item.external_id === selectedCandidate);
    if (!candidate) return;
    if (await mutate(`connect:${candidate.external_id}`, () => connectConfigRepository(candidate), `${candidate.display_name} connected.`)) {
      setSelectedCandidate("");
    }
  }

  async function assign(environment: ConfigSyncEnvironmentStatus, repositoryID: string, mode: ConfigAssignmentMode) {
    if (!repositoryID) return;
    setBusy(`assign:${environment.environment_id}`);
    try {
      const assignment = await assignConfigRepository(
        environment.machine_id,
        repositoryID,
		mode,
        environment.assignment_version ?? 0,
      );
      if (environment.profile === "byod") {
        const facts = await getConfigWarning(environment.machine_id);
        setWarning({
          environment: {
            ...environment,
            assignment_id: assignment.id,
            assignment_version: assignment.version,
            repository_id: repositoryID,
			mode,
            consent_state: assignment.consent_state,
          },
          facts,
        });
        setAccepted(false);
      } else {
        toast.success(`Configuration assigned to ${environment.display_name}.`);
      }
      refresh();
    } catch (error) {
      toast.error("Repository could not be assigned.", {
        description: displayErrorMessage(error, "Refresh the page and try again."),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function openWarning(environment: ConfigSyncEnvironmentStatus) {
    setBusy(`warning:${environment.environment_id}`);
    try {
      setWarning({ environment, facts: await getConfigWarning(environment.machine_id) });
      setAccepted(false);
    } catch (error) {
      toast.error("Consent details are unavailable.", {
        description: displayErrorMessage(error, "Refresh the page and try again."),
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function acceptWarning() {
    if (!warning || !accepted) return;
    const enabled = await mutate(
      `consent:${warning.environment.environment_id}`,
      () => acceptConfigConsent(
        warning.environment.machine_id,
        warning.facts.revision,
        warning.environment.assignment_version ?? 0,
      ),
      `Configuration sync enabled on ${warning.facts.machine_name}.`,
    );
    if (enabled) setWarning(undefined);
  }

  async function resolveConflict(
    environment: ConfigSyncEnvironmentStatus,
    conflict: ConfigSyncPathSummary,
    action: ConfigConflictResolutionAction,
  ) {
    if (!conflict.revision || !environment.remote_revision || !environment.assignment_version) {
      toast.error("Conflict details are stale. Refresh before choosing a resolution.");
      return;
    }
    await mutate(
      `resolve:${environment.environment_id}:${conflict.revision}`,
      () => resolveConfigConflict(environment.environment_id, {
        path: conflict.path,
        conflict_revision: conflict.revision!,
        expected_remote_revision: environment.remote_revision!,
        expected_assignment_version: environment.assignment_version!,
        action,
      }),
      `Resolution queued for ${conflict.path}.`,
    );
  }

  async function confirmForce() {
    if (!force || !forceAccepted || !force.environment.remote_revision || !force.environment.assignment_version) return;
    const queued = await mutate(
      `force:${force.environment.environment_id}:${force.conflict?.path ?? "config"}`,
      () => forceConfigSync(force.environment.environment_id, {
        scope: force.conflict ? "path" : "config",
        path: force.conflict?.path,
        conflict_revision: force.conflict?.revision,
        expected_remote_revision: force.environment.remote_revision!,
        expected_assignment_version: force.environment.assignment_version!,
        action: force.action,
        confirmation: force.action === "force_pull" ? "FORCE PULL" : "FORCE PUSH",
      }),
      `Force ${force.action === "force_pull" ? "pull" : "push"} queued for ${force.conflict?.path ?? force.environment.display_name}.`,
    );
    if (queued) {
      setForce(undefined);
      setForceAccepted(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Configuration"
        description="Connect private repositories, choose where each one applies, and review synchronization health."
      />

      {refreshError || catalogError ? (
        <Alert>
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>Some configuration data could not be refreshed</AlertTitle>
          <AlertDescription>{refreshError ?? catalogError} The latest available state remains visible.</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid items-start gap-6 min-[960px]:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]" aria-labelledby="repository-heading">
        <Card>
          <CardHeader className="border-b p-5 pb-4">
            <CardTitle id="repository-heading">Connected repositories</CardTitle>
            <CardDescription>Authorize GitHub, then explicitly choose each private repository Paperboat may use.</CardDescription>
            <CardAction className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={authorizing || Boolean(busy)}
                onClick={() => void authorizeGitHub()}
              >
                {authorizing ? <Spinner className="size-4" /> : <HugeiconsIcon icon={GithubIcon} />}
                Refresh GitHub access
              </Button>
              <StatusBadge status={overall.status} label={overall.label} />
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {repositories.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><HugeiconsIcon icon={GitBranchIcon} /></EmptyMedia>
                  <EmptyTitle>No configuration repository connected</EmptyTitle>
                  <EmptyDescription>Select a private GitHub repository to begin. Connecting does not enable synchronization.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-y">
                {repositories.map((repository) => (
                  <li key={repository.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{repository.display_name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{repository.provider} · {repository.state}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => setDisconnecting(repository)}
                    >
                      <HugeiconsIcon icon={Unlink01Icon} />Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-3 border-t px-5 pb-5 pt-4 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium">
                Add a private GitHub repository
                <NativeSelect
                  className="mt-2 w-full"
                  value={selectedCandidate}
                  disabled={catalogLoading || Boolean(busy)}
                  onChange={(event) => setSelectedCandidate(event.target.value)}
                >
                  <NativeSelectOption value="">{catalogLoading ? "Loading repositories…" : "Select repository"}</NativeSelectOption>
                  {connectable.map((candidate) => (
                    <NativeSelectOption key={candidate.external_id} value={candidate.external_id}>
                      {candidate.display_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <Button disabled={!selectedCandidate || Boolean(busy)} onClick={() => void connectRepository()}>
                <HugeiconsIcon icon={Link01Icon} />Connect
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b p-5 pb-4">
            <CardTitle>Runtime policy</CardTitle>
            <CardDescription>Server-owned limits apply to every assigned environment.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 px-5 pb-5 pt-4">
            <Metric label="Per file" value={formatBytes(data.policy.max_file_bytes)} />
            <Metric label="Per push" value={formatBytes(data.policy.max_batch_bytes)} />
            <Metric label="Rollout mode" value={data.policy.mode.replaceAll("_", " ")} />
            <Metric label="Personal machines" value={data.policy.byod_enabled ? "Enabled" : "Disabled"} />
            <Metric label="Format" value={data.policy.format} mono />
            <Metric label="Revision" value={data.policy.revision} mono />
			<Metric label="Selection" value={data.policy.manifest_contract} mono />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Environment assignments</CardTitle>
          <CardDescription>Hosted environments start after assignment. Personal machines require the current warning to be accepted separately.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {data.environments.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon"><HugeiconsIcon icon={Configuration01Icon} /></EmptyMedia>
                <EmptyTitle>No environments yet</EmptyTitle>
                <EmptyDescription>Create a hosted project or connect a personal machine before assigning configuration.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableCaption className="sr-only">Configuration repository assignment and health by environment</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Environment</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead className="pr-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.environments.map((environment) => {
                  const badge = configSyncBadge(environment.state);
                  const assigned = Boolean(environment.repository_id);
                  return (
                    <TableRow key={environment.environment_id}>
                      <TableCell className="pl-4">
                        <p className="font-medium">{environment.display_name}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{environment.profile === "byod" ? "Personal machine" : "Hosted"}</p>
                      </TableCell>
                      <TableCell className="min-w-52">
                        <NativeSelect
                          aria-label={`Repository for ${environment.display_name}`}
                          value={environment.repository_id ?? ""}
                          disabled={Boolean(busy) || repositories.length === 0}
						  onChange={(event) => void assign(environment, event.target.value, environment.mode ?? "pull_only")}
                        >
                          <NativeSelectOption value="">{repositories.length ? "Unassigned" : "Connect a repository first"}</NativeSelectOption>
                          {repositories.filter((repository) => repository.state === "active").map((repository) => (
                            <NativeSelectOption key={repository.id} value={repository.id}>{repository.display_name}</NativeSelectOption>
                          ))}
                        </NativeSelect>
						<NativeSelect
						  className="mt-2"
						  aria-label={`Synchronization mode for ${environment.display_name}`}
						  value={environment.mode ?? "pull_only"}
						  disabled={Boolean(busy) || !environment.repository_id}
						  onChange={(event) => {
							if (!environment.repository_id) return;
							void assign(environment, environment.repository_id, event.target.value as ConfigAssignmentMode);
						  }}
						>
						  <NativeSelectOption value="pull_only">Pull only</NativeSelectOption>
						  <NativeSelectOption value="push_only">Push only</NativeSelectOption>
						  <NativeSelectOption value="bidirectional">Bidirectional</NativeSelectOption>
						</NativeSelect>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={badge.status} label={badge.label} />
                        {environment.manifest_health ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Manifest {environment.manifest_health.replaceAll("_", " ")} · {environment.managed_path_count} managed
                            {environment.pending_clean_path_count > 0 ? ` · ${environment.pending_clean_path_count} pending` : ""}
                          </p>
                        ) : null}
                        {environment.error_code ? <p className="mt-1 text-xs text-destructive">{environment.error_code.replaceAll("_", " ")}</p> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatTimestamp(environment.last_successful_sync_at)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          {environment.profile === "byod" && assigned && environment.consent_state !== "accepted" ? (
                            <Button size="sm" disabled={Boolean(busy)} onClick={() => void openWarning(environment)}>Review warning</Button>
                          ) : null}
                          {environment.profile === "byod" && environment.consent_state === "accepted" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busy)}
                              onClick={() => void mutate(
                                `remove-consent:${environment.environment_id}`,
                                () => removeConfigConsent(environment.machine_id, environment.assignment_version ?? 0),
                                `Configuration sync disabled on ${environment.display_name}.`,
                              )}
                            >
                              Remove consent
                            </Button>
                          ) : null}
                          {assigned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Boolean(busy)}
                              onClick={() => void mutate(
                                `unassign:${environment.environment_id}`,
                                () => unassignConfigRepository(environment.machine_id, environment.assignment_version ?? 0),
                                `Configuration unassigned from ${environment.display_name}.`,
                              )}
                            >
                              Unassign
                            </Button>
                          ) : null}
                          {assigned && environment.remote_revision ? (
                            <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => { setForce({ environment, action: "force_pull" }); setForceAccepted(false); }}>
                              Force pull
                            </Button>
                          ) : null}
                          {assigned && environment.remote_revision && environment.mode !== "pull_only" ? (
                            <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => { setForce({ environment, action: "force_push" }); setForceAccepted(false); }}>
                              Force push
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 min-[960px]:grid-cols-2">
        <IssueList title="Skipped paths" description="Oversized or unsafe paths stayed local." items={skipped} empty="No paths are being skipped." icon={InformationCircleIcon} />
        <ConflictPanel items={conflicts} busy={Boolean(busy)} onResolve={resolveConflict} onForce={(environment, conflict, action) => { setForce({ environment, conflict, action }); setForceAccepted(false); }} />
      </div>

      <ConsentDialog
        value={warning}
        accepted={accepted}
        busy={Boolean(busy)}
        onAcceptedChange={setAccepted}
        onClose={() => setWarning(undefined)}
        onConfirm={() => void acceptWarning()}
      />

      <Dialog open={Boolean(force)} onOpenChange={(open) => { if (!open) { setForce(undefined); setForceAccepted(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force {force?.action === "force_pull" ? "repository" : "machine"} version?</DialogTitle>
            <DialogDescription>
              {force?.conflict ? `${force.conflict.path} on ${force.environment.display_name}` : `All managed paths on ${force?.environment.display_name}`} will use the selected direction.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <HugeiconsIcon icon={Alert02Icon} />
            <AlertTitle>{force?.conflict ? "Path-scoped operation" : "Configuration-scoped operation"}</AlertTitle>
            <AlertDescription>The operation remains bounded by the manifest and creates recoverable history without rewriting Git history.</AlertDescription>
          </Alert>
          <label className="flex cursor-pointer items-start gap-3 border p-3 text-sm">
            <input className="mt-0.5 size-4 accent-primary" type="checkbox" checked={forceAccepted} onChange={(event) => setForceAccepted(event.target.checked)} />
            <span>I understand which side will replace the other and want to queue this force operation.</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForce(undefined); setForceAccepted(false); }}>Cancel</Button>
            <Button disabled={!forceAccepted || Boolean(busy)} onClick={() => void confirmForce()}>Queue force operation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(disconnecting)} onOpenChange={(open) => { if (!open) setDisconnecting(undefined); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {disconnecting?.display_name}?</DialogTitle>
            <DialogDescription>All assignments using this repository will stop immediately. Paperboat will not delete the GitHub repository or any files.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnecting(undefined)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={Boolean(busy)}
              onClick={() => {
                if (!disconnecting) return;
                void mutate(
                  `disconnect:${disconnecting.id}`,
                  () => disconnectConfigRepository(disconnecting.id),
                  `${disconnecting.display_name} disconnected.`,
                ).then((disconnected) => { if (disconnected) setDisconnecting(undefined); });
              }}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConsentDialog({
  value, accepted, busy, onAcceptedChange, onClose, onConfirm,
}: {
  value?: { environment: ConfigSyncEnvironmentStatus; facts: ConfigWarningFacts };
  accepted: boolean;
  busy: boolean;
  onAcceptedChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const facts = value?.facts;
  return (
    <Dialog open={Boolean(value)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allow configuration changes on {facts?.machine_name}?</DialogTitle>
          <DialogDescription>{facts?.repository_name} will synchronize within {facts?.canonical_scope}.</DialogDescription>
        </DialogHeader>
        {facts ? (
          <div className="space-y-4 text-sm">
            <Alert>
              <HugeiconsIcon icon={Alert02Icon} />
			  <AlertTitle>{facts.mode.replaceAll("_", " ")} synchronization</AlertTitle>
			  <AlertDescription>{facts.manifest_scope}</AlertDescription>
            </Alert>
            <ul className="space-y-2 text-muted-foreground">
              <li>{facts.conflict_behavior}</li>
			  <li>{facts.repository_visibility}</li>
			  <li>{facts.history_retention}</li>
			  <li>{facts.force_behavior}</li>
              <li>{facts.offline_behavior}</li>
              <li>{facts.disable_action}</li>
              <li>{facts.access_consequence}</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                className="mt-0.5 size-4 accent-primary"
                type="checkbox"
                checked={accepted}
                onChange={(event) => onAcceptedChange(event.target.checked)}
              />
			  <span>I understand the selected synchronization direction, manifest scope, plaintext private-Git storage, retained Git history, and repository-access risk.</span>
            </label>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!accepted || busy} onClick={onConfirm}>Accept and enable</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueList({
  title, description, items, empty, icon,
}: {
  title: string;
  description: string;
  items: Array<ConfigSyncPathSummary & { environment: string }>;
  empty: string;
  icon: typeof InformationCircleIcon;
}) {
  return (
    <Card>
      <CardHeader className="border-b p-5 pb-4"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><HugeiconsIcon icon={icon} className="size-4" />{empty}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={`${item.environment}:${item.path}:${index}`} className="flex min-w-0 items-start justify-between gap-4 text-xs">
                <div className="min-w-0"><p className="truncate font-mono text-foreground" title={item.path}>{item.path}</p><p className="text-muted-foreground">{item.environment} · {item.reason.replaceAll("_", " ")}</p></div>
                {item.bytes ? <span className="shrink-0 font-mono text-muted-foreground">{formatBytes(item.bytes)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictPanel({
  items,
  busy,
  onResolve,
  onForce,
}: {
  items: Array<ConfigSyncPathSummary & { environment: ConfigSyncEnvironmentStatus }>;
  busy: boolean;
  onResolve: (
    environment: ConfigSyncEnvironmentStatus,
    conflict: ConfigSyncPathSummary,
    action: ConfigConflictResolutionAction,
  ) => Promise<void>;
  onForce: (environment: ConfigSyncEnvironmentStatus, conflict: ConfigSyncPathSummary, action: ConfigForceAction) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b p-5 pb-4">
        <CardTitle>Conflicts</CardTitle>
        <CardDescription>Both conflicting versions remain in private local state until an explicit current-revision choice lands.</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />No concurrent changes need resolution.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={`${item.environment.environment_id}:${item.revision}:${item.path}`} className="space-y-3 border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="truncate font-mono text-xs text-foreground" title={item.path}>{item.path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.environment.display_name} · {item.reason.replaceAll("_", " ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !item.revision} onClick={() => void onResolve(item.environment, item, "keep_local")}>Keep this machine</Button>
                  <Button size="sm" variant="outline" disabled={busy || !item.revision} onClick={() => void onResolve(item.environment, item, "keep_remote")}>Keep repository</Button>
                  <Button size="sm" variant="outline" disabled={busy || !item.revision} onClick={() => onForce(item.environment, item, "force_pull")}>Force repository</Button>
                  <Button size="sm" variant="outline" disabled={busy || !item.revision || item.environment.mode === "pull_only"} onClick={() => onForce(item.environment, item, "force_push")}>Force machine</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function flattenSummaries(environments: ConfigSyncEnvironmentStatus[], key: "skipped" | "conflicts") {
  return environments.flatMap((environment) => environment[key].map((item) => ({ ...item, environment: environment.display_name })));
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className={mono ? "truncate font-mono text-sm font-medium" : "text-sm font-medium"}>{value}</p></div>;
}

export function ConfigurationError({ message }: { message: string }) {
	return <><PageHeader eyebrow="Workspace" title="Configuration" description="Configuration synchronization by machine." /><Alert variant="error"><HugeiconsIcon icon={Alert02Icon} /><AlertTitle>Configuration status is unavailable</AlertTitle><AlertDescription>{message}</AlertDescription></Alert></>;
}

export function ConfigurationLoading() {
	return <div aria-busy="true" aria-label="Loading configuration synchronization status"><PageHeader eyebrow="Workspace" title="Configuration" description="Configuration synchronization by machine." /><div className="mt-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div><Skeleton className="mt-6 h-72" /></div>;
}

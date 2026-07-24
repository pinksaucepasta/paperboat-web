"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Configuration01Icon,
  Copy01Icon,
  Download04Icon,
  GitBranchIcon,
  GithubIcon,
  InformationCircleIcon,
  Key01Icon,
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
  deleteConfigSyncOverride,
  disconnectConfigRepository,
  exportConfigRecoveryKey,
  getConfigWarning,
  listConfigRepositories,
  listConfigRepositoryCandidates,
  putConfigSyncOverride,
  removeConfigConsent,
  resolveConfigConflict,
  rotateConfigRecoveryKey,
  unassignConfigRepository,
  useConfigSyncOverrides,
  useConfigSyncStatus,
  type ConfigRepositoryCandidate,
  type ConfigConflictResolutionAction,
} from "@/lib/api/config-sync";
import { startGitHubOAuth } from "@/lib/api/github";
import type {
  ConfigClassificationDecision,
  ConfigRecoveryKey,
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
      setCatalogError(error instanceof Error ? error.message : "Repository access is unavailable.");
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
  const [authorizing, setAuthorizing] = React.useState(false);

  const connectedIDs = new Set(repositories.map((repository) => repository.external_ref));
  const connectable = candidates.filter((candidate) => !connectedIDs.has(candidate.external_id));
  const skipped = flattenSummaries(data.environments, "skipped");
  const conflicts = data.environments.flatMap((environment) =>
    environment.conflicts.map((item) => ({ ...item, environment })),
  );
  const classifierPending = flattenSummaries(data.environments, "classifier_pending");

  async function mutate(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await operation();
      toast.success(success);
      refresh();
    } catch (error) {
      toast.error("Configuration could not be changed.", {
        description: error instanceof Error ? error.message : "Please refresh and try again.",
      });
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
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setAuthorizing(false);
    }
  }

  async function connectRepository() {
    const candidate = connectable.find((item) => item.external_id === selectedCandidate);
    if (!candidate) return;
    await mutate(`connect:${candidate.external_id}`, () => connectConfigRepository(candidate), `${candidate.display_name} connected.`);
    setSelectedCandidate("");
  }

  async function assign(environment: ConfigSyncEnvironmentStatus, repositoryID: string) {
    if (!repositoryID) return;
    setBusy(`assign:${environment.environment_id}`);
    try {
      const assignment = await assignConfigRepository(
        environment.environment_id,
        repositoryID,
        environment.assignment_version ?? 0,
      );
      if (environment.profile === "byod") {
        const facts = await getConfigWarning(environment.environment_id);
        setWarning({
          environment: {
            ...environment,
            assignment_id: assignment.id,
            assignment_version: assignment.version,
            repository_id: repositoryID,
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
        description: error instanceof Error ? error.message : "Refresh the page and try again.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function openWarning(environment: ConfigSyncEnvironmentStatus) {
    setBusy(`warning:${environment.environment_id}`);
    try {
      setWarning({ environment, facts: await getConfigWarning(environment.environment_id) });
      setAccepted(false);
    } catch (error) {
      toast.error("Consent details are unavailable.", {
        description: error instanceof Error ? error.message : "Refresh the page and try again.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function acceptWarning() {
    if (!warning || !accepted) return;
    await mutate(
      `consent:${warning.environment.environment_id}`,
      () => acceptConfigConsent(
        warning.environment.environment_id,
        warning.facts.revision,
        warning.environment.assignment_version ?? 0,
      ),
      `Configuration sync enabled on ${warning.facts.machine_name}.`,
    );
    setWarning(undefined);
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

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Configuration"
        description="Connect private repositories, choose where each one applies, and review encrypted synchronization health."
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
                          onChange={(event) => void assign(environment, event.target.value)}
                        >
                          <NativeSelectOption value="">{repositories.length ? "Unassigned" : "Connect a repository first"}</NativeSelectOption>
                          {repositories.filter((repository) => repository.state === "active").map((repository) => (
                            <NativeSelectOption key={repository.id} value={repository.id}>{repository.display_name}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={badge.status} label={badge.label} />
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
                                () => removeConfigConsent(environment.environment_id, environment.assignment_version ?? 0),
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
                                () => unassignConfigRepository(environment.environment_id, environment.assignment_version ?? 0),
                                `Configuration unassigned from ${environment.display_name}.`,
                              )}
                            >
                              Unassign
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
        <ClassificationPanel items={classifierPending} />
        <IssueList title="Skipped paths" description="Oversized or unsafe paths stayed local." items={skipped} empty="No paths are being skipped." icon={InformationCircleIcon} />
        <ConflictPanel items={conflicts} busy={Boolean(busy)} onResolve={resolveConflict} />
        <SecurityPanel data={data} />
      </div>

      <ConsentDialog
        value={warning}
        accepted={accepted}
        busy={Boolean(busy)}
        onAcceptedChange={setAccepted}
        onClose={() => setWarning(undefined)}
        onConfirm={() => void acceptWarning()}
      />

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
                ).then(() => setDisconnecting(undefined));
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
              <AlertTitle>Files may change automatically</AlertTitle>
              <AlertDescription>{facts.file_categories.join(", ")} may be pulled, changed, and pushed while the helper is authorized.</AlertDescription>
            </Alert>
            <ul className="space-y-2 text-muted-foreground">
              <li>{facts.conflict_behavior}</li>
              <li>{facts.offline_behavior}</li>
              <li>{facts.classifier_metadata_disclosure}</li>
              <li>{facts.recovery_consequence}</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <input
                className="mt-0.5 size-4 accent-primary"
                type="checkbox"
                checked={accepted}
                onChange={(event) => onAcceptedChange(event.target.checked)}
              />
              <span>I understand that encrypted configuration will automatically pull from and push to this repository, and may change files in the named scope.</span>
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

function ClassificationPanel({ items }: { items: Array<ConfigSyncPathSummary & { environment: string }> }) {
  const overrides = useConfigSyncOverrides();
  const [busy, setBusy] = React.useState<string>();
  const overrideMap = new Map((overrides.data ?? []).map((item) => [item.path, item.decision]));
  const paths = Array.from(new Set([...items.map((item) => item.path), ...overrideMap.keys()])).sort();
  async function change(path: string, value: string) {
    setBusy(path);
    try {
      if (value) await putConfigSyncOverride(path, value as ConfigClassificationDecision);
      else await deleteConfigSyncOverride(path);
      overrides.refresh();
      toast.success(value ? "Classification override saved." : "Classification override removed.");
    } catch (error) {
      toast.error("Classification could not be updated.", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <Card>
      <CardHeader className="border-b p-5 pb-4">
        <CardTitle>Awaiting classification</CardTitle>
        <CardDescription>Unknown paths remain local until policy, an override, or the classifier makes a safe decision.</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {paths.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><HugeiconsIcon icon={InformationCircleIcon} className="size-4" />No paths await classification.</p>
        ) : (
          <ul className="space-y-3">
            {paths.map((pathValue) => {
              const pending = items.find((item) => item.path === pathValue);
              return (
                <li key={pathValue} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-mono" title={pathValue}>{pathValue}</p>
                    <p className="text-muted-foreground">{pending ? `${pending.environment} · ${pending.reason.replaceAll("_", " ")}` : "Account override"}</p>
                  </div>
                  <NativeSelect
                    size="sm"
                    aria-label={`Classification for ${pathValue}`}
                    value={overrideMap.get(pathValue) ?? ""}
                    disabled={busy === pathValue}
                    onChange={(event) => void change(pathValue, event.target.value)}
                  >
                    <NativeSelectOption value="">Automatic</NativeSelectOption>
                    <NativeSelectOption value="portable">Portable</NativeSelectOption>
                    <NativeSelectOption value="project_only">Environment only</NativeSelectOption>
                    <NativeSelectOption value="exclude">Exclude</NativeSelectOption>
                  </NativeSelect>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityPanel({ data }: { data: ConfigSyncStatus }) {
  const [recovery, setRecovery] = React.useState<ConfigRecoveryKey>();
  const keyVersion = Math.max(0, ...data.environments.map((item) => item.key_version ?? 0));
  React.useEffect(() => {
    const purpose = new URLSearchParams(window.location.search).get("reauthenticated");
    if (!purpose) return;
    window.history.replaceState({}, "", window.location.pathname);
    const operation = purpose === "config_recovery_export"
      ? exportConfigRecoveryKey().then(setRecovery)
      : rotateConfigRecoveryKey().then((result) => toast.success(`Key rotation ${result.state.replaceAll("_", " ")}.`));
    operation.catch((error) => toast.error("Security operation failed.", { description: error instanceof Error ? error.message : "Please try again." }));
  }, []);
  function download() {
    if (!recovery) return;
    const blob = new Blob([recovery.identity + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `paperboat-recovery-key-v${recovery.key_version}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card>
      <CardHeader className="border-b p-5 pb-4">
        <CardTitle>Encryption and recovery</CardTitle>
        <CardDescription>Plaintext stays on assigned environments. Git receives age-encrypted chezmoi data.</CardDescription>
        <CardAction><HugeiconsIcon icon={Key01Icon} className="size-5 text-muted-foreground" /></CardAction>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-4">
        <div className="grid grid-cols-2 gap-3"><Metric label="Key version" value={keyVersion ? String(keyVersion) : "Not reported"} mono /><Metric label="Policy revision" value={data.policy.revision} mono /></div>
        <Alert><HugeiconsIcon icon={Key01Icon} /><AlertTitle>Store recovery identities offline</AlertTitle><AlertDescription>Anyone with an identity and repository access can decrypt portable configuration.</AlertDescription></Alert>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<a href="/auth/reauth?purpose=config_recovery_export" />}><HugeiconsIcon icon={Download04Icon} />Export recovery key</Button>
          <Button variant="outline" nativeButton={false} render={<a href="/auth/reauth?purpose=config_key_rotation" />}>Rotate key</Button>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Mandatory exclusions ({data.policy.mandatory_exclusions.length})</summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-muted-foreground">{data.policy.mandatory_exclusions.map((pattern) => <li key={pattern}>{pattern}</li>)}</ul>
        </details>
      </CardContent>
      <Dialog open={Boolean(recovery)} onOpenChange={(open) => { if (!open) setRecovery(undefined); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recovery identity</DialogTitle><DialogDescription>Store this in an encrypted offline location. Reauthentication is required to view it again.</DialogDescription></DialogHeader>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all">{recovery?.identity}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (recovery) void navigator.clipboard.writeText(recovery.identity); }}><HugeiconsIcon icon={Copy01Icon} />Copy</Button>
            <Button onClick={download}><HugeiconsIcon icon={Download04Icon} />Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
}: {
  items: Array<ConfigSyncPathSummary & { environment: ConfigSyncEnvironmentStatus }>;
  busy: boolean;
  onResolve: (
    environment: ConfigSyncEnvironmentStatus,
    conflict: ConfigSyncPathSummary,
    action: ConfigConflictResolutionAction,
  ) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader className="border-b p-5 pb-4">
        <CardTitle>Conflicts</CardTitle>
        <CardDescription>Both encrypted versions remain preserved until an explicit current-revision choice lands.</CardDescription>
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
                  <Button size="sm" variant="ghost" disabled={busy || !item.revision} onClick={() => void onResolve(item.environment, item, "externally_resolved")}>Use external edit</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function flattenSummaries(environments: ConfigSyncEnvironmentStatus[], key: "skipped" | "conflicts" | "classifier_pending") {
  return environments.flatMap((environment) => environment[key].map((item) => ({ ...item, environment: environment.display_name })));
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className={mono ? "truncate font-mono text-sm font-medium" : "text-sm font-medium"}>{value}</p></div>;
}

export function ConfigurationError({ message }: { message: string }) {
  return <><PageHeader eyebrow="Workspace" title="Configuration" description="Encrypted configuration synchronization by environment." /><Alert variant="error"><HugeiconsIcon icon={Alert02Icon} /><AlertTitle>Configuration status is unavailable</AlertTitle><AlertDescription>{message}</AlertDescription></Alert></>;
}

export function ConfigurationLoading() {
  return <div aria-busy="true" aria-label="Loading configuration synchronization status"><PageHeader eyebrow="Workspace" title="Configuration" description="Encrypted configuration synchronization by environment." /><div className="mt-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div><Skeleton className="mt-6 h-72" /></div>;
}

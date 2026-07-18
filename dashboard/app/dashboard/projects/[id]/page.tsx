"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  GitBranchIcon,
  CloudServerIcon,
  Database01Icon,
  GitCommitIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { projectStatus } from "@/components/dashboard/project-state";
import { ConfigSyncIndicator } from "@/components/dashboard/config-sync-indicator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useProject, useProjectEvents } from "@/lib/api/use-projects";
import { ProjectSettingsForm } from "@/components/dashboard/project-settings-form";
import { ProjectLifecycleActions } from "@/components/dashboard/project-lifecycle-actions";

const LIVE_STATES = new Set([
  "creating",
  "provisioning_storage",
  "provisioning_machine",
  "starting",
  "running",
  "stopping",
  "restarting",
  "deleting",
]);

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { project, loading, error } = useProject(id);
  const events = useProjectEvents(id);
  const recentEvents = React.useMemo(
    () =>
      [...events.events].sort(
        (left, right) =>
          right.created_at.localeCompare(left.created_at) ||
          right.id.localeCompare(left.id),
      ),
    [events.events],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }
  if (error || !project) {
    return (
      <Empty className="min-h-[20rem] border">
        <EmptyHeader>
          <EmptyTitle className="font-heading">Project not found</EmptyTitle>
          <EmptyDescription>
            {error?.message ?? "This project is unavailable."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const p = project;
  const cfg = p.current_config;
  const presetCodes = cfg.preset_codes ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={p.name}
        description={p.repository.source_url}
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/projects" />}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
              Back
            </Button>
            <ProjectLifecycleActions project={p} />
          </>
        }
      />

      <div className="flex items-center gap-3">
        <StatusBadge status={projectStatus(p.state)} />
        <ConfigSyncIndicator projectId={p.id} />
        {LIVE_STATES.has(p.state) ? (
          <span className="text-xs text-muted-foreground">Live updates on</span>
        ) : null}
        {p.restart_required ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Restart required to apply pending changes
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          icon={CloudServerIcon}
          label="Machine"
          value={cfg.machine_type_code || "—"}
          sub={cfg.region_code}
        />
        <InfoCard
          icon={Database01Icon}
          label="Storage"
          value={`${cfg.storage_gb} GB`}
          sub={`Idle timeout: ${cfg.idle_timeout_code || "—"}`}
        />
        <InfoCard
          icon={GitBranchIcon}
          label="Branch"
          value={p.repository.default_branch || "—"}
          sub={presetCodes.join(", ") || "No presets"}
        />
      </div>

      <ProjectSettingsForm key={p.desired_config.config_hash} project={p} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Activity
          </CardTitle>
          <CardDescription>Recent lifecycle events for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.loading && events.events.length === 0 ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : events.events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No events yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {recentEvents.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={GitCommitIcon} className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{e.message || e.type}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: typeof CloudServerIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-5">
        <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <HugeiconsIcon icon={icon} className="size-3.5" />
          {label}
        </span>
        <span className="truncate font-heading text-lg font-semibold">{value}</span>
        {sub ? (
          <span className="truncate text-xs text-muted-foreground">{sub}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

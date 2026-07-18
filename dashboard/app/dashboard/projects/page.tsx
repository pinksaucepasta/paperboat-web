"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Folder01Icon,
  GitBranchIcon,
  CloudServerIcon,
  PlayIcon,
  StopIcon,
  RefreshIcon,
  Delete02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { projectStatus } from "@/components/dashboard/project-state";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ApiError } from "@/lib/api/client";
import { useProjectActions, useProjectBusy, useProjects } from "@/lib/api/use-projects";
import type { Project } from "@/lib/api/types";

const RUNNING_STATES = new Set(["running", "ready", "starting", "restarting"]);

export default function ProjectsPage() {
  const { projects, error, loading } = useProjects();
  const actions = useProjectActions();

  async function run(
    id: string,
    label: string,
    fn: (id: string) => Promise<Project | void>,
  ) {
    try {
      await fn(id);
      toast.success(`Project ${label}.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error(`Could not ${label} project.`, { description: message });
    }
  }

  async function deleteProject(id: string) {
    try {
      await actions.deleteProject(id);
      toast.success("Project scheduled for deletion.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Could not delete project.", { description: message });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Each project is one cloud machine and volume, cloned from your repo and reachable from anywhere through agentunnel."
        actions={
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/dashboard/projects/new" />}
          >
            <HugeiconsIcon icon={PlusSignIcon} />
            New project
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : error ? (
        <ProjectsError error={error} />
      ) : projects.length === 0 ? (
        <Empty className="min-h-[20rem] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Folder01Icon} />
            </EmptyMedia>
            <EmptyTitle className="font-heading">No projects yet</EmptyTitle>
            <EmptyDescription>
              Create your first project to run your coding agents in the cloud.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/dashboard/projects/new" />}>
              <HugeiconsIcon icon={PlusSignIcon} />
              New project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onStart={(id) => run(id, "started", actions.startProject)}
              onStop={(id) => run(id, "stopped", actions.stopProject)}
              onRestart={(id) => run(id, "restarted", actions.restartProject)}
              onDelete={deleteProject}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ProjectCard({
  project: p,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: {
  project: Project;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const running = RUNNING_STATES.has(p.state);
  const busy = useProjectBusy(p.id);
  const deleting = p.state === "deleting";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <HugeiconsIcon icon={Folder01Icon} className="size-4" />
          </span>
          {p.name}
        </CardTitle>
        <StatusBadge
          status={projectStatus(p.state)}
          label={deleting ? "deleting" : undefined}
        />
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {deleting ? (
          <CardDescription>
            Scheduled for deletion. Storage will be available after cleanup
            finishes.
          </CardDescription>
        ) : null}
        <CardDescription className="flex items-center gap-1.5 truncate font-mono text-xs">
          <HugeiconsIcon icon={GitBranchIcon} className="size-3.5 shrink-0" />
          {p.repository.source_url}
        </CardDescription>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon icon={CloudServerIcon} className="size-3.5" />
              Machine
            </p>
            <p className="truncate font-medium">
              {p.current_config.machine_type_code || "—"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Region</p>
            <p className="truncate font-medium">
              {p.current_config.region_code || "—"}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" disabled={busy || deleting}>
                {busy ? <Spinner className="size-3.5" /> : null}
                Actions
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            {running ? (
              <DropdownMenuItem onClick={() => onStop(p.id)}>
                <HugeiconsIcon icon={StopIcon} />
                Stop
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onStart(p.id)}>
                <HugeiconsIcon icon={PlayIcon} />
                Start
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRestart(p.id)}>
              <HugeiconsIcon icon={RefreshIcon} />
              Restart
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(p.id)}>
              <HugeiconsIcon icon={Delete02Icon} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          disabled={deleting}
          nativeButton={false}
          render={<Link href={`/dashboard/projects/${p.id}`} />}
        >
          Open
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProjectsError({ error }: { error: ApiError }) {
  // The server gates projects on an active plan and a linked GitHub account.
  if (error.code === "payment_required") {
    return (
      <Empty className="min-h-[20rem] border">
        <EmptyHeader>
          <EmptyTitle className="font-heading">A plan is required</EmptyTitle>
          <EmptyDescription>
            Choose a plan to start creating projects and running agents in the cloud.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/dashboard/billing" />}>
            View plans
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (error.code === "github_required" || error.code === "github_scope_denied") {
    return (
      <Empty className="min-h-[20rem] border">
        <EmptyHeader>
          <EmptyTitle className="font-heading">Connect GitHub</EmptyTitle>
          <EmptyDescription>
            Link your GitHub account so Paperboat can clone your repos and provision
            your config repository.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link href="/dashboard/settings" />}>
            Connect GitHub
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <Empty className="min-h-[20rem] border">
      <EmptyHeader>
        <EmptyTitle className="font-heading">Couldn&apos;t load projects</EmptyTitle>
        <EmptyDescription>{error.message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

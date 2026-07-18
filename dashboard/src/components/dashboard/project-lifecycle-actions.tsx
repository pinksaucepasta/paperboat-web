"use client";

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon, RefreshIcon, StopIcon } from "@hugeicons/core-free-icons";

import { ApiError } from "@/lib/api/client";
import { useProjectActions, useProjectBusy } from "@/lib/api/use-projects";
import type { Project } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const RUNNING_STATES = new Set(["running", "ready", "starting", "restarting"]);
const BLOCKED_STATES = new Set([
  "creating",
  "provisioning_storage",
  "provisioning_machine",
  "deleting",
  "deleted",
  "failed",
  "suspended",
]);

export function ProjectLifecycleActions({ project }: { project: Project }) {
  const actions = useProjectActions();
  const busy = useProjectBusy(project.id);
  const running = RUNNING_STATES.has(project.state);
  const blocked = BLOCKED_STATES.has(project.state);

  async function run(label: string, action: () => Promise<Project>) {
    try {
      await action();
      toast.success(`${label} queued.`);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Something went wrong.";
      toast.error(`Could not ${label.toLowerCase()} project.`, { description: message });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {running ? (
        <Button variant="outline" disabled={busy || blocked} onClick={() => void run("Stop", () => actions.stopProject(project.id))}>
          {busy ? <Spinner className="size-4" /> : <HugeiconsIcon icon={StopIcon} />}
          Stop
        </Button>
      ) : (
        <Button variant="outline" disabled={busy || blocked} onClick={() => void run("Start", () => actions.startProject(project.id))}>
          {busy ? <Spinner className="size-4" /> : <HugeiconsIcon icon={PlayIcon} />}
          Start
        </Button>
      )}
      <Button disabled={busy || blocked} onClick={() => void run("Restart", () => actions.restartProject(project.id))}>
        <HugeiconsIcon icon={RefreshIcon} />
        Restart
      </Button>
    </div>
  );
}

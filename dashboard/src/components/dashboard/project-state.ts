import type { Status } from "@/components/dashboard/status-badge";
import type { ProjectState } from "@/lib/api/types";

/** Map a server project state onto the dashboard's StatusBadge vocabulary. */
export function projectStatus(state: ProjectState): Status {
  switch (state) {
    case "running":
      return "running";
    case "ready":
      return "active";
    case "creating":
    case "provisioning_storage":
    case "provisioning_machine":
    case "starting":
    case "restarting":
      return "deploying";
    case "stopping":
    case "stopped":
    case "deleting":
    case "deleted":
      return "stopped";
    case "suspended":
      return "paused";
    case "failed":
      return "failed";
    default:
      return "stopped";
  }
}

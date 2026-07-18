"use client";

import * as React from "react";
import { create } from "zustand";

import { ApiError } from "./client";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectEvents,
  listProjects,
  restartProject,
  startProject,
  stopProject,
  updateProject,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "./projects";
import type { Project, ProjectEvent, ProjectState } from "./types";

const LIVE_STATES = new Set<ProjectState>([
  "creating",
  "provisioning_storage",
  "provisioning_machine",
  "starting",
  "running",
  "stopping",
  "restarting",
  "deleting",
]);

const POLL_MS = 2500;
const EMPTY_EVENTS: ProjectEvent[] = [];
let listRequest: Promise<void> | undefined;

interface ProjectsState {
  byId: Record<string, Project>;
  order: string[];
  listLoading: boolean;
  listLoaded: boolean;
  listError?: ApiError;
  detailLoading: Record<string, boolean>;
  detailError: Record<string, ApiError | undefined>;
  eventsByProjectId: Record<string, ProjectEvent[]>;
  eventsLoading: Record<string, boolean>;
  eventsError: Record<string, ApiError | undefined>;
  busy: Record<string, boolean>;
  upsertProjects: (projects: Project[]) => void;
  removeProject: (id: string) => void;
  setProjectState: (id: string, state: ProjectState) => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  byId: {},
  order: [],
  listLoading: false,
  listLoaded: false,
  detailLoading: {},
  detailError: {},
  eventsByProjectId: {},
  eventsLoading: {},
  eventsError: {},
  busy: {},
  upsertProjects: (projects) =>
    set((state) => {
      const byId = { ...state.byId };
      const order = [...state.order];
      for (const project of projects) {
        byId[project.id] = project;
        if (!order.includes(project.id)) {
          order.unshift(project.id);
        }
      }
      order.sort((a, b) => {
        const left = byId[a]?.created_at ?? "";
        const right = byId[b]?.created_at ?? "";
        return right.localeCompare(left);
      });
      return { byId, order };
    }),
  removeProject: (id) =>
    set((state) => {
      const byId = { ...state.byId };
      delete byId[id];
      return { byId, order: state.order.filter((item) => item !== id) };
    }),
  setProjectState: (id, projectState) =>
    set((state) => {
      const project = state.byId[id];
      if (!project) return {};
      return {
        byId: {
          ...state.byId,
          [id]: {
            ...project,
            state: projectState,
            updated_at: new Date().toISOString(),
          },
        },
      };
    }),
}));

function normalizeError(err: unknown, fallback: string): ApiError {
  return err instanceof ApiError
    ? err
    : new ApiError("internal_error", fallback, 0);
}

export function useProjects() {
  const order = useProjectsStore((state) => state.order);
  const byId = useProjectsStore((state) => state.byId);
  const loading = useProjectsStore((state) => state.listLoading);
  const loaded = useProjectsStore((state) => state.listLoaded);
  const error = useProjectsStore((state) => state.listError);
  const projects = React.useMemo(
    () => order.map((id) => byId[id]).filter(Boolean),
    [byId, order],
  );

  const refresh = React.useCallback(async () => {
    if (listRequest) {
      await listRequest;
      return;
    }
    useProjectsStore.setState({ listLoading: true, listError: undefined });
    listRequest = (async () => {
      try {
        const next = await listProjects();
        useProjectsStore.setState((state) => {
          const byId = { ...state.byId };
          for (const project of next) {
            byId[project.id] = project;
          }
          return {
            byId,
            order: next.map((project) => project.id),
            listLoaded: true,
            listLoading: false,
          };
        });
      } catch (err) {
        useProjectsStore.setState({
          listLoading: false,
          listError: normalizeError(err, "Could not load projects."),
        });
      } finally {
        listRequest = undefined;
      }
    })();
    await listRequest;
  }, []);

  React.useEffect(() => {
    const state = useProjectsStore.getState();
    if (!state.listLoaded && !state.listLoading) {
      void refresh();
    }
  }, [refresh]);

  const projectIds = React.useMemo(
    () => projects.map((project) => project.id),
    [projects],
  );
  useLiveProjectPolling(projectIds);

  return { projects, loading: loading && !loaded, error, refresh };
}

export function useProject(id: string) {
  const project = useProjectsStore((state) => state.byId[id]);
  const loading = useProjectsStore((state) => state.detailLoading[id] ?? false);
  const error = useProjectsStore((state) => state.detailError[id]);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    useProjectsStore.setState((state) => ({
      detailLoading: { ...state.detailLoading, [id]: true },
      detailError: { ...state.detailError, [id]: undefined },
    }));
    try {
      const next = await getProject(id);
      useProjectsStore.getState().upsertProjects([next]);
      useProjectsStore.setState((state) => ({
        detailLoading: { ...state.detailLoading, [id]: false },
      }));
    } catch (err) {
      useProjectsStore.setState((state) => ({
        detailLoading: { ...state.detailLoading, [id]: false },
        detailError: {
          ...state.detailError,
          [id]: normalizeError(err, "Could not load project."),
        },
      }));
    }
  }, [id]);

  React.useEffect(() => {
    if (id && !project && !loading) {
      void refresh();
    }
  }, [id, loading, project, refresh]);

  useLiveProjectPolling(id ? [id] : []);

  return { project, loading: loading && !project, error, refresh };
}

export function useProjectEvents(id: string) {
  const events = useProjectsStore(
    (state) => state.eventsByProjectId[id] ?? EMPTY_EVENTS,
  );
  const loading = useProjectsStore((state) => state.eventsLoading[id] ?? false);
  const error = useProjectsStore((state) => state.eventsError[id]);
  const projectState = useProjectsStore((state) => state.byId[id]?.state);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    useProjectsStore.setState((state) => ({
      eventsLoading: { ...state.eventsLoading, [id]: true },
      eventsError: { ...state.eventsError, [id]: undefined },
    }));
    try {
      const next = await getProjectEvents(id);
      useProjectsStore.setState((state) => ({
        eventsByProjectId: { ...state.eventsByProjectId, [id]: next },
        eventsLoading: { ...state.eventsLoading, [id]: false },
      }));
    } catch (err) {
      useProjectsStore.setState((state) => ({
        eventsLoading: { ...state.eventsLoading, [id]: false },
        eventsError: {
          ...state.eventsError,
          [id]: normalizeError(err, "Could not load project events."),
        },
      }));
    }
  }, [id]);

  React.useEffect(() => {
    if (id && events.length === 0 && !loading && !error) {
      void refresh();
    }
  }, [error, events.length, id, loading, refresh]);

  React.useEffect(() => {
    if (!id || !projectState || !LIVE_STATES.has(projectState)) return;
    const interval = setInterval(() => void refresh(), POLL_MS * 2);
    return () => clearInterval(interval);
  }, [id, projectState, refresh]);

  return { events, loading, error, refresh };
}

export function useProjectActions() {
  const setBusy = React.useCallback((id: string, busy: boolean) => {
    useProjectsStore.setState((state) => ({
      busy: { ...state.busy, [id]: busy },
    }));
  }, []);

  const create = React.useCallback(async (input: CreateProjectInput) => {
    const project = await createProject(input);
    useProjectsStore.getState().upsertProjects([project]);
    return project;
  }, []);

  const update = React.useCallback(
    async (id: string, input: UpdateProjectInput) => {
      setBusy(id, true);
      try {
        const project = await updateProject(id, input);
        useProjectsStore.getState().upsertProjects([project]);
        return project;
      } finally {
        setBusy(id, false);
      }
    },
    [setBusy],
  );

  const runLifecycle = React.useCallback(
    async (
      id: string,
      optimisticState: ProjectState,
      fn: (id: string) => Promise<Project>,
    ) => {
      const previous = useProjectsStore.getState().byId[id];
      setBusy(id, true);
      useProjectsStore.getState().setProjectState(id, optimisticState);
      try {
        const project = await fn(id);
        useProjectsStore.getState().upsertProjects([project]);
        return project;
      } catch (err) {
        if (previous) {
          useProjectsStore.getState().upsertProjects([previous]);
        }
        throw err;
      } finally {
        setBusy(id, false);
      }
    },
    [setBusy],
  );

  const remove = React.useCallback(
    async (id: string) => {
      const previous = useProjectsStore.getState().byId[id];
      setBusy(id, true);
      useProjectsStore.getState().setProjectState(id, "deleting");
      try {
        const project = await deleteProject(id);
        if (project.state === "deleted") {
          useProjectsStore.getState().removeProject(id);
        } else {
          useProjectsStore.getState().upsertProjects([project]);
        }
        return project;
      } catch (err) {
        if (previous) {
          useProjectsStore.getState().upsertProjects([previous]);
        }
        throw err;
      } finally {
        setBusy(id, false);
      }
    },
    [setBusy],
  );

  return {
    createProject: create,
    updateProject: update,
    startProject: (id: string) => runLifecycle(id, "starting", startProject),
    stopProject: (id: string) => runLifecycle(id, "stopping", stopProject),
    restartProject: (id: string) => runLifecycle(id, "restarting", restartProject),
    deleteProject: remove,
  };
}

export function useProjectBusy(id: string) {
  return useProjectsStore((state) => state.busy[id] ?? false);
}

function useLiveProjectPolling(ids: string[]) {
  const key = React.useMemo(() => ids.slice().sort().join(","), [ids]);

  React.useEffect(() => {
    const projectIds = key ? key.split(",") : [];
    if (projectIds.length === 0) return;

    let cancelled = false;
    const interval = setInterval(() => void tick(), POLL_MS);

    async function tick() {
      const state = useProjectsStore.getState();
      const liveIds = projectIds.filter((id) => {
        const project = state.byId[id];
        return project && LIVE_STATES.has(project.state);
      });
      if (liveIds.length === 0) return;
      await Promise.all(
        liveIds.map(async (id) => {
          try {
            const project = await getProject(id);
            if (!cancelled) {
              if (project.state === "deleted") {
                useProjectsStore.getState().removeProject(id);
              } else {
                useProjectsStore.getState().upsertProjects([project]);
              }
            }
          } catch (err) {
            if (
              !cancelled &&
              err instanceof ApiError &&
              (err.code === "project_not_found" || err.code === "project_deleted")
            ) {
              useProjectsStore.getState().removeProject(id);
            }
            // Keep the last known status visible; explicit refresh/detail loads
            // surface errors where the user can act on them.
          }
        }),
      );
    }

    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [key]);
}

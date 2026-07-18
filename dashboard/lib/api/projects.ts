import { pbFetch } from "./client";
import type { Project, ProjectEvent, ProjectListResponse } from "./types";

export interface CreateProjectInput {
  name: string;
  repository_url: string;
  default_branch?: string;
  storage_gb: number;
  machine_type_code: string;
  region_code: string;
  preset_codes?: string[];
  idle_timeout_code: string;
  setup_script?: string;
}

export interface UpdateProjectInput {
  version: number;
  storage_gb?: number;
  machine_type_code?: string;
  region_code?: string;
  preset_codes?: string[];
  idle_timeout_code?: string;
  setup_script?: string;
}

export async function listProjects(): Promise<Project[]> {
  const response = await pbFetch<ProjectListResponse>("/api/projects");
  return response.items;
}

export function getProject(id: string): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return pbFetch<Project>("/api/projects", { method: "POST", body: input });
}

export function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function startProject(id: string): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}/start`, { method: "POST" });
}

export function stopProject(id: string): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}/stop`, { method: "POST" });
}

export function restartProject(id: string): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}/restart`, { method: "POST" });
}

export function deleteProject(id: string): Promise<Project> {
  return pbFetch<Project>(`/api/projects/${id}`, { method: "DELETE" });
}

export function getProjectEvents(id: string): Promise<ProjectEvent[]> {
  return pbFetch<ProjectEvent[]>(`/api/projects/${id}/events`);
}

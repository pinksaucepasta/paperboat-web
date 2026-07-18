import { pbFetch } from "./client";
import type { GitHubRepository, GitHubStatus } from "./types";

export function getGitHubStatus(): Promise<GitHubStatus> {
  return pbFetch<GitHubStatus>("/api/github/status");
}

/** List the repositories the connected GitHub account can access. */
export function listGitHubRepositories(): Promise<GitHubRepository[]> {
  return pbFetch<GitHubRepository[]>("/api/github/repositories");
}

interface OAuthStart {
  state: string;
  authorization_url: string;
}

/** Begin GitHub OAuth; returns the GitHub authorization URL to redirect to. */
export function startGitHubOAuth(redirectUri: string): Promise<OAuthStart> {
  return pbFetch<OAuthStart>("/api/github/oauth/start", {
    method: "POST",
    body: { redirect_uri: redirectUri },
  });
}

/** Provision the user's private config repo (idempotent). */
export function provisionConfigRepo(): Promise<GitHubStatus> {
  return pbFetch<GitHubStatus>("/api/github/config-repo/provision", {
    method: "POST",
  });
}

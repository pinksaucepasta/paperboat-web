import { pbFetch } from "./client";
import type { GitHubRepository, GitHubStatus } from "./types";

export function getGitHubStatus(): Promise<GitHubStatus> {
  return pbFetch<GitHubStatus>("/v1/github/status");
}

/** List the repositories the connected GitHub account can access. */
export function listGitHubRepositories(): Promise<GitHubRepository[]> {
  return pbFetch<GitHubRepository[]>("/v1/github/repositories");
}

interface OAuthStart {
  state: string;
  authorization_url: string;
}

/** Begin GitHub OAuth; returns the GitHub authorization URL to redirect to. */
export function startGitHubOAuth(redirectUri: string): Promise<OAuthStart> {
  return pbFetch<OAuthStart>("/v1/github/oauth/start", {
    method: "POST",
    body: { redirect_uri: redirectUri },
  });
}

/** Provision the user's private config repo (idempotent). */
export function provisionConfigRepo(): Promise<GitHubStatus> {
  return pbFetch<GitHubStatus>("/v1/github/config-repositories/provision", {
    method: "POST",
  });
}

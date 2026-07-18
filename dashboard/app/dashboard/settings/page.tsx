"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GithubIcon,
  CheckmarkCircle02Icon,
  GitBranchIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { AuthorizedClientsCard } from "@/components/dashboard/authorized-clients-card";
import { useApi } from "@/lib/api/use-api";
import { ApiError } from "@/lib/api/client";
import { getMe } from "@/lib/api/me";
import {
  getGitHubStatus,
  startGitHubOAuth,
  provisionConfigRepo,
} from "@/lib/api/github";
import type { GitHubStatus, Me } from "@/lib/api/types";

export default function SettingsPage() {
  const me = useApi<Me>(getMe);
  const github = useApi<GitHubStatus>(getGitHubStatus);
  const searchParams = useSearchParams();

  // Surface the outcome relayed by /github/callback.
  React.useEffect(() => {
    const result = searchParams.get("github");
    if (result === "connected") toast.success("GitHub connected.");
    if (result === "error") toast.error("GitHub connection failed.");
  }, [searchParams]);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile and connected accounts."
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-semibold">Profile</CardTitle>
            <CardDescription>
              Managed through your Paperboat identity provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={me.data?.display_name ?? ""} readOnly disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={me.data?.email ?? ""} readOnly disabled />
            </div>
          </CardContent>
        </Card>

        <GitHubCard status={github} />
        <AuthorizedClientsCard />
      </div>
    </>
  );
}

function GitHubCard({
  status,
}: {
  status: ReturnType<typeof useApi<GitHubStatus>>;
}) {
  const [connecting, setConnecting] = React.useState(false);
  const [provisioning, setProvisioning] = React.useState(false);
  const data = status.data;
  const missingScopes = data?.missing_scopes ?? [];

  async function connect() {
    setConnecting(true);
    try {
      const { authorization_url } = await startGitHubOAuth(
        window.location.origin + "/github/callback",
      );
      window.location.href = authorization_url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Couldn't start GitHub connection.", { description: message });
      setConnecting(false);
    }
  }

  async function provision() {
    setProvisioning(true);
    try {
      await provisionConfigRepo();
      toast.success("Config repository provisioned.");
      status.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      toast.error("Couldn't provision config repo.", { description: message });
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
            <HugeiconsIcon icon={GithubIcon} className="size-4" />
            GitHub
          </CardTitle>
          <CardDescription>
            Connect GitHub so Paperboat can clone your repos and manage your private
            config repository.
          </CardDescription>
        </div>
        {data?.connected ? (
          <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
            Connected
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {status.loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : !data?.connected ? (
          <Button onClick={connect} disabled={connecting}>
            {connecting ? <Spinner className="size-4" /> : (
              <HugeiconsIcon icon={GithubIcon} />
            )}
            Connect GitHub
          </Button>
        ) : (
          <div className="space-y-4">
            {data.config_repo_provisioned ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={GitBranchIcon} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {data.config_repo_owner}/{data.config_repo_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Config repo · {data.config_repo_branch}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border p-3">
                <p className="text-sm text-muted-foreground">
                  Your private config repository isn&apos;t provisioned yet.
                </p>
                <Button size="sm" onClick={provision} disabled={provisioning}>
                  {provisioning ? <Spinner className="size-4" /> : null}
                  Provision
                </Button>
              </div>
            )}
            {missingScopes.length > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Missing scopes: {missingScopes.join(", ")}. Reconnect to grant them.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Repositories not loading? Reconnect to refresh your GitHub
                authorization.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={connect}
                disabled={connecting}
              >
                {connecting ? (
                  <Spinner className="size-4" />
                ) : (
                  <HugeiconsIcon icon={GithubIcon} />
                )}
                Reconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

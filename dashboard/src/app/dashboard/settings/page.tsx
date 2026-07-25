"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GithubIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { CLIClientSessionsCard } from "@/components/dashboard/cli-client-sessions-card";
import { useApi } from "@/lib/api/use-api";
import { ApiError } from "@/lib/api/client";
import { getMe } from "@/lib/api/me";
import {
  getGitHubStatus,
  startGitHubOAuth,
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
        <CLIClientSessionsCard />
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

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold">
            <HugeiconsIcon icon={GithubIcon} className="size-4" />
            GitHub
          </CardTitle>
          <CardDescription>
            Authorize your GitHub identity here. Configuration repositories are
            selected separately on the Configuration page.
          </CardDescription>
        </div>
        {data?.connected ? (
          <CardAction>
            <Badge
              variant="success"
              className="gap-1.5 text-emerald-600 dark:text-emerald-400"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
              Connected
            </Badge>
          </CardAction>
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
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">
                Connecting GitHub does not choose or enable a configuration repository.
              </p>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/configuration" />}>
                Choose repositories
              </Button>
            </div>
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

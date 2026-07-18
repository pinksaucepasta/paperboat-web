"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { getAuthorizedClients, revokeAuthorizedClient } from "@/lib/api/device-auth";
import { useApi } from "@/lib/api/use-api";
import type { AuthorizedClient } from "@/lib/api/types";

export function AuthorizedClientsCard() {
  const clients = useApi(getAuthorizedClients);
  const [additionalClients, setAdditionalClients] = React.useState<AuthorizedClient[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null | undefined>();
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [revokedIds, setRevokedIds] = React.useState<Set<string>>(() => new Set());
  const items = [...(clients.data?.items ?? []), ...additionalClients].map((client) =>
    revokedIds.has(client.client_session_id)
      ? { ...client, state: "revoked" as const }
      : client,
  );
  const remainingOffset = nextOffset === undefined
    ? clients.data?.pagination.next_offset
    : nextOffset;

  async function loadMore() {
    if (remainingOffset == null) return;
    setLoadingMore(true);
    try {
      const page = await getAuthorizedClients(remainingOffset);
      setAdditionalClients((current) => {
        const known = new Set(current.map((client) => client.client_session_id));
        for (const client of clients.data?.items ?? []) known.add(client.client_session_id);
        return [...current, ...page.items.filter((client) => !known.has(client.client_session_id))];
      });
      setNextOffset(page.pagination.next_offset);
    } catch (cause) {
      toast.error("Could not load more devices.", {
        description: cause instanceof ApiError ? cause.message : "Something went wrong.",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function markRevoked(clientSessionId: string) {
    setRevokedIds((current) => new Set(current).add(clientSessionId));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base font-semibold">Authorized devices</CardTitle>
        <CardDescription>Devices signed in to your Paperboat account through the CLI.</CardDescription>
      </CardHeader>
      <CardContent>
        {clients.loading ? <div className="flex flex-col gap-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
        {clients.error ? <p role="alert" className="text-sm text-destructive">Could not load authorized devices. {clients.error.message}</p> : null}
        {!clients.loading && !clients.error && items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><HugeiconsIcon icon={ComputerIcon} /></EmptyMedia>
              <EmptyTitle>No authorized devices</EmptyTitle>
              <EmptyDescription>Devices appear here after you approve a Paperboat CLI sign-in.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {items.length ? (
          <div className="flex flex-col">
            {items.map((client, index) => (
              <React.Fragment key={client.client_session_id}>
                {index > 0 ? <Separator /> : null}
                <AuthorizedClientRow client={client} onRevoked={markRevoked} />
              </React.Fragment>
            ))}
            {remainingOffset != null ? (
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Spinner data-icon="inline-start" /> : null}
                Load more devices
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuthorizedClientRow({ client, onRevoked }: { client: AuthorizedClient; onRevoked: (clientSessionId: string) => void }) {
  const [revoking, setRevoking] = React.useState(false);

  async function revoke() {
    setRevoking(true);
    try {
      await revokeAuthorizedClient(client.client_session_id);
      toast.success("Device revoked.");
      onRevoked(client.client_session_id);
    } catch (cause) {
      toast.error("Could not revoke device.", {
        description: cause instanceof ApiError ? cause.message : "Something went wrong.",
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><HugeiconsIcon icon={ComputerIcon} /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{client.client_label}</p>
            {client.current ? <Badge variant="secondary">This device</Badge> : null}
            {client.state === "revoked" ? <Badge variant="outline">Revoked</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">{client.os} · {client.device_type}</p>
          <p className="text-xs text-muted-foreground">Last used {client.last_used_at ? formatDistanceToNow(new Date(client.last_used_at), { addSuffix: true }) : "never"}</p>
        </div>
      </div>
      {client.state === "active" ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={revoking} />}>
            <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />Revoke
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke {client.client_label}?</AlertDialogTitle>
              <AlertDialogDescription>This device will be signed out of Paperboat and cannot refresh its session or start new connections. Already-issued short-lived project access remains available until it expires.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={revoke}>Revoke device</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

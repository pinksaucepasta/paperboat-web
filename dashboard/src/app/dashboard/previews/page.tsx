"use client";

import * as React from "react";
import { LinkSquare02Icon, RefreshIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listPreviews, revokePreview } from "@/lib/api/previews";
import type { Preview } from "@/lib/api/types";

export default function PreviewsPage() {
  const [items, setItems] = React.useState<Preview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try { setItems(await listPreviews()); }
    catch (value) { setError(value instanceof ApiError ? value.message : "Unable to load previews."); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function revoke(item: Preview) {
    setBusy(item.id);
    try { await revokePreview(item.id); toast.success("Preview revoked."); await refresh(); }
    catch (value) { toast.error(value instanceof ApiError ? value.message : "Unable to revoke preview."); }
    finally { setBusy(undefined); }
  }

  return <div className="space-y-6">
    <PageHeader title="Previews" description="Active public preview tunnels across your projects and machines." actions={<Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><HugeiconsIcon icon={RefreshIcon} />Refresh</Button>} />
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Card><CardContent className="p-0">
      {loading ? <div className="space-y-3 p-6">{[0, 1, 2].map((value) => <Skeleton key={value} className="h-14 w-full" />)}</div> : items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No active previews.</p> : <div className="divide-y">
        {items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="font-medium">{item.logical_name}</p><Badge variant="outline">{item.state}</Badge></div><p className="text-sm text-muted-foreground">{item.environment_name} · {item.environment_kind} · {item.owner_email}</p><p className="text-xs text-muted-foreground">Project {item.project_id ?? item.environment_id}{item.machine_id ? ` · Machine ${item.machine_id}` : ""} · User {item.user_id ?? item.owner_email}</p></div>
          <div className="flex items-center gap-2"><a className="inline-flex items-center gap-1 text-sm underline" href={item.url} target="_blank" rel="noreferrer">Open <HugeiconsIcon icon={LinkSquare02Icon} /></a><AlertDialog><AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={busy === item.id} />}><HugeiconsIcon icon={Delete02Icon} />Revoke</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke {item.logical_name}?</AlertDialogTitle><AlertDialogDescription>This immediately disables the public preview URL.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void revoke(item)}>Revoke preview</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
        </div>)}
      </div>}
    </CardContent></Card>
  </div>;
}

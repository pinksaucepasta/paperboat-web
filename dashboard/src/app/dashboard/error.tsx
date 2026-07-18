"use client";

import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Empty className="min-h-[24rem] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Alert02Icon} />
        </EmptyMedia>
        <EmptyTitle className="font-heading">This page could not be loaded</EmptyTitle>
        <EmptyDescription>
          Your projects are unchanged. Retry the request to continue.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={reset}>
          <HugeiconsIcon icon={RefreshIcon} />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

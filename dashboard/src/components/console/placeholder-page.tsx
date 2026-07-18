import Link from "next/link";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/console/page-shell";

/**
 * Routes that exist in the nav but aren't part of this sample's scope. An
 * honest empty state beats a fake screen.
 */
export function PlaceholderPage({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="mt-10 rounded-xl border border-dashed border-border bg-card">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon className="text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Not part of this sample</EmptyTitle>
            <EmptyDescription>
              This route is wired into the sidebar so navigation and active
              states are real, but the screen itself hasn&apos;t been built out.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" render={<Link href="/" />}>
              Back to overview
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </PageShell>
  );
}

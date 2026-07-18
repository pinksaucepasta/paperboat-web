"use client";

import { CreditCardIcon, Database01Icon, Folder01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useApi } from "@/lib/api/use-api";
import { getUsage } from "@/lib/api/billing";
import type { Usage } from "@/lib/api/types";
import { formatCredits } from "@/lib/format";
import { useProjects } from "@/lib/api/use-projects";

export default function UsagePage() {
  const { data, error, loading } = useApi<Usage>(getUsage);
  const projects = useProjects();

  const storagePct =
    data && data.included_storage_gb + data.purchased_storage_gb > 0
      ? Math.min(
          100,
          Math.round(
            (data.allocated_storage_gb /
              (data.included_storage_gb + data.purchased_storage_gb)) *
              100,
          ),
        )
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Observability"
        title="Usage"
        description="Your credit balance and storage allocation across the platform."
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : error || !data ? (
        <Empty className="min-h-[16rem] border">
          <EmptyHeader>
            <EmptyTitle className="font-heading">Couldn&apos;t load usage</EmptyTitle>
            <EmptyDescription>
              {error?.message ?? "Usage data is unavailable."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Credits"
              value={formatCredits(data.credits_balance)}
              icon={CreditCardIcon}
              trend="flat"
            />
            <StatCard
              label="Included storage"
              value={`${data.included_storage_gb} GB`}
              icon={Database01Icon}
              trend="flat"
            />
            <StatCard
              label="Purchased storage"
              value={`${data.purchased_storage_gb} GB`}
              icon={Database01Icon}
              trend="flat"
            />
            <StatCard
              label="Available storage"
              value={`${data.available_storage_gb} GB`}
              icon={Database01Icon}
              trend="flat"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold">
                Storage allocation
              </CardTitle>
              <CardDescription>
                {data.allocated_storage_gb} GB allocated of{" "}
                {data.included_storage_gb + data.purchased_storage_gb} GB total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={storagePct} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{storagePct}% allocated</span>
                <span>{data.available_storage_gb} GB free</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold">
                Storage by project
              </CardTitle>
              <CardDescription>
                Every project has one persistent volume. Deleting a project returns its allocation to this pool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projects.loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5 text-muted-foreground" />
                </div>
              ) : projects.error ? (
                <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <p className="text-sm text-muted-foreground">{projects.error.message}</p>
                  <Button variant="outline" size="sm" onClick={() => void projects.refresh()}>
                    Try again
                  </Button>
                </div>
              ) : projects.projects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HugeiconsIcon icon={Folder01Icon} className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">No storage allocated</p>
                    <p className="text-xs text-muted-foreground">Create a project to allocate part of your storage pool.</p>
                  </div>
                  <Button size="sm" nativeButton={false} render={<Link href="/dashboard/projects/new" />}>
                    New project
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Allocated</TableHead>
                      <TableHead className="hidden sm:table-cell">Applied</TableHead>
                      <TableHead className="text-right">State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Link className="font-medium hover:underline" href={`/dashboard/projects/${project.id}`}>
                            {project.name}
                          </Link>
                        </TableCell>
                        <TableCell>{project.desired_config.storage_gb} GB</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {project.current_config.storage_gb} GB
                        </TableCell>
                        <TableCell className="text-right">
                          {project.restart_required ? (
                            <Badge variant="secondary">Restart pending</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Applied</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

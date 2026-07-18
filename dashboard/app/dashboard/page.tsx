"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  PlayIcon,
  CreditCardIcon,
  Database01Icon,
  PlusSignIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { projectStatus } from "@/components/dashboard/project-state";
import { useApi } from "@/lib/api/use-api";
import { getUsage } from "@/lib/api/billing";
import { useProjects } from "@/lib/api/use-projects";
import type { Usage } from "@/lib/api/types";
import { formatCredits } from "@/lib/format";

const RUNNING = new Set(["running", "ready", "starting", "restarting"]);

export default function OverviewPage() {
  const projects = useProjects();
  const usage = useApi<Usage>(getUsage);

  const list = projects.projects;
  const running = list.filter((p) => RUNNING.has(p.state)).length;

  return (
    <>
      <PageHeader
        eyebrow="Console"
        title="Overview"
        description="Your cloud projects, credits, and storage at a glance."
        actions={
          <>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/dashboard/usage" />}
            >
              View usage
            </Button>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/dashboard/projects/new" />}
            >
              <HugeiconsIcon icon={PlusSignIcon} />
              New project
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={projects.loading ? "—" : String(list.length)}
          icon={Folder01Icon}
          trend="flat"
        />
        <StatCard
          label="Running"
          value={projects.loading ? "—" : String(running)}
          icon={PlayIcon}
          trend="flat"
        />
        <StatCard
          label="Credits"
          value={formatCredits(usage.data?.credits_balance)}
          icon={CreditCardIcon}
          trend="flat"
        />
        <StatCard
          label="Storage free"
          value={usage.data ? `${usage.data.available_storage_gb} GB` : "—"}
          icon={Database01Icon}
          trend="flat"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="font-heading text-base font-semibold">
              Projects
            </CardTitle>
            <CardDescription>Your cloud machines and their state</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/projects" />}
          >
            View all
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </CardHeader>
        <CardContent>
          {projects.loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : projects.error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {projects.error.code === "payment_required"
                ? "Choose a plan to start creating projects."
                : projects.error.message}
            </p>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No projects yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="hidden md:table-cell">Machine</TableHead>
                  <TableHead className="hidden md:table-cell">Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.slice(0, 6).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {p.current_config.machine_type_code || "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {p.current_config.region_code || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={projectStatus(p.state)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${p.name}`}
                        nativeButton={false}
                        render={<Link href={`/dashboard/projects/${p.id}`} />}
                      >
                        <HugeiconsIcon icon={ArrowRight01Icon} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { motion } from "motion/react";
import { GitBranch, MoreHorizontal } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { DeployStateBadge } from "@/components/console/deploy-state";
import { item } from "@/lib/motion";
import { deployments, formatDuration, relativeTime } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * `compact` drops the columns that don't survive a 2/3-width column — the
 * overview summarises, the dedicated /deployments route carries full detail.
 */
export function DeploymentsTable({
  compact = false,
  limit,
}: {
  compact?: boolean;
  limit?: number;
}) {
  const rows = limit ? deployments.slice(0, limit) : deployments;

  return (
    <motion.section
      variants={item}
      aria-labelledby="deployments-heading"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 id="deployments-heading" className="text-h4">
            Recent deployments
          </h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Across 4 projects in the last 24 hours.
          </p>
        </div>
      </header>

      {/* Wide table scrolls inside its own container; the page never does. */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-6">Commit</TableHead>
              {!compact && <TableHead>Project</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Branch</TableHead>
              {!compact && <TableHead className="text-right">Duration</TableHead>}
              <TableHead>Author</TableHead>
              <TableHead className="text-right">Age</TableHead>
              <TableHead className="w-10 pe-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} className="group">
                <TableCell className="ps-6">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-1 text-body-sm font-medium text-foreground">
                      {d.message}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.commit}
                      {compact && (
                        <span className="ms-2 text-muted-foreground/70">
                          {d.project}
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                {!compact && (
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.project}
                    </span>
                  </TableCell>
                )}
                <TableCell>
                  <DeployStateBadge state={d.state} />
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <GitBranch className="size-3.5 shrink-0" />
                    <span className="max-w-32 truncate font-mono text-xs">
                      {d.branch}
                    </span>
                  </span>
                </TableCell>
                {!compact && (
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDuration(d.durationSec)}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px] font-mono">
                        {d.author.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "text-body-sm text-muted-foreground",
                        compact ? "hidden" : "hidden xl:inline",
                      )}
                    >
                      {d.author.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {relativeTime(d.createdAt)}
                </TableCell>
                <TableCell className="pe-6">
                  <Menu>
                    <MenuTrigger
                      aria-label={`Actions for deployment ${d.commit}`}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[popup-open]:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </MenuTrigger>
                    <MenuPopup align="end" className="w-44">
                      <MenuItem>View build logs</MenuItem>
                      <MenuItem>Inspect deployment</MenuItem>
                      <MenuSeparator />
                      <MenuItem>Redeploy</MenuItem>
                      <MenuItem className="text-destructive-foreground">
                        Cancel build
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.section>
  );
}

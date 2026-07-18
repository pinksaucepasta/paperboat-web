"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { navGroups } from "@/components/dashboard/nav-config";
import { PaperboatMark } from "@/components/dashboard/paperboat-mark";
import { getEntitlement, getUsage } from "@/lib/api/billing";
import { listCatalogPlans } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/use-api";
import type { CatalogPlan, Entitlement, Usage } from "@/lib/api/types";
import { formatCredits } from "@/lib/format";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const entitlement = useApi<Entitlement>(getEntitlement);
  const usage = useApi<Usage>(getUsage);
  const plans = useApi<CatalogPlan[]>(listCatalogPlans);
  const currentPlan = plans.data?.find(
    (plan) => plan.code === entitlement.data?.plan_code,
  );
  const creditBalance = Number(usage.data?.credits_balance);
  const creditQuota = Number(currentPlan?.included_credits);
  const hasCreditQuota =
    Number.isFinite(creditBalance) &&
    Number.isFinite(creditQuota) &&
    creditQuota > 0;
  const creditPercentage = hasCreditQuota
    ? Math.min(100, Math.max(0, (creditBalance / creditQuota) * 100))
    : 0;
  const quotaLoading = entitlement.loading || usage.loading || plans.loading;
  const quotaUnavailable = entitlement.error || usage.error || plans.error;

  return (
    <Sidebar className="group-data-[side=left]:border-r-0" collapsible="icon">
      <SidebarHeader>
        {/* Static brand mark (not a menu button) with the collapse trigger
            beside it. When collapsed to the icon rail the brand text steps
            aside so the trigger stays reachable. */}
        <div className="flex items-center gap-2 ps-2 pe-1 group-data-[collapsible=icon]:px-0">
          <Link
            href="/dashboard"
            aria-label="Paperboat — overview"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
          >
            <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PaperboatMark className="size-4" />
            </span>
            <span className="grid min-w-0 text-left leading-tight">
              <span className="truncate font-heading text-base font-semibold tracking-tight">
                Paperboat
              </span>
            </span>
          </Link>
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:size-8" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono uppercase tracking-[0.14em]">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <HugeiconsIcon
                          icon={item.icon}
                          className={cn(active && "text-primary")}
                        />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge className="font-mono">
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-lg border border-sidebar-border bg-card p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <HugeiconsIcon icon={Rocket01Icon} className="size-4" />
            </span>
            <div className="grid">
              <span className="text-xs font-medium leading-tight">
                {entitlement.data?.plan_name ?? "Plan"}
              </span>
              <span className="text-[0.6875rem] leading-tight text-muted-foreground">
                {quotaLoading
                  ? "Loading credit quota..."
                  : quotaUnavailable || !hasCreditQuota
                    ? "Credit quota unavailable"
                    : `${formatCredits(creditBalance)} / ${formatCredits(creditQuota)} credits`}
              </span>
            </div>
          </div>
          <Progress
            value={creditPercentage}
            aria-label="Credit balance remaining"
            className="mt-2.5 gap-0"
          />
          <Button
            size="sm"
            className="mt-3 w-full"
            nativeButton={false}
            render={<Link href="/dashboard/billing" />}
          >
            {entitlement.data?.state === "trialing" ? "Manage trial" : "View plans"}
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

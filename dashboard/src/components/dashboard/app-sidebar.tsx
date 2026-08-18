"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  CreditCardIcon,
  Logout01Icon,
  Moon02Icon,
  Rocket01Icon,
  Settings01Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CommandMenu } from "@/components/dashboard/command-menu";
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

export type AppSidebarUser = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

export function AppSidebar({ user }: { user: AppSidebarUser }) {
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
      {/* pt-5 rather than the default p-2: the sidebar is pinned to the
          viewport top, while the canvas beside it starts 8px down (m-2) and
          then runs a 56px top bar. The extra 12px puts the brand row on the
          top bar's centre line instead of 12px above it. */}
      <SidebarHeader className="pt-5">
        {/* Static brand mark (not a menu button) with the collapse trigger
            beside it. When collapsed to the icon rail the brand text steps
            aside so the trigger stays reachable. */}
        <div className="flex items-center gap-2 ps-2 pe-1 group-data-[collapsible=icon]:px-0">
          <Link
            href="/dashboard"
            aria-label="Paperboat — overview"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
          >
            <PaperboatMark className="h-6 w-auto shrink-0 text-primary" />
            <span className="grid min-w-0 text-left leading-tight">
              <span className="truncate font-heading text-base font-semibold tracking-tight">
                Paperboat
              </span>
            </span>
          </Link>
          {/* Desktop only: below md the sheet is driven by the trigger in the
              top bar, so showing this one too would double the control. */}
          <SidebarTrigger className="shrink-0 max-md:hidden group-data-[collapsible=icon]:size-8" />
        </div>
        <div className="px-2 pt-1 group-data-[collapsible=icon]:px-0">
          <CommandMenu />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-eyebrow">
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
        <PlanCard
          planName={entitlement.data?.plan_name}
          trialing={entitlement.data?.state === "trialing"}
          balance={creditBalance}
          quota={creditQuota}
          percentage={creditPercentage}
          hasQuota={hasCreditQuota}
          loading={quotaLoading}
          unavailable={Boolean(quotaUnavailable)}
        />
        <AccountMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/* Credit pressure is operational feedback (§2), so the meter shifts from the
   brand indigo to amber and then red as headroom disappears. The remaining
   count is restated in words beside it — color never carries the meaning
   alone (§6). */
function creditPressure(percentage: number) {
  if (percentage <= 5) {
    return { indicator: "bg-destructive", label: "text-destructive" };
  }
  if (percentage <= 20) {
    return { indicator: "bg-warning", label: "text-warning-foreground" };
  }
  return { indicator: "bg-primary", label: "text-muted-foreground" };
}

function PlanCard({
  planName,
  trialing,
  balance,
  quota,
  percentage,
  hasQuota,
  loading,
  unavailable,
}: {
  planName: string | undefined;
  trialing: boolean;
  balance: number;
  quota: number;
  percentage: number;
  hasQuota: boolean;
  loading: boolean;
  unavailable: boolean;
}) {
  const pressure = creditPressure(percentage);

  return (
    <div className="rounded-lg border border-sidebar-border bg-card p-3 group-data-[collapsible=icon]:hidden">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <HugeiconsIcon icon={Rocket01Icon} className="size-4" />
        </span>
        {loading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold">
            {planName ?? "Plan"}
          </span>
        )}
        {trialing ? (
          <Badge variant="warning" size="sm">
            Trial
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-1.5 w-full" />
      ) : unavailable || !hasQuota ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Credit balance unavailable.
        </p>
      ) : (
        <>
          <Progress
            value={percentage}
            aria-label="Credit balance remaining"
            className="mt-3 gap-0"
          >
            <ProgressTrack>
              <ProgressIndicator className={pressure.indicator} />
            </ProgressTrack>
          </Progress>
          {/* "Only" carries the low-balance warning in words, so the amber and
              red states never depend on color alone (§6). */}
          <p className={cn("mt-1.5 text-xs tabular-nums", pressure.label)}>
            {percentage <= 20 ? "Only " : ""}
            {formatCredits(balance)} of {formatCredits(quota)} credits left
          </p>
        </>
      )}

      {/* Outline, not primary: this is persistent shell furniture, and a
          saturated indigo block here outshouts the page's own primary action
          (§4). */}
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        nativeButton={false}
        render={<Link href="/dashboard/billing" />}
      >
        {trialing ? "Manage trial" : "View plans"}
      </Button>
    </div>
  );
}

const THEMES = [
  { value: "system", label: "System", icon: ComputerIcon },
  { value: "light", label: "Light", icon: Sun03Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
] as const;

/**
 * Inline theme segmented control for the account menu. Deliberately plain
 * buttons in a `radiogroup` rather than `DropdownMenuRadioItem`s: menu items
 * dismiss the popup on activate, and changing theme should leave the menu open
 * so the result is visible. Arrow keys move between the options, matching the
 * radio pattern the roles advertise.
 */
function ThemeControl({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (theme: string) => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (!delta) return;
    // The roving selection owns these keys; stop the menu from also treating
    // them as item navigation and moving focus out of the group.
    event.preventDefault();
    event.stopPropagation();
    const index = THEMES.findIndex((t) => t.value === value);
    const next = THEMES[(index + delta + THEMES.length) % THEMES.length];
    onChange(next.value);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="text-xs">Theme</span>
      <div
        role="radiogroup"
        aria-label="Theme"
        onKeyDown={onKeyDown}
        className="flex items-center gap-0.5"
      >
        {THEMES.map((option) => {
          const checked = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.label}
              /* Only the selected option is tabbable, so the group is one tab
                 stop and arrows move within it. */
              tabIndex={checked || (!value && option.value === "system") ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex size-6 items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                checked
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <HugeiconsIcon icon={option.icon} className="size-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccountMenu({ user }: { user: AppSidebarUser }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid an SSR/client mismatch: the stored theme is only known after mount,
  // so the radio group stays unselected until then.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials =
    (user.firstName?.[0] ?? user.email[0] ?? "U").toUpperCase() +
    (user.lastName?.[0] ?? "").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          />
        }
      >
        <Avatar className="size-8 shrink-0">
          {user.profilePictureUrl ? (
            <AvatarImage src={user.profilePictureUrl} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 group-data-[collapsible=icon]:hidden">
          <span className="block truncate text-sm font-medium leading-tight">
            {name}
          </span>
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {user.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-xs font-medium text-foreground">{name}</span>
            <span className="truncate text-[0.6875rem] font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            nativeButton={false}
            render={<Link href="/dashboard/settings" />}
          >
            <HugeiconsIcon icon={Settings01Icon} />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            nativeButton={false}
            render={<Link href="/dashboard/billing" />}
          >
            <HugeiconsIcon icon={CreditCardIcon} />
            Billing
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeControl
          value={mounted ? (theme ?? "system") : undefined}
          onChange={setTheme}
        />
        <DropdownMenuSeparator />
        <form action="/auth/logout" method="post">
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" className="w-full" />}
          >
            <HugeiconsIcon icon={Logout01Icon} />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

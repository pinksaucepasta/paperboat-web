"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, Sparkles, UserRound } from "lucide-react";

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
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { navGroups } from "@/components/console/nav-config";
import { PaperboatMark } from "@/components/paperboat-mark";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    /* `inset`: the page canvas takes --sidebar and the content floats above it
       as a rounded card. The rail intentionally has no border of its own — it
       reads as part of the canvas — so the card's edge has to carry the
       separation (see the border in the console layout). */
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        {/* Brand is a static mark, not a switcher. The collapse toggle lives
            here rather than in the top bar; when collapsed to the icon rail the
            brand steps aside so the trigger stays reachable. */}
        {/* ps-2 puts the brand mark on the same 16px left rhythm as every nav
            icon (group p-2 + button p-2); pe-1 lands the trigger's right edge
            on the same line as the nav badges. No fixed row height — two lines
            of brand text measure 36px and were overflowing an h-8 row. */}
        <div className="flex items-center gap-2 ps-2 pe-1 group-data-[collapsible=icon]:px-0">
          <Link
            href="/"
            aria-label="Paperboat — overview"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
          >
            <PaperboatMark className="h-6 w-auto shrink-0 text-primary" />
            <span className="grid min-w-0 text-left leading-tight">
              <span className="truncate font-heading text-sm font-semibold">
                Paperboat
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                acme-labs
              </span>
            </span>
          </Link>
          {/* Collapsed, the trigger takes the same size-8 box as a nav button
              rather than mx-auto centering: coss's icon width carries a +2px
              border allowance, so true-centering would sit it 1px right of the
              icons below it. */}
          <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:size-8" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-eyebrow text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((navItem) => {
                  const isActive =
                    navItem.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(navItem.href);
                  return (
                    <SidebarMenuItem key={navItem.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={navItem.title}
                        render={<Link href={navItem.href} />}
                      >
                        <navItem.icon
                          className={cn(
                            "transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        <span>{navItem.title}</span>
                      </SidebarMenuButton>
                      {navItem.badge && (
                        <SidebarMenuBadge className="font-mono">
                          {navItem.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="mb-2 rounded-lg border border-border bg-card p-3 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <p className="text-eyebrow text-primary">Pro trial</p>
              </div>
              <p className="mt-2 text-caption text-muted-foreground">
                18 days left. Unlimited edge regions and 90-day log retention.
              </p>
              <Link
                href="/settings"
                className="mt-3 inline-flex text-caption font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Upgrade plan
              </Link>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Menu>
              <MenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-muted font-mono text-xs">
                        AD
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">
                        Anvit Dadape
                      </span>
                      <span className="truncate text-caption text-muted-foreground">
                        dinesh.dadape@gmail.com
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                  </SidebarMenuButton>
                }
              />
              <MenuPopup align="start" side="top" className="w-60">
                <MenuItem className="gap-2">
                  <UserRound className="size-4" />
                  Account
                </MenuItem>
                <MenuSeparator />
                <MenuItem className="gap-2">
                  <LogOut className="size-4" />
                  Sign out
                </MenuItem>
              </MenuPopup>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

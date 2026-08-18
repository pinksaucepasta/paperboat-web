"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Book02Icon,
  HelpCircleIcon,
  Mail01Icon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { navTitleByHref } from "@/components/dashboard/nav-config";

// TODO: point these at the real destinations. Nothing in the repo defines a
// docs site or a support address yet (`docs/` is still a placeholder app), so
// these are stand-ins rather than invented URLs.
const SUPPORT_DOCS_URL = "https://paperboat.dev/docs";
const SUPPORT_EMAIL = "support@paperboat.dev";

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const title =
      navTitleByHref[href] ??
      segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { href, title, isLast: index === segments.length - 1 };
  });
}

export function TopNav() {
  const crumbs = useBreadcrumbs();

  // Horizontal padding tracks <main>'s p-4/md:p-6/lg:p-8 so the breadcrumb
  // starts on the same content edge as the page title beneath it (§5).
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6 lg:px-8">
      {/* Below md the sidebar is an offcanvas sheet, and its own trigger goes
          with it — leaving no way to reopen it. This is the mobile entry
          point; above md the in-sidebar trigger takes over. */}
      <SidebarTrigger className="-ms-1 shrink-0 md:hidden" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <BreadcrumbItem className="whitespace-nowrap">
                {crumb.isLast ? (
                  <BreadcrumbPage className="font-medium">
                    {crumb.title}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link href={crumb.href} />}
                    className="text-muted-foreground"
                  >
                    {crumb.title}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!crumb.isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <SupportMenu />
        <NotificationsPanel />
      </div>
    </header>
  );
}

function SupportMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Help and support"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        }
      >
        <HugeiconsIcon icon={HelpCircleIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground">
            Support
          </DropdownMenuLabel>
          <DropdownMenuItem
            nativeButton={false}
            render={
              <a href={SUPPORT_DOCS_URL} target="_blank" rel="noreferrer" />
            }
          >
            <HugeiconsIcon icon={Book02Icon} />
            Documentation
          </DropdownMenuItem>
          <DropdownMenuItem
            nativeButton={false}
            render={<a href={`mailto:${SUPPORT_EMAIL}`} />}
          >
            <HugeiconsIcon icon={Mail01Icon} />
            Contact support
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsPanel() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        }
      >
        <HugeiconsIcon icon={Notification01Icon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-4 py-3 text-sm font-medium text-foreground">
            Notifications
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="px-4 py-6 text-center">
          <HugeiconsIcon icon={Notification01Icon} className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No notifications to review</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Account and workspace activity will appear here.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

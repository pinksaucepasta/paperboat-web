"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandMenu, ThemeToggle } from "@/components/console/command-menu";
import { navGroups } from "@/components/console/nav-config";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function useCrumbs() {
  const pathname = usePathname();
  const all = navGroups.flatMap((g) => g.items);
  const current = all.find((i) =>
    i.href === "/" ? pathname === "/" : pathname.startsWith(i.href),
  );
  return current ?? all[0];
}

export function TopBar() {
  const current = useCrumbs();
  // Below the sidebar's own mobile cutoff it renders as an off-canvas sheet,
  // so the in-sidebar trigger is unreachable and the top bar must carry one.
  // Driven off the same hook rather than a CSS breakpoint: coss's `md` is
  // 800px while Tailwind's is 768, and the gap would strand the toggle.
  const { isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {isMobile && (
        <>
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="h-4" />
        </>
      )}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden sm:block">
            <BreadcrumbLink
              render={<Link href="/" />}
              className="font-mono text-xs"
            >
              acme-labs
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-xs">
              {current.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <TooltipProvider>
        <div className="ms-auto flex items-center gap-2">
          <CommandMenu />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Notifications, 2 unread"
                  className="relative"
                />
              }
            >
              <Bell aria-hidden="true" />
              {/* Unread dot — paired with the count in the a11y label above,
                  so state is never carried by colour alone. */}
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary ring-2 ring-background" />
            </TooltipTrigger>
            <TooltipPopup>Notifications</TooltipPopup>
          </Tooltip>
          <ThemeToggle />
        </div>
      </TooltipProvider>
    </header>
  );
}

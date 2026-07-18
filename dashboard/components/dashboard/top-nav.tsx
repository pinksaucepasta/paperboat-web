"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Logout01Icon,
  Settings01Icon,
  CreditCardIcon,
} from "@hugeicons/core-free-icons";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navTitleByHref } from "@/components/dashboard/nav-config";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

export type TopNavUser = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

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

export function TopNav({ user }: { user: TopNavUser }) {
  const crumbs = useBreadcrumbs();
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials =
    (user.firstName?.[0] ?? user.email[0] ?? "U").toUpperCase() +
    (user.lastName?.[0] ?? "").toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-4">
      <SidebarTrigger className="-ml-1" />

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
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Account menu"
                className="ml-1 flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            }
          >
            <Avatar className="size-8">
              {user.profilePictureUrl ? (
                <AvatarImage src={user.profilePictureUrl} alt={name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-xs font-medium">{name}</span>
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
      </div>
    </header>
  );
}

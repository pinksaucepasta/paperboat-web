import {
  Folder01Icon,
  Configuration01Icon,
  Analytics01Icon,
  CreditCardIcon,
  Settings01Icon,
  DashboardSquare01Icon,
  CloudServerIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type NavItem = {
  title: string;
  href: string;
  icon: IconSvgElement;
  badge?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Overview", href: "/dashboard", icon: DashboardSquare01Icon },
      { title: "Projects", href: "/dashboard/projects", icon: Folder01Icon },
      { title: "Connected machines", href: "/dashboard/connected-machines", icon: CloudServerIcon },
      { title: "Configuration", href: "/dashboard/configuration", icon: Configuration01Icon },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Usage", href: "/dashboard/usage", icon: Analytics01Icon },
      { title: "Billing", href: "/dashboard/billing", icon: CreditCardIcon },
      { title: "Settings", href: "/dashboard/settings", icon: Settings01Icon },
    ],
  },
];

/** Flat lookup of href -> title, used for breadcrumbs. */
export const navTitleByHref: Record<string, string> = Object.fromEntries(
  navGroups.flatMap((g) => g.items.map((i) => [i.href, i.title])),
);

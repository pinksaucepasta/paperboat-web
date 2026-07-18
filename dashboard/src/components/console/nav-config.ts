import {
  ActivitySquare,
  BarChart3,
  Boxes,
  FileClock,
  Globe2,
  KeyRound,
  LayoutGrid,
  Rocket,
  Settings2,
  ShieldAlert,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Rendered as a SidebarMenuBadge — counts, not decoration. */
  badge?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { title: "Overview", href: "/", icon: LayoutGrid },
      { title: "Deployments", href: "/deployments", icon: Rocket, badge: "2" },
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Incidents", href: "/incidents", icon: ShieldAlert, badge: "2" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { title: "Projects", href: "/projects", icon: Boxes },
      { title: "Edge regions", href: "/regions", icon: Globe2 },
      { title: "Logs", href: "/logs", icon: FileClock },
      { title: "Health checks", href: "/health", icon: ActivitySquare },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Access tokens", href: "/tokens", icon: KeyRound },
      { title: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];

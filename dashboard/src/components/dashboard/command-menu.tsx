"use client";

import * as React from "react";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { navGroups } from "@/components/dashboard/nav-config";
import { listProjects } from "@/lib/api/projects";
import type { Project } from "@/lib/api/types";

type Item = {
  value: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Group = { value: string; items: Item[] };

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Projects are fetched the first time the palette opens rather than on mount:
     the sidebar renders on every dashboard route, and `useProjects()` would
     also start global live-state polling from the shell. A failed fetch just
     leaves the palette to navigation — search is not worth a toast. */
  const loaded = React.useRef(false);
  React.useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    listProjects().then(setProjects, () => {
      loaded.current = false;
    });
  }, [open]);

  const groups = React.useMemo<Group[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };

    return [
      {
        value: "Navigation",
        items: navGroups.flatMap((group) =>
          group.items.map((navItem) => ({
            value: navItem.title,
            label: navItem.title,
            hint: group.label,
            run: go(navItem.href),
          })),
        ),
      },
      {
        value: "Projects",
        items: projects.map((project) => ({
          value: project.name,
          label: project.name,
          hint: project.state,
          run: go(`/dashboard/projects/${project.id}`),
        })),
      },
      {
        value: "Appearance",
        items: [
          {
            value: "Toggle theme",
            label: `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`,
            hint: "Theme",
            run: () => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            },
          },
        ],
      },
    ].filter((group) => group.items.length > 0);
  }, [router, projects, resolvedTheme, setTheme]);

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      >
        <HugeiconsIcon
          icon={Search01Icon}
          className="size-4 shrink-0"
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
          Search
        </span>
        <Kbd className="shrink-0 group-data-[collapsible=icon]:hidden">⌘K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup>
          {/* Items are passed as whole objects (not `item.value` strings) so
              Base UI can match rendered items back to the collection it
              filters. The explicit filter widens matching across label and
              hint, so a project is reachable by its state too. */}
          <Command
            items={groups}
            filter={(candidate: unknown, query: string) => {
              if (!query) return true;
              const c = candidate as Partial<Item>;
              const q = query.trim().toLowerCase();
              return [c.label, c.hint, c.value].some((field) =>
                field?.toLowerCase().includes(q),
              );
            }}
          >
            <CommandInput placeholder="Search projects and pages…" />
            <CommandPanel>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandList>
                {(group: Group) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.value}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: Item) => (
                          <CommandItem
                            key={item.value}
                            value={item}
                            onClick={item.run}
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.hint ? (
                              <span className="ms-auto shrink-0 font-mono text-xs capitalize text-muted-foreground">
                                {item.hint}
                              </span>
                            ) : null}
                          </CommandItem>
                        )}
                      </CommandCollection>
                    </CommandGroup>
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </>
  );
}

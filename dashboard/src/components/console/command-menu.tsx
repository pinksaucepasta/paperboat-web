"use client";

import * as React from "react";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";

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
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { navGroups } from "@/components/console/nav-config";
import { deployments, projects } from "@/lib/data";

type Item = {
  value: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Group = { value: string; items: Item[] };

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
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

  const groups = React.useMemo<Group[]>(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };

    return [
      {
        value: "Navigation",
        items: navGroups.flatMap((g) =>
          g.items.map((navItem) => ({
            value: navItem.title,
            label: navItem.title,
            hint: g.label,
            run: go(navItem.href),
          })),
        ),
      },
      {
        value: "Projects",
        items: projects.map((p) => ({
          value: p.name,
          label: p.name,
          hint: p.framework,
          run: go("/projects"),
        })),
      },
      {
        value: "Recent deployments",
        items: deployments.slice(0, 5).map((d) => ({
          value: `${d.commit} ${d.message}`,
          label: d.message,
          hint: d.commit,
          run: go("/deployments"),
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
    ];
  }, [router, resolvedTheme, setTheme]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full justify-start gap-2 px-3 font-normal text-muted-foreground sm:w-64"
      >
        <Search aria-hidden="true" className="text-muted-foreground" />
        <span className="flex-1 truncate text-left">Search…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup>
          {/* Items are passed as whole objects (not `item.value` strings) so
              Base UI can match rendered items back to the collection it
              filters. The explicit filter widens matching across the label,
              hint, and commit hash — searching "wasm" should find the commit
              whose message mentions it. */}
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
            <CommandInput placeholder="Search projects, deployments, commands…" />
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
                            {item.hint && (
                              <span className="ms-auto shrink-0 font-mono text-xs text-muted-foreground">
                                {item.hint}
                              </span>
                            )}
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

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          />
        }
      >
        {/* Both icons render; the `.dark` class on <html> picks one. Resolved
            in CSS, not from a mounted flag, so no hydration mismatch / flip. */}
        <Moon aria-hidden="true" className="dark:hidden" />
        <Sun aria-hidden="true" className="hidden dark:block" />
      </TooltipTrigger>
      <TooltipPopup>Toggle theme</TooltipPopup>
    </Tooltip>
  );
}

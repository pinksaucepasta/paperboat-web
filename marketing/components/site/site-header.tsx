import * as React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Login01Icon,
  Menu09Icon,
  Cancel01Icon,
  CloudServerIcon,
  LaptopCloudIcon,
  Robot01Icon,
  ConnectIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function PaperboatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 335.156 335.156"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M333.352,138.278c-1.882-2.198-4.859-3.117-7.652-2.362l-94.603,25.558l-57.274-86.133c-0.002-0.003-0.005-0.006-0.007-0.009c-2.965-4.438-9.51-4.442-12.477,0c-0.002,0.003-0.005,0.006-0.007,0.009l-57.274,86.134L9.456,135.916c-2.794-0.758-5.771,0.164-7.652,2.362c-1.882,2.197-2.332,5.281-1.157,7.925l50,112.495c1.166,2.646,3.862,4.455,6.86,4.455c0.005,0,0.01-0.001,0.014-0.001c1.074,0,219.237,0.003,220.208-0.005c2.937-0.031,5.585-1.767,6.781-4.448l50-112.495C335.684,143.559,335.234,140.475,333.352,138.278z M175.078,104.318l40.749,61.282l-40.749,11.008V104.318z M160.078,104.318v72.291L119.329,165.6L160.078,104.318z M20.752,154.506l128.331,34.671l-88.246,55.515L20.752,154.506z M83.506,248.151l84.069-52.887l84.074,52.887H83.506z M274.32,244.692l-88.252-55.515l17.086-4.616l111.251-30.055L274.32,244.692z" />
    </svg>
  );
}

const PRODUCTS = [
  {
    label: "Cloud Agents",
    href: "#cloud-agents",
    description: "Run AI agents on isolated, fully-managed cloud compute.",
    icon: CloudServerIcon,
  },
  {
    label: "Remote Agents",
    href: "#remote-agents",
    description: "Drive agents on your own machines from anywhere.",
    icon: LaptopCloudIcon,
  },
  {
    label: "Hosted Hermes Agent",
    href: "#hermes",
    description: "A truly 0-setup Hermes agent, fully managed and ready to run.",
    icon: Robot01Icon,
  },
  {
    label: "Secure access",
    href: "#environment-access",
    description: "An extensible tunneling service for everything.",
    icon: ConnectIcon,
  },
] as const;

function MenuLink({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof CloudServerIcon;
}) {
  return (
    <NavigationMenuLink
      render={<a href={href} />}
      className="flex-row items-start gap-3 p-3"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium leading-none text-foreground">
          {label}
        </span>
        <span className="text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </NavigationMenuLink>
  );
}

function MobileLink({ href, label }: { href: string; label: string }) {
  return (
    <SheetClose
      nativeButton={false}
      render={
        <a
          href={href}
          className="-mx-2 rounded-md px-2 py-1 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
        />
      }
    >
      {label}
    </SheetClose>
  );
}

function MobileSection({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-eyebrow text-primary-foreground/50">{label}</span>
      {items.map((item) => (
        <MobileLink key={item.label} {...item} />
      ))}
    </div>
  );
}

function MobileNav({
  open,
  onOpenChange,
  scrolled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scrolled: boolean;
}) {
  return (
    <>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[49] bg-primary/50 backdrop-blur-md" />,
          document.body
        )}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              className={cn(
                "-ml-1 flex size-9 items-center justify-center lg:hidden",
                scrolled && !open ? "text-primary" : "text-white"
              )}
            />
          }
        >
          <HugeiconsIcon
            icon={open ? Cancel01Icon : Menu09Icon}
            className="size-6"
            strokeWidth={2}
          />
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          overlayClassName="bg-transparent backdrop-blur-none"
          className="gap-0 border-none bg-transparent text-primary-foreground shadow-none data-[side=left]:top-16 data-[side=left]:h-[calc(100dvh-4rem)] data-[side=left]:w-full data-[side=left]:sm:max-w-sm"
        >
        <SheetTitle className="sr-only">Menu</SheetTitle>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          <MobileSection label="Products" items={PRODUCTS} />
          <MobileSection
            label="More"
            items={[
              { label: "Docs", href: "#docs" },
              { label: "Pricing", href: "#pricing" },
              { label: "Changelog", href: "#changelog" },
            ]}
          />
        </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When scrolled, the header gains a translucent white background, so all
  // overlay text switches to the dark primary color for legibility.
  const navText =
    scrolled && !menuOpen ? "text-primary" : "text-white lg:text-primary";

  return (
    <header
      className={cn(
        "flex w-full items-center justify-between gap-6 px-6 py-3 transition-colors duration-300 lg:px-10 lg:py-4",
        scrolled &&
          !menuOpen &&
          "border-b border-border bg-background shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background"
      )}
    >
      <div className="flex items-center gap-3 lg:gap-8">
        <MobileNav open={menuOpen} onOpenChange={setMenuOpen} scrolled={scrolled} />

        <a href="/" className={cn("flex items-center gap-2.5", navText)}>
          <PaperboatMark className="size-7" />
          <span className="font-mono text-base font-bold tracking-tight">
            PAPERBOAT
          </span>
        </a>

        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList className="gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className={cn("text-nav", navText)}>
                Products
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-72 gap-1">
                  {PRODUCTS.map((product) => (
                    <li key={product.label}>
                      <MenuLink {...product} />
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink
                render={<a href="#docs" />}
                className={cn("text-nav", navText)}
              >
                Docs
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink
                render={<a href="#pricing" />}
                className={cn("text-nav", navText)}
              >
                Pricing
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuLink
                render={<a href="#changelog" />}
                className={cn("text-nav", navText)}
              >
                Changelog
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="lg"
          nativeButton={false}
          render={<a href="#signin" />}
          className={cn(
            scrolled
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          )}
        >
          Sign in
          <HugeiconsIcon icon={Login01Icon} data-icon="inline-end" />
        </Button>
      </div>
    </header>
  );
}

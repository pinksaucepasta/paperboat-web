/**
 * Deployment-level facts about the marketing site.
 *
 * These are the only hostnames the site is allowed to state, and they live here
 * once so canonical tags, structured data, navigation, and copy can never drift
 * apart. They are deployment configuration, not product data: plans, prices,
 * limits, machine shapes, idle timeouts, and preview hostnames belong to the
 * server catalog and are deliberately absent from this file and from the page.
 */
export const SITE = {
  /** Canonical origin of the marketing site. Must match the deployed DNS record. */
  origin: "https://paperboat.dev",
  /** Entry point of the authenticated dashboard app. */
  dashboard: "https://app.paperboat.cloud",
  /** Endpoint serving the `pb` install script, piped to a shell by the docs. */
  install: "https://get.pprbt.dev/install",
  name: "Paperboat",
  tagline: "Run coding agents on machines that stay up.",
} as const;

/** Primary navigation. Section ids are the anchors rendered on the page. */
export const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#environments", label: "Environments" },
  { href: "#terminal", label: "Terminal" },
  { href: "#previews", label: "Previews" },
  { href: "#faq", label: "FAQ" },
] as const;

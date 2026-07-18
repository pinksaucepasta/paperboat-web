# AGENTS.md - marketing

Inherit [`../../AGENTS.md`](../../AGENTS.md), [`../AGENTS.md`](../AGENTS.md), and
[`../DESIGN.md`](../DESIGN.md). Marketing, landing, and marketing site mean this app.

## Stack and Purpose

Astro 7, TypeScript, React islands, Tailwind 4, shared Base UI/shadcn primitives, and
Motion only for genuine interaction. Keep it static-first. Explain the real product and
move qualified developers directly to the dashboard.

## Local Rules

- Claims match `USERSTORY.md`; never market Papercode, reviews, protected previews, SSH
  product access, raw TCP, or unfinished behavior.
- Lead with Paperboat and its literal offer. Demonstrate real commands, terminal behavior,
  previews, machine state, and product interfaces rather than abstract claims.
- Keep Get started direct; do not add marketing friction.
- Avoid generic SaaS cards, fake metrics, glass, gradients, ornamental dashboards, and
  decorative motion.
- Operational values and prices come from authoritative data, not duplicated constants.
- Preserve semantic HTML, crawlability, canonical metadata, structured data, sitemap,
  fast loading, stable layout, keyboard/focus behavior, and reduced motion.
- Ship no client JavaScript for static content; every island has explicit failure/loading
  behavior.

## Verify

Run `bun run build`. Verify desktop/mobile layouts, keyboard/focus, reduced motion, long
copy, production assets, links, metadata, structured data, sitemap, and hydration errors.

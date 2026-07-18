# AGENTS.md - paperboat-web

Inherit [`../AGENTS.md`](../AGENTS.md) and [`DESIGN.md`](DESIGN.md). Web and web monorepo
mean this repo.

## Ownership and Children

One TypeScript monorepo with separately deployable apps:

- [`marketing/AGENTS.md`](marketing/AGENTS.md): Astro marketing/SEO site.
- [`dashboard/AGENTS.md`](dashboard/AGENTS.md): authenticated Next.js control panel.
- `docs/`: reserved public documentation app directory; currently only `.gitkeep`.

Web apps call `paperboat-server` only. They never carry environment traffic, administer
frps/Fly, or receive provider/tunnel credentials.

## Shared Rules

- Share tokens, vocabulary, copy, schemas, API clients, and components only where
  ownership is genuinely common. Avoid a generic shared-package maze.
- Preserve separate deployment, caching, security, and performance needs.
- Server state is authoritative; pending, stale, partial, and reconciled states are
  explicit.
- Every workflow covers loading, empty, offline, degraded, error, retry, permission,
  cancellation, and partial success where applicable.
- Meet WCAG AA, keyboard, focus, responsive, reduced-motion, semantic, and readable-copy
  requirements.
- Avoid generic AI UI, infrastructure theater, nested cards, decorative dashboards,
  vague copy, gratuitous motion, glass, and gradients.
- Consolidate behavior/tooling before redesigning; do not combine repository migration
  with unrelated visual change.

Child verification lives in each app guide.

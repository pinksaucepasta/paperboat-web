# AGENTS.md - dashboard

Inherit [`../../AGENTS.md`](../../AGENTS.md), [`../AGENTS.md`](../AGENTS.md), and
[`../DESIGN.md`](../DESIGN.md). Dashboard, app, and control panel mean this app.

## Stack and Purpose

Next.js 16, React 19, TypeScript, WorkOS AuthKit, Base UI/shadcn, Tailwind 4, Drizzle,
Postgres, and Vitest. Read installed Next.js docs for version-sensitive APIs. Manage
billing, projects, BYOD, config repos/assignments/consent, session metadata, previews,
CLI clients, and lifecycle through the server BFF.

## Local Rules

- Preserve BFF cookie rotation, CSRF, callbacks, reauthentication, CLI approval, client
  revocation, and secret isolation.
- Browser code never calls provider, Caddy, frps, helper, or Fly administration APIs.
- Distinguish hosted and BYOD behavior wherever lifecycle, billing, storage, config, or
  consent differs.
- Show desired/observed/pending state and uncertain outcomes without infrastructure
  jargon.
- Billing shows server-provided entitlement, usage, immediate effect, renewal effect, and
  recovery. Preview UI always states URLs are public.
- Config UI separates repository connection, environment assignment, and BYOD consent.
- Keep layouts calm, dense, keyboard-efficient, responsive, and accessible. Cards are for
  genuine repeated entities or framed tools.
- Optimistic state must be reversible and reconciled with the server.

## Verify

Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`. Verify real
mobile/desktop workflows with long, empty, loading, error, offline, stale, and permission
states.

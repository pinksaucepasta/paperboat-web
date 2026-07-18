# Paperboat dashboard

The authenticated Paperboat control panel. Users manage projects, connected machines,
configuration repositories, usage, billing, and account settings through APIs owned by
`paperboat-server`.

## Development

```sh
bun install
bun run dev
```

Before committing:

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

See [AGENTS.md](AGENTS.md) and the repository-level [DESIGN.md](../DESIGN.md) before
changing behavior or interface design.

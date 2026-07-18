# paperboat-web

The Paperboat web monorepo. It contains the public marketing site, authenticated product
dashboard, and documentation site as separately deployable applications with shared
product vocabulary and design foundations.

Web applications communicate with `paperboat-server`. They do not carry environment
traffic, administer tunnel infrastructure, or receive provider credentials.

## Applications

- `marketing/`: Astro marketing and SEO site.
- `dashboard/`: Next.js authenticated control panel.
- `docs/`: public documentation site.

## Development

Each application owns its development commands until shared workspace tooling is
introduced deliberately. See [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md) before
making changes.

## License

MIT. See [LICENSE](LICENSE).

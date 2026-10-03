# Alfred workspace

Developed and maintained by **[Alfredlabs](https://alfredlabs.org)**.

[Source repository](https://github.com/GOI17/alfred-workspace)

Alfred workspace brings coding agents, terminals, Git worktrees, and folder
workspaces together across local and remote development environments. It includes
desktop and mobile clients.

## Development

Use Node.js 24+ and pnpm. Read [AGENTS.md](AGENTS.md) and the
[style guide](docs/STYLEGUIDE.md) before making changes.

```sh
pnpm install
pnpm dev
```

Agent-launched apps and tests must set `ALFRED_BACKGROUND_LAUNCH=1` and must never
reveal windows or take focus.

The CLI is `alfred`; its development wrapper is `alfred-dev`. Configuration uses
`ALFRED_*` environment variables and Alfred data directories. This is a separate
installation identity: existing installations and saved credentials are not
implicitly migrated or overwritten. Remote hosts and paired clients must use the
Alfred build together.

Run `pnpm tc`, `pnpm test`, and `pnpm run check:code-quality:changed` to verify changes.
See [mobile development](mobile/README.md) for the mobile client.

## Distribution and services

The [main branch build](docs/reference/main-branch-builds.md) uploads development
artifacts. Publishing and infrastructure deployment require explicit configuration;
see [the transition notes](docs/alfredlabs-fork.md).

The source uses `alfredlabs.org` and its service subdomains. These settings do not
mean that authentication, relay, push, sharing, stores, or signed releases have
been deployed. Configure the owned services and signing credentials before distribution.

## License and attribution

The inherited [MIT license](LICENSE) and original copyright notices are preserved.
See [NOTICE.md](NOTICE.md) for provenance and third-party attribution.

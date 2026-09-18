# Alfred Workspace

Developed and maintained by **Alfredlabs**.

Repository: [GOI17/alfred-workspace](https://github.com/GOI17/alfred-workspace).

Alfred Workspace is an independent fork for working with coding agents across
local and remote development environments, with desktop and mobile clients.
Alfredlabs determines the product direction, development priorities, and releases.

## Current status

The fork is being established. This branch contains the initial attribution and
migration inventory. The application still contains inherited Orca branding,
identifiers, and service configuration; it is not yet an independent Alfredlabs
release. No Alfred Workspace download or hosted service is advertised here.

The [fork transition](docs/alfredlabs-fork.md) records the remaining work:
installation identities and data isolation, updates, authentication, relay,
notifications, plugins, documentation, and distribution notices.

## Product direction

- Run and coordinate coding agents on the computer that owns the workspace.
- Work with both Git worktrees and folder workspaces, locally or through remote hosts.
- Use the mobile client to inspect and operate the host's work.
- Develop a lightweight mobile container that receives its working interface from
  the paired host through the existing authenticated connection, including relay.
  This last item is ongoing development, not a shipped capability of this fork.

## Development

Use Node.js 24+ and pnpm. Read [AGENTS.md](AGENTS.md) before making changes and
[the style guide](docs/STYLEGUIDE.md) before changing the interface.

Install dependencies:

```sh
pnpm install
```

For interactive desktop development, the existing command is:

```sh
pnpm dev
```

Agent-launched apps and tests must run in the background with
`ORCA_BACKGROUND_LAUNCH=1` and must not reveal windows or take focus. The inherited
`ORCA_*` names and CLI commands remain compatibility identifiers during migration.

Existing checks include `pnpm tc`, `pnpm test`, and
`pnpm run check:code-quality:changed`. See [mobile development](mobile/README.md)
for the inherited mobile setup. Those instructions and the rest of the historical
documentation may still point to upstream services; they do not establish that
Alfredlabs operates those services.

## License and attribution

The inherited code is licensed under the [MIT license](LICENSE). Original
copyright notices remain intact. See [NOTICE.md](NOTICE.md) for provenance and
third-party attribution. This fork is maintained independently of the original
Orca team and does not imply its endorsement.

# Alfred workspace identity

**Alfredlabs**, at [alfredlabs.org](https://alfredlabs.org), maintains Alfred workspace.
The source repository is [GOI17/alfred-workspace](https://github.com/GOI17/alfred-workspace).
Original authorship and licensing remain recorded in [NOTICE.md](../NOTICE.md)
and [LICENSE](../LICENSE).

## Installation and runtime identity

| Surface                                           | Alfred identity                   |
| ------------------------------------------------- | --------------------------------- |
| Product                                           | Alfred workspace                  |
| Command / development wrapper                     | `alfred` / `alfred-dev`           |
| Desktop application ID                            | `org.alfredlabs.workspace`        |
| Mobile application ID                             | `org.alfredlabs.workspace.mobile` |
| URL scheme                                        | `alfred:`                         |
| Environment prefix                                | `ALFRED_`                         |
| Workspace configuration                           | `alfred.yaml`                     |
| Plugin manifest                                   | `alfred-plugin.json`              |
| Runtime, profile, socket, and keychain namespaces | Alfred-specific names             |

This is an independent installation. The rename does not read, move, or delete
another product's data. Credentials and pairings must be set up in Alfred.
Desktop, mobile, CLI, and remote hosts must run Alfred together; this change does
not offer cross-product wire or persisted-data compatibility.

The visible name, commands, internal symbols, filenames, packages owned by this
repository, documentation, localization catalogs, and generated skill resources
use the Alfred identity. Third-party dependency names and legal notices retain
their actual provenance. The app icons use the same monochrome A mark.

## Services and releases

The configured namespace is `alfredlabs.org`: `login`, `relay`, `push`, and `share`
subdomains identify the corresponding services. Existing `ALFRED_*` environment
settings provide the service configuration overrides. DNS, TLS, OAuth registration,
cloud projects, databases, push credentials, and service deployment still require
provisioning; a source rename alone does not provision any of them.

Stable updates use `GOI17/alfred-workspace`. The hourly, daily, and adhoc update
feeds use the corresponding `alfred-workspace-*` repositories, which must be
provisioned before those channels can distribute updates. Main-branch development
builds remain artifact-only (`--publish never`). Release and deployment workflows
are opt-in through the `ALFRED_RELEASES_ENABLED` repository variable.

Homebrew casks stay disabled until the first Alfred release replaces the inherited
version and checksums. The release workflow renders fresh casks from release artifacts.

Signing requires Alfred-owned credentials. Set `ALFRED_WINDOWS_PUBLISHER` to the
actual Windows certificate publisher when configuring signed releases. Inherited
signing workflow integrations require their own account and certificate setup;
do not enable publication until those integrations have been verified.

## Before distribution

Verify independent installation and update behavior on macOS, Linux, and Windows;
mobile signing and push configuration on iOS and Android; and authenticated
pairing through the Alfred relay. Package the original MIT notice and applicable
third-party notices with distributed binaries. Historical source references remain
attribution, not claims that Alfredlabs authored the inherited implementation.

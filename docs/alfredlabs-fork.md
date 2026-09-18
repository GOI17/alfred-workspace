# Alfred Workspace fork transition

Alfredlabs directs and maintains **Alfred Workspace**. Its public repository is
[`GOI17/alfred-workspace`](https://github.com/GOI17/alfred-workspace). This document records
the initial audit, not a completed rebrand or a release-ready independent build.

The preparation branch starts from upstream commit
`f24f38bd4105753adb0d8e24132c2fc57f80f5c6` on `origin/main`.

## Attribution and identity

Keep the original [MIT license](../LICENSE), including the Lovecast Inc.
copyright notice, and the [attribution notice](../NOTICE.md). Preserve the
applicable licenses of vendored code, dependencies, fonts, and other assets.
The MIT license permits modifying and distributing the code, subject to its
notice requirements; it does not establish that a proposed product name or logo
is available for use. Use Alfredlabs branding without implying upstream endorsement.

Retain source history as provenance. Do not replace original authors' names or
copyright notices with Alfredlabs. If notices for new contributions are added,
scope them to those contributions and use their actual rights holder.

Before binary distribution, verify that required notices are included and
accessible in the desktop and mobile artifacts. A notice present only in the
source repository is not evidence that the distributed application includes it.

## Surfaces identified in the initial audit

| Surface                   | Current implementation                                                                                          | Transition required                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public identity           | `package.json`, `README.md`, localized READMEs, `docs/site`, desktop and mobile icons                           | Set the selected product name, Alfredlabs maintenance identity, and owned support/docs links. Replace branding assets deliberately.                                                                                   |
| Desktop installation      | `config/electron-builder.config.cjs`, `src/shared/local-build-compatibility-contract.*`                         | Use an independent application identity, CLI names, protocol scheme, installer identity, and signing configuration. Check coexistence with an installed Orca.                                                         |
| Mobile installation       | `mobile/app.json` and native project configuration                                                              | Replace `com.stably.orca.mobile`, names, protocol scheme, icons, push credentials, and store destinations consistently.                                                                                               |
| Updates and releases      | `src/shared/release-channel.ts`, `src/main/updater/`, prerelease feeds, `.github/workflows`                     | Use Alfredlabs release destinations. Until configured, prevent the fork from downloading or publishing upstream releases.                                                                                             |
| Login and relay           | `src/main/orca-profiles/profile-cloud-auth-config.ts`, `cloud/apps/relay/`                                      | Replace `login.onorca.dev`, `relay.onorca.dev`, and the OAuth client with explicitly configured Alfredlabs services. Audit related hosted dependencies and credentials.                                               |
| Push notifications        | `src/main/runtime/push/push-gateway-origin.ts`, `cloud/apps/push/`, mobile notification configuration           | Replace `push.onorca.dev` and configure credentials for the fork's application identities.                                                                                                                            |
| Shared artifacts          | `src/main/artifacts/artifact-cloud-config.ts`, `src/shared/skill-share-link.ts`                                 | Replace `share.onorca.dev` and the upstream host allowlist with validated owned service configuration.                                                                                                                |
| Plugins and skills        | `src/shared/plugins/plugin-marketplace.ts`, `src/main/plugins/`, `src/shared/agent-feature-install-commands.ts` | Set an independent publisher/catalog and update provenance rules together; preserve explicit third-party provenance where retained.                                                                                   |
| Telemetry and diagnostics | `src/main/telemetry/`, `src/main/observability/`, build-time configuration                                      | Verify that no upstream write keys or collectors are enabled in fork releases. Existing telemetry is gated for official builds; inspect the actual fork artifact rather than assuming all source references transmit. |
| Product links             | Support, downloads, changelog, update nudges, plugin kill list, onboarding                                      | Replace upstream destinations or omit unavailable services; do not invent working Alfredlabs URLs.                                                                                                                    |
| Runtime data              | Profiles, keychain entries, sockets, daemon directories, CLI installation, workspace metadata                   | Isolate the fork's data and process identities. Provide an explicit migration path instead of silently sharing or overwriting the original installation.                                                              |

Changing a domain string alone is insufficient: authentication, URL validation,
trusted publisher checks, update signatures, and mobile identifiers depend on
these values. Keep each change consistent across desktop, mobile, headless hosts,
and remote execution.

## Initial implementation sequence

1. Use the confirmed identity: Alfred Workspace, maintained by Alfredlabs, with
   the public repository `GOI17/alfred-workspace`.
2. Create a separate repository and local checkout for Alfredlabs. Keep the
   upstream preparation worktree's shared Git configuration unchanged; changing
   its remotes would also affect sibling worktrees. Preserve upstream as a
   read-only source in the independent checkout. Keep inherited GitHub Actions
   disabled until publication targets and service ownership have been adapted.
3. Establish the new application identities and owned release destinations. Keep
   hosted functions explicitly unavailable until their own endpoints are ready,
   rather than silently falling back to upstream production services.
4. Replace the visible brand and documentation, preserving legal attribution and
   historical references where they explain provenance. Do not globally replace
   protocol strings, persisted keys, or third-party package names.
5. Configure and verify Alfredlabs authentication, relay, and push infrastructure.
   Disabling the upstream relay without a replacement removes remote mobile
   access; it is not a working relay migration.
6. Integrate the separately developed host-served mobile UI after reviewing its
   changes. Its relay reuse must work with the fork's service configuration.
7. Verify builds, installation coexistence, updates, required notices, and the
   desktop/mobile/remote user flows before publishing an Alfredlabs release.

## Evidence required before the first independent release

- An installed fork uses its own identifiers and does not overwrite Orca data.
- Update checks cannot install an upstream Orca release over the fork.
- Startup, login, mobile pairing, artifact sharing, plugins, and diagnostics use
  only intentionally configured services; unconfigured features explain that state.
- Relay-backed mobile access works against the intended Alfredlabs deployment.
- macOS, Linux, Windows, iOS, and Android configuration changes are checked for
  consistency; platform checks that were not run are reported explicitly.
- Distributed artifacts include their applicable copyright and license notices.

License reference: [Open Source Initiative — MIT](https://opensource.org/license/mit).

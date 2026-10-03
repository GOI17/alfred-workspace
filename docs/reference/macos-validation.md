# macOS validation

macOS on Apple Silicon (arm64) is the only currently supported application platform.
Intel Macs, Windows, Linux, iOS and Android are outside this release scope. SSH and paired remote work
remain in scope for the macOS client. GitHub Actions are disabled; run validation
locally with hidden Electron windows.

## Local packaging

Build the Apple Silicon package on an Apple Silicon Mac:

```sh
pnpm install --frozen-lockfile
ORCA_BACKGROUND_LAUNCH=1 ALFRED_BACKGROUND_LAUNCH=1 pnpm build:mac
```

Local packages use ad-hoc signing. They do not establish Developer ID,
notarization, Gatekeeper acceptance, or signed automatic-update compatibility.
The production path `pnpm build:mac:release` requires the Apple credentials
checked by `config/scripts/verify-macos-release-env.mjs`.

Verify a relocated package and its bundled CLI without installing over an
existing application:

```sh
ORCA_BACKGROUND_LAUNCH=1 ALFRED_BACKGROUND_LAUNCH=1 \
  node config/scripts/smoke-packaged-cli.mjs \
  --app-dir='dist/mac-arm64/Alfred workspace.app'
ORCA_BACKGROUND_LAUNCH=1 ALFRED_BACKGROUND_LAUNCH=1 \
  ALFRED_MACOS_PACKAGED_APP='dist/mac-arm64/Alfred workspace.app' \
  pnpm exec playwright test tests/e2e/macos-packaged-startup.spec.ts \
  --config tests/playwright.config.ts --project electron-headless --workers=1
```

Default packaging produces only arm64 DMG and ZIP artifacts. The release asset
check requires those artifacts, their blockmaps and `latest-mac.yml`.

## Acceptance record

Validated locally on 2026-10-03, macOS 26.6.2 (25G83) / Apple Silicon, source commit
`e4731a1bd` plus the validation changes in this PR.

- 413 contract and integration tests passed: CLI installation, updater behavior,
  package identity, SSH framing and encrypted runtime pairing.
- Production desktop build and universal native helper builds passed.
- Default macOS packaging completed with arm64 DMG and ZIP only, ad-hoc signed,
  version `1.4.197-local.1791010338007.e4731a1bdbfd`. The five required assets exist
  and both file sizes and SHA-512 hashes match `latest-mac.yml`.
- `hdiutil verify` accepted the DMG. It was mounted read-only without opening Finder;
  `codesign --verify --deep --strict` passed and the main executable reports arm64.
  The CLI and hidden startup checks below passed after copying the app from that DMG
  to disposable locations outside the source checkout. The volume was then detached.
- Five hidden Electron checks passed: branding, fresh startup, two paired desktop
  terminal/tab scenarios, and draft/checkpoint recovery during update installation.
- A real OpenSSH loopback connection passed the terminal and remote agent-status
  E2E test. The temporary server used key authentication and a disposable remote
  home; no system SSH settings were changed.
- The relocated production package loads its onboarding in an isolated profile
  with zero visible windows. The packaged CLI passes help, skill listing/reading,
  and install/update dry runs outside the source checkout.
- The packaged-startup test reuses the existing mock-keychain launch options.
  Its initial missing options caused a native Keychain prompt and blocked the test;
  the affected test process was terminated and the corrected test passed.
  This check does not validate the real macOS Keychain.
- 25 focused packaging, release-asset, daemon-load and launch-isolation tests passed after the
  changes (these overlap the broader contract suite).
- The packaging daemon-load guard hit its former 10-second timeout twice. A
  diagnostic run measured 9.85 seconds for a successful first load. The guard now
  allows 30 seconds and still rejects missing entries, missing imports and failure
  to reach argument parsing.
- Root typechecking passes. E2E typechecking retains its 204 existing diagnostics;
  neither the packaged-startup spec nor the launch-isolation changes add errors.
- The full changed-code quality gate passed with zero findings across 7,729 source
  files against `origin/main` (`4bd9a3eb68f6`).

Reproduce the source-app checks with:

```sh
ORCA_BACKGROUND_LAUNCH=1 ALFRED_BACKGROUND_LAUNCH=1 pnpm exec playwright test \
  tests/e2e/alfred-branding.spec.ts \
  tests/e2e/golden-posix-fresh-startup.spec.ts \
  tests/e2e/paired-cli-terminal-graph-sync-tab-retention.spec.ts \
  tests/e2e/update-install-renderer-checkpoint-recovery.spec.ts \
  --config tests/playwright.config.ts --project electron-headless --workers=1
```

The SSH test is `tests/e2e/ssh-localhost.spec.ts`. It requires a reachable local
SSH server and the environment variables `ALFRED_E2E_SSH_LOCALHOST=1`,
`ALFRED_FEATURE_REMOTE_AGENT_HOOKS=1`, `ALFRED_E2E_SSH_PORT`,
`ALFRED_E2E_SSH_USER` and `ALFRED_E2E_SSH_IDENTITY_FILE`. Use a disposable remote
home and retain the background-launch flags. This proves macOS-to-macOS loopback
execution, not a separate host, WAN reliability or other remote operating systems.

## Release prerequisites

- Developer ID and notarization credentials: `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `CSC_LINK`, `CSC_KEY_PASSWORD`.
- A signed prior Alfred version and a signed candidate for an actual install,
  update and relaunch cycle with persisted settings and live work.
- Alfred service configuration for pairing through the public relay; local
  loopback checks do not validate DNS, TLS, OAuth or deployed relay availability.
- Real Keychain storage and permission dialogs require a separate interactive session.
- Hardware/OS coverage beyond the local test machine must be recorded separately.

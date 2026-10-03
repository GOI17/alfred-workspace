---
name: alfred-emulator-android
description: >-
  Android device and emulator control from inside Alfred over adb, with the live
  device view in Alfred's emulator pane. Use when driving an adb-connected emulator
  or phone on Windows, Linux, or macOS: booting AVDs, taps, swipes, typing,
  hardware buttons, rotation, app install and launch, runtime permissions, the
  accessibility tree, and logcat. For an iOS simulator use the iOS emulator
  skill; build the APK with Gradle first.
license: Apache-2.0
---

# Alfred Emulator (Android)

This discovery stub loads the version-matched guide from the Alfred executable used for this session.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `ALFRED_CLI_COMMAND` environment variable is set, use its value. Alfred exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `ALFRED_DEV_REPO_ROOT`, use `alfred-dev`.
- Otherwise, on Linux outside an Alfred-managed terminal, use `alfred-ide`. Never run bare
  `alfred` there — outside Alfred's terminals it normally resolves to the
  GNOME Alfred screen reader (`/usr/bin/alfred`) and starts speech on the user's machine.
- Otherwise, use `alfred`.

Below, `ALFRED` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ALFRED` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Alfred build.

## Load the version-matched guide before running Alfred commands

```text
ALFRED skills get alfred-emulator-android
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Alfred is not running, start it with `ALFRED open --json`
and retry. If `skills get` is unknown, explain that updating Alfred restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.

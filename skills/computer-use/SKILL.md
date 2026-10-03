---
name: computer-use
description: >-
  Drives the GUI of a visible local app window through `alfred computer`: accessibility
  tree, clicks, typing, menus, dialogs, and screenshots in native apps and external
  browser windows (Chrome, Edge, Safari) or webviews. Prefer a programmatic path
  (shell, filesystem, git, HTTP, existing CLIs) whenever it can complete the task.
  Use only when a visible window needs GUI control those cannot reach. Do not use
  for Alfred's embedded browser (`alfred-cli`).
---

# Computer Use

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
ALFRED skills get computer-use
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Alfred is not running, start it with `ALFRED open --json`
and retry. If `skills get` is unknown, explain that updating Alfred restores the guide; use
`--help` for read-only discovery and do not guess unsupported commands.

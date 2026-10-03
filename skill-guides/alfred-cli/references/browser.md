# Built-in browser commands

Use a snapshot-interact-re-snapshot loop:

```text
ALFRED goto --url https://example.com --json
ALFRED snapshot --json
ALFRED click --element @e3 --json
ALFRED snapshot --json
```

Common commands:

```text
ALFRED goto --url <url> --json
ALFRED back --json
ALFRED reload --json
ALFRED snapshot --json
ALFRED screenshot --json
ALFRED full-screenshot --json
ALFRED pdf --json
ALFRED click --element <ref> --json
ALFRED fill --element <ref> --value <text> --json
ALFRED type --input <text> --json
ALFRED select --element <ref> --value <value> --json
ALFRED check --element <ref> --json
ALFRED scroll --direction down --amount 1000 --json
ALFRED hover --element <ref> --json
ALFRED focus --element <ref> --json
ALFRED keypress --key Enter --json
ALFRED upload --element <ref> --files <paths> --json
ALFRED wait --text <text> --json
ALFRED wait --url <substring> --json
ALFRED wait --selector <css> --json
ALFRED wait --load networkidle --json
ALFRED eval --expression <js> --json
ALFRED tab list --json
ALFRED tab create --url <url> --json
ALFRED tab switch --index <n> --json
ALFRED tab close --index <n> --json
ALFRED cookie get --json
ALFRED capture start --json
ALFRED console --limit 50 --json
ALFRED network --limit 50 --json
ALFRED exec --command "help" --json
```

Browser rules:

- Re-snapshot after navigation, tab switches, clicks that change the page, and any `browser_stale_ref`.
- Refs like `@e1` are assigned by `snapshot`, scoped to one tab, and invalidated by navigation or tab switch.
- Browser commands default to the current worktree and its active tab. Use `--worktree all` only intentionally.
- For concurrent browser work, run `ALFRED tab list --json`, read `tabs[].browserPageId`, and pass `--page <browserPageId>` on later commands.
- Use typed tab commands (`ALFRED tab list/create/close/switch`), not `ALFRED exec --command "tab ..."`, so Alfred keeps UI state synchronized.
- Prefer `wait --text`, `--url`, `--selector`, or `--load` after async page changes instead of bare timeouts.
- Anything not listed above goes through `ALFRED exec --command "<agent-browser command>"`.
- If `fill` or `type` fails on a custom input, try `ALFRED focus --element @e1 --json` then `ALFRED inserttext --text "text" --json`.
- A client-hosted page renders in the paired desktop's browser engine, so every command against it needs that desktop online and returns `browser_host_unavailable` while it is closed, asleep, or disconnected. Server-hosted pages run with no desktop attached; prefer them for long or unattended automation.

Common recoveries:

- `browser_no_tab`: open a tab with `ALFRED tab create --url <url> --json`.
- `browser_stale_ref`: run `ALFRED snapshot --json` and retry with fresh refs.
- `browser_tab_not_found`: run `ALFRED tab list --json` before switching or closing.
- `browser_host_unavailable`: the desktop hosting the page is offline. Bring it back, or recreate the page with server placement if the work must outlive the desktop session.

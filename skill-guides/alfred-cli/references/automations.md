# Automations

An automation is a scheduled Alfred prompt run by a chosen provider against either a repo-created worktree or an existing workspace.

```text
ALFRED automations list --json
ALFRED automations show <automationId> --json
ALFRED automations create --name "Daily review" --trigger daily --time 09:00 --prompt "Review open changes" --provider codex --repo id:<repoId> --json
ALFRED automations create --name "Weekday triage" --trigger "0 9 * * 1-5" --prompt "Triage issues" --provider claude --repo path:/abs/repo --disabled --json
ALFRED automations create --name "Inbox digest" --trigger hourly --prompt "Summarize unread mail" --provider codex --workspace active --reuse-session --json
ALFRED automations edit <automationId> --trigger weekdays --time 09:30 --fresh-session --json
ALFRED automations run <automationId> --json
ALFRED automations runs --id <automationId> --json
ALFRED automations remove <automationId> --json
```

Schedules accept `hourly`, `daily`, `weekdays`, `weekly`, 5-field cron, or RRULE. Use `--time <HH:MM>` with `daily`/`weekdays`/`weekly`, and `--day <0-6>` only with `weekly` where Sunday is `0`.

Use `--repo <selector>` for a new worktree per run, or `--workspace <selector>` / `--workspace-mode existing` for an existing Alfred worktree. `--repo` and `--workspace` are mutually exclusive. Use `--reuse-session` only for existing-workspace automations; if the previous terminal is gone, Alfred falls back to a fresh session. Prefer `--disabled` while testing setup.

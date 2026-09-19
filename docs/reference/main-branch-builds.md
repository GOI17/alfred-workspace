# Main branch builds

`Hourly macOS + Windows Dev Build` (`.github/workflows/hourly-mac-build.yml`) builds every push to
`main`, including merged pull requests and direct commits. A new push cancels
the previous run and its platform jobs. For three consecutive merges, the third
run builds the commit containing all three changes; earlier runs are cancelled
if they have not finished. Cancellation can take a short time to stop running
processes. A completed build is retained until its artifacts expire.

The existing Hourly workflow replaces its hourly schedule with pushes to main.
It uses one GitHub concurrency group, `hourly-mac-build`, with
`cancel-in-progress: true`. It can also be run manually from Actions; manual
runs share the same cancellation group and also build current main.
The preflight resolves main once; every platform checks out that same commit SHA.

For Alfred Workspace, download builds from **Actions → Hourly macOS + Windows Dev Build → the completed run →
Artifacts**. Artifacts expire after seven days and include the commit SHA in
their names:

- macOS arm64: ZIP containing the app.
- Windows x64: NSIS installer.

These are development builds without release signing or notarization. They use
the existing packaging scripts and identity; the remaining independent-fork
installation and update work is tracked in [the fork transition](../alfredlabs-fork.md).
The workflow uploads Actions artifacts with `--publish never` and does not need
upstream signing secrets or release-repository access. The upstream release jobs
remain restricted to `stablyai/orca`; Alfred Workspace uses its own artifact job
inside the same Hourly workflow.

## Activation

GitHub Actions was disabled for `GOI17/alfred-workspace` when this workflow was
adapted. Merge this change into `main`, disable the inherited workflows that
are not yet adapted to Alfredlabs, then enable Actions in the repository
settings and enable **Hourly macOS + Windows Dev Build**. Start the first build with
**Run workflow** on `main`; later pushes trigger it automatically.

See [GitHub's concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
for workflow cancellation behavior.

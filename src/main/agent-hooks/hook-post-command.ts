import type { AgentHookSource } from '../../shared/agent-hook-relay'
import { ALFRED_HOOK_RAW_JSON_TRANSPORT } from '../../shared/agent-hook-types'

export function buildPosixAgentHookPostCommand(
  source: AgentHookSource,
  options: { curlCommand?: string; indent?: string } = {}
): string[] {
  const curlCommand = options.curlCommand ?? 'curl'
  const indent = options.indent ?? '  '
  return [
    `if [ "\${ALFRED_AGENT_HOOK_TRANSPORT:-}" = "${ALFRED_HOOK_RAW_JSON_TRANSPORT}" ] && command -v base64 >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then`,
    `  alfred_hook_metadata=$(printf '%s\\037%s\\037%s\\037%s\\037%s\\037%s' "$ALFRED_PANE_KEY" "$ALFRED_TAB_ID" "$ALFRED_AGENT_LAUNCH_TOKEN" "$ALFRED_WORKTREE_ID" "$ALFRED_AGENT_HOOK_ENV" "$ALFRED_AGENT_HOOK_VERSION" | base64 | tr -d '\\n') && \\`,
    `  [ -n "$alfred_hook_metadata" ] && \\`,
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${ALFRED_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/json" \\`,
    `  ${indent}-H "X-Alfred-Agent-Hook-Token: \${ALFRED_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}-H "X-Alfred-Agent-Hook-Meta-Encoding: base64" \\`,
    `  ${indent}-H "X-Alfred-Agent-Hook-Meta: \${alfred_hook_metadata}" \\`,
    `  ${indent}--data-binary @-`,
    'else',
    `  printf '%s' "$payload" | ${curlCommand} -sS -X POST "http://127.0.0.1:\${ALFRED_AGENT_HOOK_PORT}/hook/${source}" \\`,
    `  ${indent}--connect-timeout "\${connect_timeout:-0.5}" --max-time "\${max_time:-1.5}" \\`,
    `  ${indent}--noproxy "127.0.0.1" \\`,
    `  ${indent}-H "Content-Type: application/x-www-form-urlencoded" \\`,
    `  ${indent}-H "X-Alfred-Agent-Hook-Token: \${ALFRED_AGENT_HOOK_TOKEN}" \\`,
    `  ${indent}--data-urlencode "paneKey=\${ALFRED_PANE_KEY}" \\`,
    `  ${indent}--data-urlencode "tabId=\${ALFRED_TAB_ID}" \\`,
    `  ${indent}--data-urlencode "launchToken=\${ALFRED_AGENT_LAUNCH_TOKEN}" \\`,
    `  ${indent}--data-urlencode "worktreeId=\${ALFRED_WORKTREE_ID}" \\`,
    `  ${indent}--data-urlencode "env=\${ALFRED_AGENT_HOOK_ENV}" \\`,
    `  ${indent}--data-urlencode "version=\${ALFRED_AGENT_HOOK_VERSION}" \\`,
    `  ${indent}--data-urlencode "payload@-"`,
    'fi'
  ]
}

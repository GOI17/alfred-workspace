export function pickRemoteCliEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of [
    'ALFRED_TERMINAL_HANDLE',
    'ALFRED_WORKTREE_ID',
    'ALFRED_PANE_KEY',
    'ALFRED_AGENT_LAUNCH_TOKEN',
    'ALFRED_WORKSPACE_ID',
    'ALFRED_USER_DATA_PATH',
    'PATH',
    'Path'
  ]) {
    const value = env[key]
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  return picked
}

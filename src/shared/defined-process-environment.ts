export function definedProcessEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  const defined: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      defined[key] = value
    }
  }
  return defined
}

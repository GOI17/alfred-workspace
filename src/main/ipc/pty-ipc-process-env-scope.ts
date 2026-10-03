// Why: the pty IPC suites force darwin and rewrite a dozen agent-home env vars per test;
// this scope captures the real values once and puts them back afterwards.
export function createPtyIpcProcessEnvScope() {
  const savedOpenCodeConfigDir = process.env.OPENCODE_CONFIG_DIR
  const savedAlfredOpenCodeConfigDir = process.env.ALFRED_OPENCODE_CONFIG_DIR
  const savedAlfredOpenCodeSourceConfigDir = process.env.ALFRED_OPENCODE_SOURCE_CONFIG_DIR
  const savedPiAgentDir = process.env.PI_CODING_AGENT_DIR
  const savedAlfredPiAgentDir = process.env.ALFRED_PI_CODING_AGENT_DIR
  const savedAlfredPiSourceAgentDir = process.env.ALFRED_PI_SOURCE_AGENT_DIR
  const savedAlfredCodexHome = process.env.ALFRED_CODEX_HOME
  const savedAlfredOmpAgentDir = process.env.ALFRED_OMP_CODING_AGENT_DIR
  const savedAlfredOmpSourceAgentDir = process.env.ALFRED_OMP_SOURCE_AGENT_DIR
  const savedAlfredOmpStatusExtension = process.env.ALFRED_OMP_STATUS_EXTENSION
  const savedPrimeAgentDir = process.env.PRIME_AGENT_CODING_AGENT_DIR
  const savedAlfredPrimeAgentSourceDir = process.env.ALFRED_PRIME_AGENT_SOURCE_AGENT_DIR
  const savedAlfredPrimeAgentStatusExtension = process.env.ALFRED_PRIME_AGENT_STATUS_EXTENSION
  const savedAlfredClaudeAgentStatusSettings = process.env.ALFRED_CLAUDE_AGENT_STATUS_SETTINGS
  const savedProcessPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  const savedDisableMacosLoginShell = process.env.ALFRED_DISABLE_MACOS_LOGIN_SHELL
  const savedAlfredUserDataPath = process.env.ALFRED_USER_DATA_PATH

  function applyTestEnvDefaults() {
    // Why: most PTY spawn tests assert POSIX shell behavior; Windows cases opt into win32 explicitly below.
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'darwin'
    })
    // Why: forced darwin makes the TCC login(1) wrapper rewrite every asserted argv; its own test below re-enables it.
    process.env.ALFRED_DISABLE_MACOS_LOGIN_SHELL = '1'
    delete process.env.OPENCODE_CONFIG_DIR
    delete process.env.ALFRED_OPENCODE_SOURCE_CONFIG_DIR
    delete process.env.ALFRED_OPENCODE_CONFIG_DIR
    delete process.env.ALFRED_AGENT_HOOK_ENDPOINT
    delete process.env.ALFRED_CLAUDE_AGENT_STATUS_SETTINGS
    delete process.env.PI_CODING_AGENT_DIR
    delete process.env.ALFRED_PI_SOURCE_AGENT_DIR
    delete process.env.ALFRED_PI_CODING_AGENT_DIR
    delete process.env.ALFRED_CODEX_HOME
    delete process.env.ALFRED_OMP_SOURCE_AGENT_DIR
    delete process.env.ALFRED_OMP_CODING_AGENT_DIR
    delete process.env.ALFRED_OMP_STATUS_EXTENSION
    delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    delete process.env.ALFRED_PRIME_AGENT_SOURCE_AGENT_DIR
    delete process.env.ALFRED_PRIME_AGENT_STATUS_EXTENSION
  }

  function restoreProcessEnv() {
    if (savedProcessPlatform) {
      Object.defineProperty(process, 'platform', savedProcessPlatform)
    }
    if (savedDisableMacosLoginShell !== undefined) {
      process.env.ALFRED_DISABLE_MACOS_LOGIN_SHELL = savedDisableMacosLoginShell
    } else {
      delete process.env.ALFRED_DISABLE_MACOS_LOGIN_SHELL
    }
    if (savedAlfredUserDataPath !== undefined) {
      process.env.ALFRED_USER_DATA_PATH = savedAlfredUserDataPath
    } else {
      delete process.env.ALFRED_USER_DATA_PATH
    }
    if (savedOpenCodeConfigDir !== undefined) {
      process.env.OPENCODE_CONFIG_DIR = savedOpenCodeConfigDir
    } else {
      delete process.env.OPENCODE_CONFIG_DIR
    }
    if (savedAlfredOpenCodeConfigDir !== undefined) {
      process.env.ALFRED_OPENCODE_CONFIG_DIR = savedAlfredOpenCodeConfigDir
    } else {
      delete process.env.ALFRED_OPENCODE_CONFIG_DIR
    }
    if (savedAlfredOpenCodeSourceConfigDir !== undefined) {
      process.env.ALFRED_OPENCODE_SOURCE_CONFIG_DIR = savedAlfredOpenCodeSourceConfigDir
    } else {
      delete process.env.ALFRED_OPENCODE_SOURCE_CONFIG_DIR
    }
    if (savedPiAgentDir !== undefined) {
      process.env.PI_CODING_AGENT_DIR = savedPiAgentDir
    } else {
      delete process.env.PI_CODING_AGENT_DIR
    }
    if (savedAlfredPiAgentDir !== undefined) {
      process.env.ALFRED_PI_CODING_AGENT_DIR = savedAlfredPiAgentDir
    } else {
      delete process.env.ALFRED_PI_CODING_AGENT_DIR
    }
    if (savedAlfredPiSourceAgentDir === undefined) {
      delete process.env.ALFRED_PI_SOURCE_AGENT_DIR
    } else {
      process.env.ALFRED_PI_SOURCE_AGENT_DIR = savedAlfredPiSourceAgentDir
    }
    if (savedAlfredCodexHome === undefined) {
      delete process.env.ALFRED_CODEX_HOME
    } else {
      process.env.ALFRED_CODEX_HOME = savedAlfredCodexHome
    }
    if (savedAlfredOmpAgentDir !== undefined) {
      process.env.ALFRED_OMP_CODING_AGENT_DIR = savedAlfredOmpAgentDir
    } else {
      delete process.env.ALFRED_OMP_CODING_AGENT_DIR
    }
    if (savedAlfredOmpSourceAgentDir !== undefined) {
      process.env.ALFRED_OMP_SOURCE_AGENT_DIR = savedAlfredOmpSourceAgentDir
    } else {
      delete process.env.ALFRED_OMP_SOURCE_AGENT_DIR
    }
    if (savedAlfredOmpStatusExtension !== undefined) {
      process.env.ALFRED_OMP_STATUS_EXTENSION = savedAlfredOmpStatusExtension
    } else {
      delete process.env.ALFRED_OMP_STATUS_EXTENSION
    }
    if (savedPrimeAgentDir !== undefined) {
      process.env.PRIME_AGENT_CODING_AGENT_DIR = savedPrimeAgentDir
    } else {
      delete process.env.PRIME_AGENT_CODING_AGENT_DIR
    }
    if (savedAlfredPrimeAgentSourceDir !== undefined) {
      process.env.ALFRED_PRIME_AGENT_SOURCE_AGENT_DIR = savedAlfredPrimeAgentSourceDir
    } else {
      delete process.env.ALFRED_PRIME_AGENT_SOURCE_AGENT_DIR
    }
    if (savedAlfredPrimeAgentStatusExtension !== undefined) {
      process.env.ALFRED_PRIME_AGENT_STATUS_EXTENSION = savedAlfredPrimeAgentStatusExtension
    } else {
      delete process.env.ALFRED_PRIME_AGENT_STATUS_EXTENSION
    }
    if (savedAlfredClaudeAgentStatusSettings === undefined) {
      delete process.env.ALFRED_CLAUDE_AGENT_STATUS_SETTINGS
    } else {
      process.env.ALFRED_CLAUDE_AGENT_STATUS_SETTINGS = savedAlfredClaudeAgentStatusSettings
    }
  }

  return { applyTestEnvDefaults, restoreProcessEnv }
}

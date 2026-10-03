import { basename, win32 as pathWin32 } from 'node:path'

export const POSIX_SHELL_STARTUP_COMMAND_ENV = 'ALFRED_POSIX_SHELL_STARTUP_COMMAND'

export function supportsPosixShellStartupCommand(shellPath: string): boolean {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()
  return shellName === 'bash' || shellName === 'zsh' || shellName === 'fish'
}

export function getBashStartupCommandPromptBlock(): string {
  return `if [[ \${${POSIX_SHELL_STARTUP_COMMAND_ENV}+present} == present ]]; then
  __alfred_remove_startup_command_prompt_hook() {
    local __alfred_item
    local -a __alfred_remaining=()
    if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
      for __alfred_item in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
        [[ "$__alfred_item" == "__alfred_run_startup_command" ]] || __alfred_remaining+=("$__alfred_item")
      done
      PROMPT_COMMAND=("\${__alfred_remaining[@]+"\${__alfred_remaining[@]}"}")
    else
      for __alfred_item in "\${__alfred_prompt_command_suffix[@]+"\${__alfred_prompt_command_suffix[@]}"}"; do
        [[ "$__alfred_item" == "__alfred_run_startup_command" ]] || __alfred_remaining+=("$__alfred_item")
      done
      __alfred_prompt_command_suffix=("\${__alfred_remaining[@]+"\${__alfred_remaining[@]}"}")
    fi
  }
  __alfred_run_startup_command() {
    local __alfred_command="$${POSIX_SHELL_STARTUP_COMMAND_ENV}" __alfred_status
    unset ${POSIX_SHELL_STARTUP_COMMAND_ENV}
    __alfred_remove_startup_command_prompt_hook
    unset -f __alfred_remove_startup_command_prompt_hook
    builtin history -s "$__alfred_command" 2>/dev/null || true
    builtin printf '%s\n' "$__alfred_command"
    eval "$__alfred_command"
    __alfred_status=$?
    unset -f __alfred_run_startup_command
    return "$__alfred_status"
  }
  __alfred_append_prompt_command "__alfred_run_startup_command"
fi`
}

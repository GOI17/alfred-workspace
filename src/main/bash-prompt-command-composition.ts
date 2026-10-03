export const BASH_PROMPT_COMMAND_COMPOSITION_BLOCK = `__alfred_normalize_prompt_command_part() {
  local __alfred_value="$1" __alfred_output_name="$2" __alfred_character __alfred_chunk
  local __alfred_value_length=\${#1} __alfred_suffix_length=0 __alfred_backslash_length=0
  local __alfred_output_length __alfred_scan_start
  while (( __alfred_value_length - __alfred_suffix_length >= 1024 )); do
    __alfred_scan_start=$(( __alfred_value_length - __alfred_suffix_length - 1024 ))
    __alfred_chunk="\${__alfred_value:__alfred_scan_start:1024}"
    case "$__alfred_chunk" in
      *[!$' \\t\\n;']*) break ;;
      *) __alfred_suffix_length=$(( __alfred_suffix_length + 1024 )) ;;
    esac
  done
  while (( __alfred_suffix_length < __alfred_value_length )); do
    __alfred_character="\${__alfred_value: -__alfred_suffix_length - 1:1}"
    case "$__alfred_character" in
      ' '|$'\\t'|$'\\n'|';') __alfred_suffix_length=$(( __alfred_suffix_length + 1 )) ;;
      *) break ;;
    esac
  done
  __alfred_output_length=$(( \${#__alfred_value} - __alfred_suffix_length ))
  while (( __alfred_output_length - __alfred_backslash_length >= 1024 )); do
    __alfred_scan_start=$(( __alfred_output_length - __alfred_backslash_length - 1024 ))
    __alfred_chunk="\${__alfred_value:__alfred_scan_start:1024}"
    case "$__alfred_chunk" in
      *[!\\\\]*) break ;;
      *) __alfred_backslash_length=$(( __alfred_backslash_length + 1024 )) ;;
    esac
  done
  while (( __alfred_backslash_length < __alfred_output_length )); do
    __alfred_character="\${__alfred_value:__alfred_output_length - __alfred_backslash_length - 1:1}"
    [[ "$__alfred_character" == '\\' ]] || break
    __alfred_backslash_length=$(( __alfred_backslash_length + 1 ))
  done
  # Preserve the first separator when an odd backslash run escapes it.
  if (( __alfred_suffix_length > 0 && __alfred_backslash_length % 2 == 1 )); then
    __alfred_suffix_length=$(( __alfred_suffix_length - 1 ))
    __alfred_backslash_length=0
  fi
  __alfred_output_length=$(( \${#__alfred_value} - __alfred_suffix_length ))
  __alfred_value="\${__alfred_value:0:__alfred_output_length}"
  # Bash 4.4-5.0 scalar prompt evaluation preserves an odd terminal backslash.
  if (( __alfred_suffix_length == 0 && ((BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] == 0)) && __alfred_backslash_length % 2 == 1 )); then
    __alfred_value="$__alfred_value\\\\"
  fi
  printf -v "$__alfred_output_name" '%s' "$__alfred_value"
}
__alfred_restore_prompt_status() {
  return "$1"
}
__alfred_update_user_debug_trap() {
  local __alfred_debug_trap_spec="$1" __alfred_unchanged_debug_trap_spec="$2"
  local __alfred_debug_trap_command
  [[ "$__alfred_debug_trap_spec" != "$__alfred_unchanged_debug_trap_spec" ]] || return 0
  [[ "$__alfred_debug_trap_spec" != "trap -- '__alfred_osc133_preexec' DEBUG" ]] || return 0
  if [[ -z "$__alfred_debug_trap_spec" ]]; then
    __alfred_user_debug_trap=""
    unset __alfred_chained_debug_trap
    return 0
  fi
  __alfred_debug_trap_command="\${__alfred_debug_trap_spec#trap -- }"
  __alfred_debug_trap_command="\${__alfred_debug_trap_command% DEBUG}"
  eval "__alfred_user_debug_trap=$__alfred_debug_trap_command"
  unset __alfred_chained_debug_trap
}
__alfred_run_user_debug_trap() {
  if [[ -n "\${__alfred_user_debug_trap:-}" ]]; then
    eval "$__alfred_user_debug_trap" || true
  fi
}
__alfred_adopt_outer_debug_trap() {
  local __alfred_debug_trap_spec="\${__alfred_outer_debug_trap_spec:-}"
  unset __alfred_outer_debug_trap_spec
  __alfred_update_user_debug_trap "$__alfred_debug_trap_spec" "trap -- '__alfred_osc133_preexec' DEBUG"
}
__alfred_run_prompt_command_array() {
  local __alfred_exit_code="\${__alfred_prompt_status:-$?}" __alfred_prompt_part __alfred_prompt_index __alfred_user_count
  local __alfred_suffix_part
  local __alfred_final_prompt_command
  local __alfred_in_prompt_dispatch=1 __alfred_dispatching_user_prompt_command=""
  unset __alfred_prompt_status
  __alfred_adopt_outer_debug_trap
  trap '__alfred_osc133_preexec' DEBUG
  for __alfred_prompt_part in "\${__alfred_prompt_command_prefix[@]+"\${__alfred_prompt_command_prefix[@]}"}"; do
    if (( __alfred_exit_code == 0 )); then
      eval "$__alfred_prompt_part"
    else
      __alfred_restore_prompt_status "$__alfred_exit_code" || eval "$__alfred_prompt_part"
    fi
  done
  __alfred_user_count=0
  for __alfred_prompt_part in "\${__alfred_prompt_command_array[@]+"\${__alfred_prompt_command_array[@]}"}"; do
    __alfred_user_count=$(( __alfred_user_count + 1 ))
  done
  for (( __alfred_prompt_index = 0; __alfred_prompt_index + 1 < __alfred_user_count; __alfred_prompt_index++ )); do
    __alfred_prompt_part="\${__alfred_prompt_command_array[__alfred_prompt_index]}"
    __alfred_dispatching_user_prompt_command=1
    if (( __alfred_exit_code == 0 )); then
      eval "$__alfred_prompt_part"
    else
      __alfred_restore_prompt_status "$__alfred_exit_code" || eval "$__alfred_prompt_part"
    fi
    __alfred_dispatching_user_prompt_command=""
  done
  if (( __alfred_user_count > 0 )); then
    __alfred_prompt_part="\${__alfred_prompt_command_array[__alfred_user_count - 1]}"
    # Why: keep the final user hook and Alfred suffixes in one status-preserving eval.
    __alfred_final_prompt_command='eval "$__alfred_prompt_part"'
    for __alfred_suffix_part in "\${__alfred_prompt_command_suffix[@]+"\${__alfred_prompt_command_suffix[@]}"}"; do
      __alfred_final_prompt_command+=$'\\n'"$__alfred_suffix_part"
    done
    __alfred_dispatching_user_prompt_command=1
    if (( __alfred_exit_code == 0 )); then
      eval "$__alfred_final_prompt_command"
    else
      __alfred_restore_prompt_status "$__alfred_exit_code" || eval "$__alfred_final_prompt_command"
    fi
    __alfred_dispatching_user_prompt_command=""
  else
    for __alfred_prompt_part in "\${__alfred_prompt_command_suffix[@]+"\${__alfred_prompt_command_suffix[@]}"}"; do
      if (( __alfred_exit_code == 0 )); then
        eval "$__alfred_prompt_part"
      else
        __alfred_restore_prompt_status "$__alfred_exit_code" || eval "$__alfred_prompt_part"
      fi
    done
  fi
  return "$__alfred_exit_code"
}
__alfred_finish_legacy_prompt_dispatch() {
  local __alfred_suffix_part
  if [[ -n "\${__alfred_in_prompt_command:-}" ]]; then
    for __alfred_suffix_part in "\${__alfred_prompt_command_suffix[@]+"\${__alfred_prompt_command_suffix[@]}"}"; do
      eval "$__alfred_suffix_part"
    done
  fi
  trap '__alfred_osc133_preexec' DEBUG
  unset __alfred_in_legacy_prompt_wrapper
}
__alfred_normalize_prompt_command() {
  [[ -z "\${__alfred_prompt_command_normalized:-}" ]] || return 0
  local __alfred_prompt_part
  local -a __alfred_normalized=()
  for __alfred_prompt_part in "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}"; do
    __alfred_normalize_prompt_command_part "$__alfred_prompt_part" __alfred_prompt_part
    [[ -n "$__alfred_prompt_part" ]] && __alfred_normalized+=("$__alfred_prompt_part")
  done
  __alfred_prompt_command_normalized=1
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("\${__alfred_normalized[@]+"\${__alfred_normalized[@]}"}")
  else
    __alfred_prompt_command_array=("\${__alfred_normalized[@]+"\${__alfred_normalized[@]}"}")
    __alfred_prompt_command_prefix=()
    __alfred_prompt_command_suffix=()
    unset PROMPT_COMMAND
    # Why: PID scope distinguishes legacy prompt dispatch from ordinary user command text.
    __alfred_prompt_status_variable="__alfred_prompt_status_$$"
    __alfred_prompt_status_capture_command="$__alfred_prompt_status_variable=\\$?"
    __alfred_prompt_status_value="\\\${$__alfred_prompt_status_variable}"
    PROMPT_COMMAND="$__alfred_prompt_status_capture_command; __alfred_prompt_status=$__alfred_prompt_status_value"'; __alfred_prompt_had_functrace=""; if [[ -o functrace ]]; then __alfred_prompt_had_functrace=1; set +T; fi; __alfred_outer_debug_trap_spec="$(trap -p DEBUG)"; [[ -z "$__alfred_prompt_had_functrace" ]] || set -T; unset __alfred_prompt_had_functrace; __alfred_run_prompt_command_array; __alfred_finish_legacy_prompt_dispatch'
  fi
}
__alfred_prepend_prompt_command() {
  local command="$1"
  __alfred_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND=("$command" "\${PROMPT_COMMAND[@]+"\${PROMPT_COMMAND[@]}"}")
  else
    __alfred_prompt_command_prefix=("$command" "\${__alfred_prompt_command_prefix[@]+"\${__alfred_prompt_command_prefix[@]}"}")
  fi
}
__alfred_append_prompt_command() {
  local command="$1"
  __alfred_normalize_prompt_command
  if (( BASH_VERSINFO[0] > 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] >= 1) )); then
    PROMPT_COMMAND+=("$command")
  else
    __alfred_prompt_command_suffix+=("$command")
  fi
}`

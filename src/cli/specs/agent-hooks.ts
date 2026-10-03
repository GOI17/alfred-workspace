import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: 'Repair Alfred-managed Codex hook trust before a shell launch',
    usage: 'alfred agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Alfred-managed agent status hooks are enabled',
    usage: 'alfred agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['alfred agent hooks status', 'alfred agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Alfred-managed agent status hooks and remove local hook entries',
    usage: 'alfred agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['alfred agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Alfred-managed agent status hooks',
    usage: 'alfred agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['alfred agent hooks on']
  }
]

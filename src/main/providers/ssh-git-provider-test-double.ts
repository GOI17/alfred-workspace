import type { SshGitProvider } from './ssh-git-provider'
export function createSshGitProviderTestDouble(methods: Partial<SshGitProvider>): SshGitProvider {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: SSH tests provide checked operations without constructing a network connection or the provider's private caches.
  return methods as SshGitProvider
}

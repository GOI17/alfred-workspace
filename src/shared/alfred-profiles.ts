import { ALFRED_BROWSER_PARTITION } from './constants'
import type { ExecutionHostId } from './execution-host'

export const ALFRED_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_ALFRED_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_ALFRED_PROFILE_NAME = 'Personal'
/** Main -> renderer push when the stored auth status changed without the renderer asking. */
export const ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL = 'alfredProfiles:authStatusChanged'
const LEGACY_ALFRED_BROWSER_SESSION_PARTITION_PREFIX = 'persist:alfred-browser-session-'

export type AlfredProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type AlfredProfileKind = 'local' | 'cloud-linked'

export type AlfredProfileCloudSummary = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId?: string
  activeOrgName?: string
  linkedAt: number
}

export type AlfredCloudOrgSummary = {
  orgId: string
  name: string
  role?: string
}

export type AlfredCloudCapabilityFlags = Record<string, boolean>

export type AlfredCloudCapabilities = {
  flags: AlfredCloudCapabilityFlags
  refreshedAt: number
}

export type AlfredCloudSessionPersistence = 'none' | 'encrypted' | 'memory-only' | 'dev-plaintext'

export type AlfredProfileAuthState = 'local' | 'unconfigured' | 'connected' | 'reconnect-required'

export type AlfredProfileAuthStatus = {
  activeProfileId: string
  configured: boolean
  state: AlfredProfileAuthState
  persistence: AlfredCloudSessionPersistence
  cloud?: AlfredProfileCloudSummary
  organizations?: AlfredCloudOrgSummary[]
  capabilities?: AlfredCloudCapabilities
  credentialError?: string
  setupMessage?: string
}

export type AlfredProfileSummary = {
  id: string
  name: string
  avatar: AlfredProfileAvatar
  kind: AlfredProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  cloud?: AlfredProfileCloudSummary
}

export type AlfredProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: AlfredProfileSummary[]
}

export type AlfredProfileListState = {
  activeProfileId: string
  profiles: AlfredProfileSummary[]
}

export type AlfredProfileListResult = AlfredProfileListState & {
  // Why: gates the full multi-profile switcher UI; default builds show a
  // single-profile account menu instead.
  multiProfileUi: boolean
}

export type CreateLocalAlfredProfileArgs = {
  name?: string
}

export type CreateLocalAlfredProfileResult = AlfredProfileListState & {
  profile: AlfredProfileSummary
}

export type CreateCloudLinkedAlfredProfileArgs = {
  orgId?: string
  name?: string
}

export type SwitchAlfredProfileArgs = {
  profileId: string
}

export type SwitchAlfredProfileResult = {
  status: 'already-active' | 'relaunching'
}

export type TransferAlfredProfileProjectMode = 'move' | 'copy'

export type TransferAlfredProfileProjectArgs = {
  sourceProfileId: string
  targetProfileId: string
  repoId: string
  mode: TransferAlfredProfileProjectMode
}

export type FindAlfredProfileProjectsByPathArgs = {
  path: string
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
  excludeProfileId?: string | null
}

export type AlfredProfileProjectPresence = {
  profileId: string
  profileName: string
  profileKind: AlfredProfileKind
  repoId: string
  repoName: string
}

export type FindAlfredProfileProjectsByPathResult = {
  projects: AlfredProfileProjectPresence[]
}

export type TransferAlfredProfileProjectResult =
  | {
      status: 'transferred'
      mode: TransferAlfredProfileProjectMode
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      targetRepoId: string
      targetProjectId: string | null
      willRelaunch?: boolean
    }
  | {
      status: 'duplicate-target'
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      duplicateRepoId: string
    }

export type ConnectCurrentAlfredProfileResult =
  | {
      status: 'connected'
      auth: AlfredProfileAuthStatus
      activeProfileId: string
      profiles: AlfredProfileSummary[]
    }
  | {
      status: 'unconfigured'
      auth: AlfredProfileAuthStatus
    }
  | {
      status: 'cancelled'
      auth: AlfredProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AlfredProfileAuthStatus
      error: string
    }

export type CreateCloudLinkedAlfredProfileResult =
  | {
      status: 'created'
      auth: AlfredProfileAuthStatus
      activeProfileId: string
      profiles: AlfredProfileSummary[]
      profile: AlfredProfileSummary
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: AlfredProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AlfredProfileAuthStatus
      error: string
    }

export type SignOutCurrentAlfredProfileResult = {
  status: 'signed-out'
  auth: AlfredProfileAuthStatus
  activeProfileId: string
  profiles: AlfredProfileSummary[]
}

export type SelectAlfredProfileOrgArgs = {
  orgId: string
}

export type SelectAlfredProfileOrgResult =
  | {
      status: 'selected'
      auth: AlfredProfileAuthStatus
      activeProfileId: string
      profiles: AlfredProfileSummary[]
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: AlfredProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AlfredProfileAuthStatus
      error: string
    }

export type RefreshCurrentAlfredProfileAuthResult =
  | {
      status: 'refreshed'
      auth: AlfredProfileAuthStatus
      activeProfileId: string
      profiles: AlfredProfileSummary[]
    }
  | {
      status: 'local' | 'unconfigured' | 'reconnect-required'
      auth: AlfredProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AlfredProfileAuthStatus
      error: string
    }

// Why: organization roles are a fixed server-side enum; the desktop UI mirrors
// exactly these three so role selects can't drift from what the API accepts.
export type AlfredOrgRole = 'owner' | 'admin' | 'member'

export type AlfredOrgMember = {
  // Why: null for teammates provisioned server-side who never signed into Alfred;
  // mutation actions are disabled for them since the API keys on a real userId.
  userId: string | null
  email: string
  displayName?: string
  role: AlfredOrgRole
}

export type AlfredOrgPendingInvite = {
  email: string
  role: AlfredOrgRole
  createdAt: number
}

export type AlfredOrgMembersRoster = {
  members: AlfredOrgMember[]
  pendingInvites: AlfredOrgPendingInvite[]
  viewerRole: AlfredOrgRole
  canManageMembers: boolean
}

export type AlfredProfileOrgMembersListArgs = {
  orgId: string
}

export type AlfredProfileOrgMemberInviteArgs = {
  orgId: string
  email: string
  role: AlfredOrgRole
}

export type AlfredProfileOrgInviteRevokeArgs = {
  orgId: string
  email: string
}

export type AlfredProfileOrgMemberChangeRoleArgs = {
  orgId: string
  userId: string
  role: AlfredOrgRole
}

export type AlfredProfileOrgMemberRemoveArgs = {
  orgId: string
  userId: string
}

export type AlfredProfileOrgMembersListResult =
  | { status: 'ok'; roster: AlfredOrgMembersRoster }
  | { status: 'unconfigured' | 'reconnect-required' }
  | { status: 'failed'; error: string }

export type AlfredOrgInviteConflictReason = 'already_member' | 'already_invited'
export type AlfredOrgMutationInvalidReason = 'cannot_change_own_role' | 'cannot_remove_self'

export type AlfredProfileOrgMemberMutationResult =
  | { status: 'ok' }
  | { status: 'unconfigured' | 'reconnect-required' | 'forbidden' | 'not-found' }
  | { status: 'conflict'; reason: AlfredOrgInviteConflictReason }
  | { status: 'invalid'; reason: AlfredOrgMutationInvalidReason }
  | { status: 'failed'; error: string }

export function createDefaultLocalAlfredProfile(now: number): AlfredProfileSummary {
  return {
    id: DEFAULT_LOCAL_ALFRED_PROFILE_ID,
    name: DEFAULT_LOCAL_ALFRED_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getAlfredProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getAlfredProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_ALFRED_PROFILE_ID) {
    return ALFRED_BROWSER_PARTITION
  }
  return `persist:alfred-profile-${getAlfredProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getAlfredProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_ALFRED_PROFILE_ID) {
    return `${LEGACY_ALFRED_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:alfred-profile-${getAlfredProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}

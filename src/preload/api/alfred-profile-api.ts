import type {
  ConnectCurrentAlfredProfileResult,
  CreateCloudLinkedAlfredProfileArgs,
  CreateCloudLinkedAlfredProfileResult,
  CreateLocalAlfredProfileArgs,
  CreateLocalAlfredProfileResult,
  FindAlfredProfileProjectsByPathArgs,
  FindAlfredProfileProjectsByPathResult,
  AlfredProfileAuthStatus,
  AlfredProfileListResult,
  AlfredProfileOrgInviteRevokeArgs,
  AlfredProfileOrgMemberChangeRoleArgs,
  AlfredProfileOrgMemberInviteArgs,
  AlfredProfileOrgMemberMutationResult,
  AlfredProfileOrgMemberRemoveArgs,
  AlfredProfileOrgMembersListArgs,
  AlfredProfileOrgMembersListResult,
  RefreshCurrentAlfredProfileAuthResult,
  SelectAlfredProfileOrgArgs,
  SelectAlfredProfileOrgResult,
  SignOutCurrentAlfredProfileResult,
  SwitchAlfredProfileArgs,
  SwitchAlfredProfileResult,
  TransferAlfredProfileProjectArgs,
  TransferAlfredProfileProjectResult
} from '../../shared/alfred-profiles'

export type AlfredProfileApi = {
  list: () => Promise<AlfredProfileListResult>
  authStatus: () => Promise<AlfredProfileAuthStatus>
  /** Fires when main changed the stored auth status on its own (e.g. a revoked session). */
  onAuthStatusChanged: (callback: () => void) => () => void
  createLocal: (args?: CreateLocalAlfredProfileArgs) => Promise<CreateLocalAlfredProfileResult>
  createCloudLinked: (
    args?: CreateCloudLinkedAlfredProfileArgs
  ) => Promise<CreateCloudLinkedAlfredProfileResult>
  switchProfile: (args: SwitchAlfredProfileArgs) => Promise<SwitchAlfredProfileResult>
  transferProject: (
    args: TransferAlfredProfileProjectArgs
  ) => Promise<TransferAlfredProfileProjectResult>
  findProjectProfiles: (
    args: FindAlfredProfileProjectsByPathArgs
  ) => Promise<FindAlfredProfileProjectsByPathResult>
  connectCurrent: () => Promise<ConnectCurrentAlfredProfileResult>
  refreshAuth: () => Promise<RefreshCurrentAlfredProfileAuthResult>
  signOutCurrent: () => Promise<SignOutCurrentAlfredProfileResult>
  selectOrg: (args: SelectAlfredProfileOrgArgs) => Promise<SelectAlfredProfileOrgResult>
  orgMembersList: (
    args: AlfredProfileOrgMembersListArgs
  ) => Promise<AlfredProfileOrgMembersListResult>
  orgMemberInvite: (
    args: AlfredProfileOrgMemberInviteArgs
  ) => Promise<AlfredProfileOrgMemberMutationResult>
  orgInviteRevoke: (
    args: AlfredProfileOrgInviteRevokeArgs
  ) => Promise<AlfredProfileOrgMemberMutationResult>
  orgMemberChangeRole: (
    args: AlfredProfileOrgMemberChangeRoleArgs
  ) => Promise<AlfredProfileOrgMemberMutationResult>
  orgMemberRemove: (
    args: AlfredProfileOrgMemberRemoveArgs
  ) => Promise<AlfredProfileOrgMemberMutationResult>
}

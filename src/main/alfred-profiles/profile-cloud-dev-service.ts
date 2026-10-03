import type {
  CreateCloudLinkedAlfredProfileArgs,
  AlfredProfileListState
} from '../../shared/alfred-profiles'
import type { ActiveAlfredProfileState } from './profile-index-store'
import {
  createCloudLinkedAlfredProfileRecord,
  linkAlfredProfileToCloud
} from './profile-cloud-index'
import {
  readAlfredCloudSession,
  saveAlfredCloudSessionExchange
} from './profile-cloud-session-store'
import { createDevAlfredCloudSession } from './profile-cloud-dev-auth'

type DevProfileListResult = AlfredProfileListState

type DevCreateProfileResult =
  | {
      status: 'created'
      list: ReturnType<typeof createCloudLinkedAlfredProfileRecord>
    }
  | { status: 'reconnect-required' }

type DevMutationResult =
  | {
      status: 'updated'
      list: DevProfileListResult
    }
  | { status: 'reconnect-required' }

export function connectDevAlfredCloudProfile(
  active: ActiveAlfredProfileState,
  userDataPath: string
): DevProfileListResult {
  const session = createDevAlfredCloudSession({ localProfileId: active.profile.id })
  saveAlfredCloudSessionExchange(active.profile.id, userDataPath, session)
  return linkAlfredProfileToCloud(active.profile.id, session.cloud, userDataPath)
}

export function createDevCloudLinkedAlfredProfile(
  active: ActiveAlfredProfileState,
  userDataPath: string,
  args: CreateCloudLinkedAlfredProfileArgs
): DevCreateProfileResult {
  if (readAlfredCloudSession(active.profile.id, userDataPath).status !== 'found') {
    return { status: 'reconnect-required' }
  }
  const session = createDevAlfredCloudSession({ orgId: args.orgId })
  const list = createCloudLinkedAlfredProfileRecord(
    session.cloud,
    { name: args.name },
    userDataPath
  )
  saveAlfredCloudSessionExchange(list.profile.id, userDataPath, session)
  return { status: 'created', list }
}

export function refreshDevAlfredCloudProfile(
  active: ActiveAlfredProfileState,
  userDataPath: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readAlfredCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevAlfredCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId: active.profile.cloud.activeOrgId
  })
  saveAlfredCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkAlfredProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}

export function selectDevAlfredCloudOrg(
  active: ActiveAlfredProfileState,
  userDataPath: string,
  orgId: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readAlfredCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevAlfredCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId
  })
  saveAlfredCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkAlfredProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}

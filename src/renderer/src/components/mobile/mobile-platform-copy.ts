import type { Platform } from './MobileHero'
import { translate } from '@/i18n/i18n'

export type IosChannel = 'stable' | 'preview'

export type InstallCopy = { ctaLabel: string; url: string }

export const ANDROID_INSTALL_GUIDE_URL = 'https://alfredlabs.org/docs/android-apk'

const IOS_CHANNEL_COPY: Record<IosChannel, InstallCopy> = {
  stable: {
    ctaLabel: 'View iOS releases',
    url: 'https://github.com/GOI17/alfred-workspace/releases'
  },
  preview: {
    ctaLabel: 'View preview releases',
    url: 'https://github.com/GOI17/alfred-workspace/releases'
  }
}

const ANDROID_COPY: InstallCopy = {
  ctaLabel: 'View Android releases',
  url: 'https://github.com/GOI17/alfred-workspace/releases'
}

export function getInstallCopy(platform: Platform, iosChannel: IosChannel): InstallCopy {
  return platform === 'ios' ? IOS_CHANNEL_COPY[iosChannel] : ANDROID_COPY
}

export function getChannelTagline(iosChannel: IosChannel): string {
  return iosChannel === 'preview'
    ? translate(
        'auto.components.mobile.mobile.platform.copy.preview.tagline',
        'Preview builds, when available.'
      )
    : translate(
        'auto.components.mobile.mobile.platform.copy.stable.tagline',
        'Stable builds, when available.'
      )
}

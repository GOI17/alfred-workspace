import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'

export const getAlfredAccountSettingsSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.alfredAccount.account', 'Alfred account'),
    description: translate(
      'auto.components.settings.alfredAccount.searchDescription',
      'Sign in or out of the account used by Artifacts and Alfred Relay.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordAccount', 'account'),
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordLogin', 'login'),
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordLogout', 'logout'),
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordSignIn', 'sign in'),
      ...translateSearchKeyword(
        'auto.components.settings.alfredAccount.keywordSignOut',
        'sign out'
      ),
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordRelay', 'relay'),
      ...translateSearchKeyword('auto.components.settings.alfredAccount.keywordCloud', 'cloud')
    ]
  }
])

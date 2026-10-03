import { readFile } from 'node:fs/promises'

// Expo's router already owns navigation state; the shell must never rewrite its private document URL.
export const mobileWebRouterPlugin = {
  name: 'orca-shell-router-history',
  setup(build) {
    build.onLoad(
      { filter: /expo-router[\\/]build[\\/]fork[\\/]useLinking\.js$/ },
      async ({ path }) => {
        const source = await readFile(path, 'utf8')
        if (!source.includes('exports.useLinking = useLinking;')) {
          throw new Error('Review the shell history adapter after upgrading expo-router')
        }
        return {
          contents: `${source}\nexports.useLinking = (ref, options, onUnhandledLinking) =>
          useLinking(ref, globalThis.orcaBridge ? { ...options, enabled: false } : options, onUnhandledLinking);`,
          loader: 'js'
        }
      }
    )
  }
}

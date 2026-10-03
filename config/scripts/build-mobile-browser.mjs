import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { isDirectInvocation } from './build-mobile-web-bundle.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))

export async function buildMobileBrowser(
  outDir = join(root, 'out/mobile-browser'),
  projectIntoDesktop = true
) {
  const result = await build({
    absWorkingDir: join(root, 'mobile'),
    entryPoints: ['browser-entry/index.tsx'],
    outdir: outDir,
    entryNames: 'assets/browser-[hash]',
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    metafile: true,
    sourcemap: false,
    alias: { 'expo-crypto': join(root, 'mobile/browser-entry/browser-crypto.ts') },
    define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
    logLevel: 'silent'
  })
  const outputs = Object.keys(result.metafile.outputs)
  const script = outputs.find((path) => path.endsWith('.js'))
  const css = outputs.find((path) => path.endsWith('.css'))
  if (!script || !css) {
    throw new Error('Browser entry build is incomplete')
  }
  const assetPath = (path) => `assets/${path.split(/[\\/]/).at(-1)}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline' data:; connect-src https: wss: ws:; frame-src 'self' about:; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><title>Alfred Workspace</title><link rel="stylesheet" href="./${assetPath(css)}"></head><body><div id="root"></div><script type="module" src="./${assetPath(script)}"></script></body></html>`
  await writeFile(join(outDir, 'mobile-browser.html'), html)
  if (projectIntoDesktop) {
    for (const source of [
      ...outputs.map((path) => resolve(root, 'mobile', path)),
      join(outDir, 'mobile-browser.html')
    ]) {
      const target = join(
        root,
        'out/web',
        source.endsWith('.html') ? 'mobile-browser.html' : assetPath(source)
      )
      await mkdir(dirname(target), { recursive: true })
      await copyFile(source, target)
    }
  }
  // Fail if a future import brings native secrets or platform storage into the browser loader.
  for (const path of Object.keys(result.metafile.inputs)) {
    if (/expo-secure-store|react-native\/|pairing-keychain\.ts/.test(path)) {
      throw new Error(`Native dependency in browser entry: ${path}`)
    }
  }
  return { outDir, html, script: await readFile(resolve(root, 'mobile', script), 'utf8') }
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  await buildMobileBrowser()
  console.log('[mobile-browser] Built standalone entry and copied into out/web')
}

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildMobileRichMarkdownEditorHtml } from './mobile-rich-markdown-editor-html'

// Pins the Alfred document bytes across future WebView refactors.
const ALFRED_DOCUMENT_SHA256 = 'd166bc6ca728a03c61ee584e0e72dc36fadd5707ec22e64978e3317d34691679'
const ALFRED_DOCUMENT_BYTES = 29854

describe('mobile rich markdown editor document', () => {
  it('reproduces the Alfred document byte for byte', () => {
    const document = buildMobileRichMarkdownEditorHtml()
    expect(Buffer.byteLength(document, 'utf8')).toBe(ALFRED_DOCUMENT_BYTES)
    expect(createHash('sha256').update(document, 'utf8').digest('hex')).toBe(ALFRED_DOCUMENT_SHA256)
  })
})

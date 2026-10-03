import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { View } from 'react-native'
import { Terminal } from '@xterm/xterm'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { isTerminalQueryReply } from '../../../src/shared/terminal-query-reply'
import { colors, typography } from '../theme/mobile-theme'
import type { TerminalWebViewHandle, TerminalWebViewProps } from './terminal-webview-contract'

// The host subscription and input controller stay unchanged; only the native WebView is replaced.
export const TerminalWebView = forwardRef<TerminalWebViewHandle, TerminalWebViewProps>(
  function TerminalWebView(props, ref) {
    const element = useRef<HTMLDivElement>(null)
    const terminal = useRef<Terminal | null>(null)
    const current = useRef(props)
    current.current = props
    const flushed = useRef<Promise<void>>(Promise.resolve())

    useEffect(() => {
      if (!element.current) {
        return
      }
      const term = new Terminal({
        fontFamily: typography.monoFamily,
        fontSize: typography.bodySize,
        theme: { background: colors.terminalBg, foreground: colors.textPrimary },
        allowProposedApi: true,
        // Input comes from the existing mobile composer, including query-reply classification.
        disableStdin: false
      })
      terminal.current = term
      term.loadAddon(new Unicode11Addon())
      term.unicode.activeVersion = '11'
      term.open(element.current)
      const data = term.onData((bytes) => {
        if (isTerminalQueryReply(bytes)) {
          current.current.onTerminalQueryReply?.(bytes)
        }
      })
      current.current.onWebReady?.()
      return () => {
        data.dispose()
        term.dispose()
        terminal.current = null
      }
    }, [])

    useEffect(() => {
      const term = terminal.current
      if (!term) {
        return
      }
      term.options.theme = props.terminalTheme?.theme ?? {
        background: colors.terminalBg,
        foreground: colors.textPrimary
      }
      term.options.fontSize = typography.bodySize * (props.textScale ?? 1)
    }, [props.terminalTheme, props.textScale])

    useImperativeHandle(
      ref,
      () => ({
        prepareForForegroundRecovery: () => current.current.onWebReady?.(),
        write: (data) => terminal.current?.write(data),
        init: (cols, rows, data = '') => {
          const term = terminal.current
          if (!term) {
            return
          }
          term.reset()
          term.resize(cols, rows)
          flushed.current = new Promise((resolve) => term.write(data, resolve))
        },
        resize: (cols, rows) => terminal.current?.resize(cols, rows),
        reflow: (cols, rows) => terminal.current?.resize(cols, rows),
        clear: () => terminal.current?.clear(),
        measureFitDimensions: async (height) => {
          const term = terminal.current
          const root = element.current
          const screen = root?.querySelector('.xterm-screen')?.getBoundingClientRect()
          if (!term || !root || !screen?.width || !screen.height) {
            return null
          }
          return {
            cols: Math.max(2, Math.floor(root.clientWidth / (screen.width / term.cols))),
            rows: Math.max(
              1,
              Math.floor((height ?? root.clientHeight) / (screen.height / term.rows))
            )
          }
        },
        resetZoom: () => current.current.onTextScaleChange?.(1),
        cancelSelect: () => terminal.current?.clearSelection(),
        doSelectAll: () => terminal.current?.selectAll(),
        awaitReady: () => flushed.current
      }),
      []
    )

    return (
      <View style={props.style}>
        <div ref={element} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
      </View>
    )
  }
)

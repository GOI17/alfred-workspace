import { describe, expect, it } from 'vitest'
import {
  bindHostIsNetworkExposed,
  describeAlfreddBindExposure,
  ALFREDD_LOOPBACK_BIND_HOST,
  AlfreddBindAddressError,
  resolveAlfreddBindHost
} from './alfredd-bind-address'

describe('resolveAlfreddBindHost', () => {
  it('defaults to loopback when the operator asked for nothing', () => {
    expect(resolveAlfreddBindHost()).toBe(ALFREDD_LOOPBACK_BIND_HOST)
    expect(ALFREDD_LOOPBACK_BIND_HOST).toBe('127.0.0.1')
  })

  it('accepts literal IPv4 and IPv6 addresses, including explicit wide binds', () => {
    expect(resolveAlfreddBindHost('0.0.0.0')).toBe('0.0.0.0')
    expect(resolveAlfreddBindHost('10.1.2.3')).toBe('10.1.2.3')
    expect(resolveAlfreddBindHost('::1')).toBe('::1')
    expect(resolveAlfreddBindHost('localhost')).toBe('127.0.0.1')
    expect(resolveAlfreddBindHost(' 127.0.0.1 ')).toBe('127.0.0.1')
  })

  it('refuses hostnames, because DNS would decide which interface got bound', () => {
    expect(() => resolveAlfreddBindHost('internal.example')).toThrow(AlfreddBindAddressError)
    expect(() => resolveAlfreddBindHost('')).toThrow(AlfreddBindAddressError)
    expect(() => resolveAlfreddBindHost('0.0.0.0:80')).toThrow(AlfreddBindAddressError)
  })
})

describe('bindHostIsNetworkExposed', () => {
  it('separates local-only addresses from network-reachable ones', () => {
    expect(bindHostIsNetworkExposed('127.0.0.1')).toBe(false)
    expect(bindHostIsNetworkExposed('127.5.5.5')).toBe(false)
    expect(bindHostIsNetworkExposed('::1')).toBe(false)
    expect(bindHostIsNetworkExposed('0.0.0.0')).toBe(true)
    expect(bindHostIsNetworkExposed('::')).toBe(true)
    expect(bindHostIsNetworkExposed('10.1.2.3')).toBe(true)
  })

  it('says out loud when a deployment is reachable from the network', () => {
    expect(describeAlfreddBindExposure('0.0.0.0')).toContain('reachable from the network')
    expect(describeAlfreddBindExposure('127.0.0.1')).toContain('local only')
  })
})

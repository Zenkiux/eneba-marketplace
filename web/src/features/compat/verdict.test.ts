import { describe, expect, it } from 'vitest'
import type { DeviceProfile } from './device'
import { regionWorksIn } from './regions'
import { verdictFor } from './verdict'

const pc: DeviceProfile = { country: 'LT', os: 'windows', gpuName: 'GeForce RTX 3060', gpuScore: 8800, cpuLabel: '', cpuScore: 1100, ramGb: 16, consoles: [], detected: true }
const game = (platform: string, region: string, reqMin?: object) => ({ platform: { slug: platform }, region: { slug: region }, reqMin })

describe('will it work for me', () => {
  it('passes a PC game the PC can run in a region that activates here', () => {
    expect(verdictFor(pc, game('steam', 'europe', { os: 'windows', gpuScore: 3800, cpuScore: 900, ramGb: 12 })).status).toBe('works')
  })
  it('lists every failing part', () => {
    const v = verdictFor({ ...pc, country: 'US', gpuScore: 1500, ramGb: 8 }, game('steam', 'europe', { gpuScore: 3800, ramGb: 12 }))
    expect(v.status).toBe('no')
    expect(v.failing).toEqual(['region', 'gpu', 'ram'])
  })
  it('requires owning the console for console keys', () => {
    expect(verdictFor(pc, game('psn', 'global')).failing).toEqual(['platform'])
    expect(verdictFor({ ...pc, consoles: ['psn'] }, game('psn', 'global')).status).toBe('works')
  })
  it('a Windows game on a Mac fails on the OS', () => {
    expect(verdictFor({ ...pc, os: 'mac' }, game('steam', 'global', { os: 'windows' })).failing).toEqual(['os'])
  })
  it('is "unknown" rather than "works" when hardware wasn\'t provided', () => {
    expect(verdictFor({ ...pc, gpuScore: 0 }, game('steam', 'global', { gpuScore: 3800 })).status).toBe('unknown')
  })
  it('never says "works" when a listed requirement could not be read', () => {
    const v = verdictFor(pc, game('steam', 'global', { gpuScore: 300, unchecked: ['cpu'] }))
    expect(v).toMatchObject({ status: 'unknown', unknownReason: 'data' })
  })
  it('a PC game without any requirements data is unknown, not "works"', () => {
    expect(verdictFor(pc, { ...game('steam', 'global'), type: { slug: 'game' } })).toMatchObject({ status: 'unknown', unknownReason: 'data' })
    expect(verdictFor(pc, { ...game('steam', 'global'), type: { slug: 'gift-card' } }).status).toBe('works')
  })
  it('an old PC fails GTA V (regression)', () => {
    const old = { ...pc, gpuName: 'GeForce GT 520', gpuScore: 120, cpuScore: 180, ramGb: 2 }
    const gta = game('rockstar', 'global', { os: 'windows', gpuScore: 310, cpuScore: 300, ramGb: 4 })
    expect(verdictFor(old, gta).failing).toEqual(['gpu', 'cpu', 'ram'])
  })
  it('region rules match the API', () => {
    expect(regionWorksIn('europe', 'LT')).toBe(true)
    expect(regionWorksIn('north-america', 'LT')).toBe(false)
    expect(regionWorksIn('rest-of-world', 'IN')).toBe(true)
    expect(regionWorksIn('rest-of-world', 'DE')).toBe(false)
  })
})

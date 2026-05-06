import { describe, expect, it } from 'vitest'
import { pbkdf2Hasher } from '../pbkdf2.js'

describe('pbkdf2Hasher', () => {
  it('hash outputs $pbkdf2$310000$<salt>$<hash> format', async () => {
    const hashed = await pbkdf2Hasher.hash('password')
    const parts = hashed.split('$')
    expect(parts).toHaveLength(5)
    expect(parts[0]).toBe('')
    expect(parts[1]).toBe('pbkdf2')
    expect(parts[2]).toBe('310000')
    expect((parts[3] as string).length).toBeGreaterThan(0)
    expect((parts[4] as string).length).toBeGreaterThan(0)
  })

  it('hash → verify round-trip returns true', async () => {
    const hashed = await pbkdf2Hasher.hash('my-secret')
    const result = await pbkdf2Hasher.verify('my-secret', hashed)
    expect(result).toBe(true)
  })

  it('verify returns false for a different password', async () => {
    const hashed = await pbkdf2Hasher.hash('correct-password')
    const result = await pbkdf2Hasher.verify('wrong-password', hashed)
    expect(result).toBe(false)
  })

  it('hashing the same input twice produces different outputs (salt randomness)', async () => {
    const hash1 = await pbkdf2Hasher.hash('same-input')
    const hash2 = await pbkdf2Hasher.hash('same-input')
    expect(hash1).not.toBe(hash2)
  })

  it('verify returns false for invalid formats', async () => {
    expect(await pbkdf2Hasher.verify('password', 'not-a-hash')).toBe(false)
    expect(await pbkdf2Hasher.verify('password', '')).toBe(false)
    expect(await pbkdf2Hasher.verify('password', '$bcrypt$12$somesalt$somehash')).toBe(false)
  })

  it('verify returns false for malformed base64 in stored value', async () => {
    expect(await pbkdf2Hasher.verify('password', '$pbkdf2$310000$!!!notb64!!!$!!!')).toBe(false)
  })

  it('verify returns false for excessively large iterations (DoS guard)', async () => {
    expect(await pbkdf2Hasher.verify('password', '$pbkdf2$999999999$somesalt$somehash')).toBe(false)
  })
})

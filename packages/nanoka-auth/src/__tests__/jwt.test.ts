import { describe, expect, it } from 'vitest'
import { sign, verify } from '../jwt.js'

describe('jwt', () => {
  it('sign → verify round-trip returns same payload', async () => {
    const payload = { sub: 'user-1', name: 'foo' }
    const token = await sign(payload, 'secret')
    const result = await verify<typeof payload>(token, 'secret')
    expect(result.sub).toBe('user-1')
    expect(result.name).toBe('foo')
  })

  it('expiresIn sets exp to approximately now + expiresIn seconds', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await sign({ sub: 'user-1' }, 'secret', { expiresIn: 3600 })
    const after = Math.floor(Date.now() / 1000)
    const result = await verify<{ sub: string; exp: number }>(token, 'secret')
    expect(result.exp).toBeGreaterThanOrEqual(before + 3600)
    expect(result.exp).toBeLessThanOrEqual(after + 3600)
  })

  it('expired token throws', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret', { expiresIn: -1 })
    await expect(verify(token, 'secret')).rejects.toThrow('Token expired')
  })

  it('tampered signature throws', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret')
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`
    await expect(verify(tampered, 'secret')).rejects.toThrow('Invalid signature')
  })

  it('tampered payload (signature unchanged) throws', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret')
    const parts = token.split('.')
    const newPayload = btoa(JSON.stringify({ sub: 'attacker' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const tampered = `${parts[0]}.${newPayload}.${parts[2]}`
    await expect(verify(tampered, 'secret')).rejects.toThrow('Invalid signature')
  })

  it('different secret throws', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret')
    await expect(verify(token, 'other-secret')).rejects.toThrow('Invalid signature')
  })

  it('alg:none header attack throws', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret')
    const parts = token.split('.')
    const noneHeader = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const tampered = `${noneHeader}.${parts[1]}.${parts[2]}`
    await expect(verify(tampered, 'secret')).rejects.toThrow('Invalid token header')
  })

  it('invalid token format throws', async () => {
    await expect(verify('not.a.valid.jwt.token', 'secret')).rejects.toThrow('Invalid token format')
    await expect(verify('', 'secret')).rejects.toThrow('Invalid token format')
    await expect(verify('onlytwoparts.here', 'secret')).rejects.toThrow('Invalid token format')
  })

  it('expiresIn omitted does not add exp to payload', async () => {
    const token = await sign({ sub: 'user-1' }, 'secret')
    const result = await verify<{ sub: string; exp?: number }>(token, 'secret')
    expect(result.exp).toBeUndefined()
  })

  it('sign with expiresIn: NaN throws', async () => {
    await expect(sign({ sub: 'user-1' }, 'secret', { expiresIn: Number.NaN })).rejects.toThrow(
      'expiresIn must be a finite number',
    )
  })

  it('sign with expiresIn: Infinity throws', async () => {
    await expect(sign({ sub: 'user-1' }, 'secret', { expiresIn: Infinity })).rejects.toThrow(
      'expiresIn must be a finite number',
    )
  })

  it('null payload token throws', async () => {
    const headerB64 = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const nullPayloadB64 = btoa('null')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const validToken = await sign({ sub: 'user-1' }, 'secret')
    const validSig = validToken.split('.')[2]
    const tampered = `${headerB64}.${nullPayloadB64}.${validSig}`
    await expect(verify(tampered, 'secret')).rejects.toThrow()
  })
})

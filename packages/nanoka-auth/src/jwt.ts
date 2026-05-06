const ALGORITHM = 'HS256'

export interface SignOptions {
  expiresIn?: number
}

function utf8(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as unknown as Uint8Array<ArrayBuffer>
}

function toBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): ArrayBuffer {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  const binary = atob(padded)
  const buf = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return buf
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/**
 * HS256 で JWT を署名する。
 * @remarks アルゴリズムは HS256 固定。RS256 / ES256 等の非対称アルゴリズムを追加する場合は
 *   鍵オブジェクト型を分離し、verify に期待する alg を引数で渡す API に変更すること（alg confusion 攻撃防止）。
 */
export async function sign(
  payload: Record<string, unknown>,
  secret: string,
  options?: SignOptions,
): Promise<string> {
  if (!secret) throw new Error('secret must not be empty')
  const header = { alg: ALGORITHM, typ: 'JWT' }
  const headerB64 = toBase64url(utf8(JSON.stringify(header)).buffer as ArrayBuffer)

  const finalPayload =
    options?.expiresIn !== undefined
      ? { ...payload, exp: Math.floor(Date.now() / 1000) + options.expiresIn }
      : payload
  const payloadB64 = toBase64url(utf8(JSON.stringify(finalPayload)).buffer as ArrayBuffer)

  const signingInput = `${headerB64}.${payloadB64}`
  const key = await importKey(secret)
  const signatureBuf = await crypto.subtle.sign('HMAC', key, utf8(signingInput))
  const signatureB64 = toBase64url(signatureBuf)

  return `${signingInput}.${signatureB64}`
}

/**
 * HS256 JWT を検証してペイロードを返す。
 * @remarks 戻り値の型パラメータ T は実行時検証なし。受け取った payload は Zod 等で検証すること。
 *   `nbf` / `iat` / `aud` / `iss` クレームは検証しない。必要な場合はアプリ側で payload を検証すること。
 */
export async function verify<T = Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T> {
  if (!secret) throw new Error('secret must not be empty')
  const segments = token.split('.')
  if (segments.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [headerB64, payloadB64, signatureB64] = segments as [string, string, string]

  const header = JSON.parse(new TextDecoder().decode(fromBase64url(headerB64))) as Record<
    string,
    unknown
  >
  if (header.alg !== ALGORITHM || header.typ !== 'JWT') {
    throw new Error('Invalid token header')
  }

  const signingInput = `${headerB64}.${payloadB64}`
  const key = await importKey(secret)
  const signatureBuf = fromBase64url(signatureB64)
  const valid = await crypto.subtle.verify('HMAC', key, signatureBuf, utf8(signingInput))
  if (!valid) {
    throw new Error('Invalid signature')
  }

  const payload = JSON.parse(new TextDecoder().decode(fromBase64url(payloadB64))) as Record<
    string,
    unknown
  >

  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      throw new Error('Invalid exp claim')
    }
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      throw new Error('Token expired')
    }
  }

  return payload as T
}

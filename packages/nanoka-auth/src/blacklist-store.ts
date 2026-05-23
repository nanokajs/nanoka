export interface BlacklistStore {
  add(jti: string, expiresAt: number): Promise<void>
  has(jti: string): Promise<boolean>
  // Defense-in-depth: jti + sub の対で blacklist 登録 / 照合する optional API。
  // 実装側で提供すれば refreshHandler 側が自動で利用する。
  addWithSubject?(jti: string, sub: string, expiresAt: number): Promise<void>
  hasForSubject?(jti: string, sub: string): Promise<boolean>
}

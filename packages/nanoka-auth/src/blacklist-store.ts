export interface BlacklistStore {
  add(jti: string, expiresAt: number): Promise<void>
  has(jti: string): Promise<boolean>
}

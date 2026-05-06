export interface Hasher {
  hash(plain: string): Promise<string>
  verify(plain: string, stored: string): Promise<boolean>
}

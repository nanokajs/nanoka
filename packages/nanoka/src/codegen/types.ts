import type { Field } from '../field'

export interface ModelDef {
  readonly name: string
  readonly fields: Record<string, Field<any, any, any>>
}

export interface NanokaConfig {
  readonly output?: string | undefined
  readonly models: readonly ModelDef[]
  readonly migrate?: {
    readonly drizzleConfig?: string
    readonly database?: string
    readonly packageManager?: 'npx' | 'pnpm' | 'npm' | 'yarn' | 'bun'
  }
}

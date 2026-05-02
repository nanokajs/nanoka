import type { Field } from '../field'

export interface ModelDef {
  readonly name: string
  readonly fields: Record<string, Field<any, any, any>>
}

export interface NanokaConfig {
  readonly output?: string | undefined
  readonly models: readonly ModelDef[]
}

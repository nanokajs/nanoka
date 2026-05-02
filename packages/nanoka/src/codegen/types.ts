import type { Field } from '../field'

export interface ModelDef {
  readonly tableName: string
  readonly fields: Record<string, Field<any, any, any>>
}

export interface NanokaConfig {
  readonly out?: string | undefined
  readonly models: readonly ModelDef[]
}

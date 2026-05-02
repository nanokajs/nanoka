export { t } from './field'
export { defineModel } from './model'
export type { NanokaConfig } from './codegen/types'

export function defineConfig<T extends any>(config: T): T {
  return config
}

export { t } from './field'
import type { NanokaConfig } from './codegen/types'
export type { NanokaConfig } from './codegen/types'

export function defineConfig(config: NanokaConfig): NanokaConfig {
  return config
}

import { createJiti } from 'jiti'
import type { NanokaConfig } from '../codegen/types'

export async function loadConfig(configPath: string): Promise<NanokaConfig> {
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const mod = await jiti.import<{ default: NanokaConfig }>(configPath)
  return mod.default
}

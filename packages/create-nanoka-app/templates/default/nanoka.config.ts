import { defineConfig } from '@nanokajs/core/config'
import { userFields, userTableName } from './src/models/user'

export default defineConfig({
  models: [
    {
      name: userTableName,
      fields: userFields,
    },
  ],
  output: './drizzle/schema.ts',
})

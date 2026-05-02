import { defineConfig } from '@nanokajs/core/config'
import { userFields, userTableName } from './src/models/user'

export default defineConfig({
  models: [
    {
      tableName: userTableName,
      fields: userFields,
    },
  ],
  out: './drizzle/schema.ts',
})

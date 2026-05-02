import { defineConfig } from 'nanoka/config'
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

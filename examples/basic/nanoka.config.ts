import { defineConfig } from '@nanokajs/core/config'
import { postFields, postTableName } from './src/models/post'
import { userFields, userTableName } from './src/models/user'

export default defineConfig({
  models: [
    {
      name: userTableName,
      fields: userFields,
    },
    {
      name: postTableName,
      fields: postFields,
    },
  ],
  output: './drizzle/schema.ts',
})

import { defineConfig } from '@nanokajs/core/config'
import { postFields, postTableName } from './src/models/posts'

export default defineConfig({
  models: [
    { name: postTableName, fields: postFields },
  ],
  output: './drizzle/schema.ts',
})

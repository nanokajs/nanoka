import { t } from '@nanokajs/core'

export const userTableName = 'users'

export const userFields = {
  id: t.uuid().primary(),
  name: t.string().min(1).max(100),
  email: t.string().email().unique(),
  passwordHash: t.string().writeOnly(),
  serverToken: t.string().serverOnly().optional(),
  createdAt: t.timestamp().default(() => new Date()),
}

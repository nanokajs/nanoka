import { t } from '@nanokajs/core'

export const postTableName = 'posts'
export const postFields = {
  id: t.uuid().primary(),
  title: t.string().min(1).max(200),
  body: t.string().min(1),
  published: t.boolean().default(false),
  createdAt: t.timestamp().default(() => new Date()),
}

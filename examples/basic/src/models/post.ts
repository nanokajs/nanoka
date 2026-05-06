import { t } from '@nanokajs/core'

export const postTableName = 'posts'

export const postFields = {
  id: t.uuid().primary().readOnly(),
  userId: t.uuid(),
  title: t.string().min(1).max(200),
  body: t.string().optional(),
  createdAt: t
    .timestamp()
    .readOnly()
    .default(() => new Date()),
}

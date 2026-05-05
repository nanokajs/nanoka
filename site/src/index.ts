import { Hono } from 'hono'
import { docPages } from './docs-registry'
import { renderLayout } from './layout'

type Bindings = {
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

// ドキュメントページを自動登録
for (const page of docPages) {
  app.get(page.path, (c) =>
    c.html(
      renderLayout({
        currentPath: page.path,
        title: page.title,
        description: page.description,
        bodyHtml: page.content,
      })
    )
  )
}

// セクショントップのリダイレクト
app.get('/api', (c) => c.redirect('/api/field-types', 302))
app.get('/guides', (c) => c.redirect('/guides/migration', 302))

export default app

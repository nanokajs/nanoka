import { navStructure } from './docs-registry'

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderSidebar(currentPath: string): string {
  let items = ''
  for (const group of navStructure) {
    if (group.label === '') {
      for (const page of group.pages) {
        const isCurrent = page.path === currentPath
        const attrs = isCurrent ? ' aria-current="page" class="active"' : ''
        items += `<li><a href="${escapeHtml(page.path)}"${attrs}>${escapeHtml(page.title)}</a></li>\n`
      }
    } else {
      let subItems = ''
      for (const page of group.pages) {
        const isCurrent = page.path === currentPath
        const attrs = isCurrent ? ' aria-current="page" class="active"' : ''
        subItems += `<li><a href="${escapeHtml(page.path)}"${attrs}>${escapeHtml(page.title)}</a></li>\n`
      }
      items += `<li class="nav-group">\n<span class="nav-group-label">${escapeHtml(group.label)}</span>\n<ul>\n${subItems}</ul>\n</li>\n`
    }
  }
  return `<nav class="sidebar">\n<ul>\n${items}</ul>\n</nav>`
}

/** bodyHtml must be trusted HTML — never pass unsanitized user input */
export function renderLayout(opts: {
  currentPath: string
  title: string
  description?: string
  bodyHtml: string
}): string {
  const { currentPath, title, description, bodyHtml } = opts
  const descTag =
    description !== undefined
      ? `\n  <meta name="description" content="${escapeHtml(description)}">`
      : ''
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Nanoka</title>${descTag}
</head>
<body>
  <div class="layout">
    <header class="site-header">
      <a href="/" class="site-logo">Nanoka</a>
    </header>
    <div class="layout-body">
      ${renderSidebar(currentPath)}
      <main class="content">
        <article>${bodyHtml}</article>
      </main>
    </div>
    <footer class="site-footer">
      <p>&copy; Nanoka contributors</p>
    </footer>
  </div>
</body>
</html>`
}

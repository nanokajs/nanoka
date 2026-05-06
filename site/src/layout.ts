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
  bodyHtmlJa?: string
}): string {
  const { currentPath, title, description, bodyHtml, bodyHtmlJa } = opts
  const descTag =
    description !== undefined
      ? `\n  <meta name="description" content="${escapeHtml(description)}">\n  <meta property="og:description" content="${escapeHtml(description)}">`
      : ''
  const ogTitle = `${escapeHtml(title)} — Nanoka`
  const langToggleClass = bodyHtmlJa ? 'lang-toggle' : 'lang-toggle lang-toggle--hidden'
  const jaDiv = bodyHtmlJa ? `<div class="lang-ja" lang="ja" hidden>${bodyHtmlJa}</div>` : ''
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ogTitle}</title>${descTag}
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Nanoka">
  <meta property="og:image" content="/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="/og-image.png">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/highlight.css">
</head>
<body>
  <input type="checkbox" id="sidebar-toggle" class="sidebar-toggle-input">
  <div class="layout">
    <header class="site-header">
      <a href="/" class="site-logo">
        <img src="/images/nanoka-logo.png" alt="" class="site-logo-mark" width="32" height="32">
        <span class="site-logo-text">Nanoka</span>
      </a>
      <div class="${langToggleClass}" role="group" aria-label="Language">
        <button type="button" class="lang-btn" data-lang="en" aria-pressed="true">EN</button>
        <button type="button" class="lang-btn" data-lang="ja" aria-pressed="false">JA</button>
      </div>
      <label for="sidebar-toggle" class="sidebar-toggle" aria-label="Toggle navigation"><span></span><span></span><span></span></label>
    </header>
    <div class="layout-body">
      ${renderSidebar(currentPath)}
      <main class="content">
        <article>
          <div class="lang-en" lang="en">${bodyHtml}</div>
          ${jaDiv}
        </article>
      </main>
    </div>
    <label for="sidebar-toggle" class="sidebar-backdrop" aria-hidden="true"></label>
    <footer class="site-footer">
      <p>&copy; Nanoka contributors</p>
    </footer>
  </div>
<script>
(function() {
  var saved = localStorage.getItem('nanoka-lang') || 'en';
  var enDiv = document.querySelector('.lang-en');
  var jaDiv = document.querySelector('.lang-ja');
  var btns = document.querySelectorAll('.lang-btn');
  function applyLang(lang) {
    document.documentElement.lang = lang;
    if (enDiv) enDiv.hidden = (lang !== 'en');
    if (jaDiv) jaDiv.hidden = (lang !== 'ja');
    btns.forEach(function(b) {
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    });
  }
  if (jaDiv) { applyLang(saved); }
  btns.forEach(function(b) {
    b.addEventListener('click', function() {
      var lang = b.dataset.lang;
      localStorage.setItem('nanoka-lang', lang);
      applyLang(lang);
    });
  });
})();
</script>
</body>
</html>`
}

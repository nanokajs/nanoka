import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import typescript from 'highlight.js/lib/languages/typescript'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerAliases('jsonc', { languageName: 'json' })

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (!hljs.getLanguage(lang)) return code
      return hljs.highlight(code, { language: lang }).value
    },
  }),
  { gfm: true, breaks: false },
)

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false })
}

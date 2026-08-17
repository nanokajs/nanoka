import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('paragraphタグに変換する', () => {
    expect(renderMarkdown('hello world')).toBe('<p>hello world</p>\n')
  })

  it('見出しをh1〜h6に変換する', () => {
    expect(renderMarkdown('## heading')).toBe('<h2>heading</h2>\n')
  })

  it('GFM有効: テーブルを変換する', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n')
    expect(html).toContain('<table>')
  })

  it('breaks無効: 単一改行はそのまま同一段落に残す（<br>を挿入しない）', () => {
    const html = renderMarkdown('line1\nline2')
    expect(html).not.toContain('<br')
    expect(html).toBe('<p>line1\nline2</p>\n')
  })

  it('登録済み言語(typescript)のコードブロックをハイライトする', () => {
    const html = renderMarkdown('```typescript\nconst x: number = 1\n```')
    expect(html).toContain('hljs language-typescript')
    expect(html).toContain('<span')
  })

  it('登録済み言語(bash)のコードブロックをハイライトする', () => {
    const html = renderMarkdown('```bash\necho hi\n```')
    expect(html).toContain('hljs language-bash')
  })

  it('jsoncエイリアスがjsonとして扱われる', () => {
    const html = renderMarkdown('```jsonc\n{"a": 1}\n```')
    expect(html).toContain('hljs language-jsonc')
  })

  it('未登録言語のコードブロックはハイライトせず生コードのまま返す（<span>が挿入されない）', () => {
    const html = renderMarkdown('```unknownlang\nfoo bar\n```')
    expect(html).toContain('foo bar')
    expect(html).not.toContain('<span')
  })

  it('HTMLとして危険な文字を含むコードブロックはエスケープされる', () => {
    const html = renderMarkdown('```bash\n<script>alert(1)</script>\n```')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

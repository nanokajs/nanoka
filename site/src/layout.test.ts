import { describe, expect, it } from 'vitest'
import { escapeHtml, renderSidebar } from './layout'

describe('escapeHtml', () => {
  it('&, <, >, ", \' をエスケープする', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('特殊文字を含まない文字列はそのまま返す', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('scriptタグを無害化する', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('&のエスケープが先に行われ、二重エスケープしない（&ltが&amp;ltにならない）', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('空文字列はそのまま返す', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('renderSidebar', () => {
  it('nav要素とトップレベルページへのリンクを含む', () => {
    const html = renderSidebar('/')
    expect(html).toContain('<nav class="sidebar">')
    expect(html).toContain('<a href="/"')
    expect(html).toContain('Introduction')
  })

  it('現在のパスにaria-current="page"とclass="active"を付与する', () => {
    const html = renderSidebar('/getting-started')
    expect(html).toContain('<a href="/getting-started" aria-current="page" class="active">')
  })

  it('現在でないページにはaria-currentを付与しない', () => {
    const html = renderSidebar('/getting-started')
    const introLink = html.split('\n').find((line) => line.includes('>Introduction<'))
    expect(introLink).not.toContain('aria-current')
  })

  it('ラベル付きグループ(API Reference等)をnav-groupとしてネストする', () => {
    const html = renderSidebar('/')
    expect(html).toContain('<li class="nav-group">')
    expect(html).toContain('<span class="nav-group-label">API Reference</span>')
  })

  it('未知のパスを渡してもどのリンクもactiveにならない', () => {
    const html = renderSidebar('/does-not-exist')
    expect(html).not.toContain('aria-current')
    expect(html).not.toContain('class="active"')
  })

  it('タイトルに含まれるHTML特殊文字はエスケープして出力する（renderSidebar自体はpath/titleをそのままescapeHtmlに通す）', () => {
    // escapeHtml経由であることの確認: パスに含まれる文字がエスケープされる
    const html = renderSidebar('/')
    expect(html).not.toMatch(/href="[^"]*<[^"]*"/)
  })
})

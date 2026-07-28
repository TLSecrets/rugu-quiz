import MarkdownIt from 'markdown-it'
import katex from 'katex'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

const MATH_BLOCK = /\$\$([\s\S]+?)\$\$/g
const MATH_INLINE = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    })
  } catch {
    const escaped = tex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<code class="math-fallback">${escaped}</code>`
  }
}

/**
 * 渲染 Markdown + `$...$` / `$$...$$` 公式，并消毒 HTML。
 * 支持表格、换行、粗斜体、列表、代码、链接。
 */
export function renderRichText(source: string): string {
  if (!source?.trim()) return ''

  const slots: string[] = []
  const push = (html: string) => {
    const token = `@@MATH${slots.length}@@`
    slots.push(html)
    return token
  }

  let protectedText = source.replace(MATH_BLOCK, (_, tex: string) =>
    push(renderKatex(tex, true)),
  )
  protectedText = protectedText.replace(MATH_INLINE, (_, tex: string) =>
    push(renderKatex(tex, false)),
  )

  let html = md.render(protectedText)
  html = html.replace(/@@MATH(\d+)@@/g, (_, idx: string) => slots[Number(idx)] ?? '')

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class', 'style', 'aria-hidden', 'focusable', 'role', 'xmlns'],
  })
}

/** 去掉公式/Markdown 标记，供搜索与纯文本导出 */
export function stripRichText(source: string): string {
  if (!source) return ''
  return source
    .replace(MATH_BLOCK, '$1')
    .replace(MATH_INLINE, '$1')
    .replace(/[*_`>#\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

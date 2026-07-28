import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { renderRichText } from '@/lib/richtext'
import { QUESTION_TYPE_LABELS, type Question } from '@/types/question'
import { downloadBlob, safeFileName } from '@/lib/exportBank'

export type PdfScope = 'current' | 'wrong' | 'bank'

export interface PdfExportOptions {
  title: string
  questions: Question[]
  includeAnswers: boolean
  /** 已提交且判为错误/半对的题 id，仅 wrong 范围使用 */
  wrongIds?: Set<string>
  onProgress?: (done: number, total: number) => void
}

function optionLines(q: Question): string {
  if (!q.options?.length) return ''
  return q.options
    .map((o) => `<p><strong>${o.label}.</strong> ${renderRichText(o.content)}</p>`)
    .join('')
}

function answerBlock(q: Question): string {
  const parts: string[] = []
  if (q.answer.optionKeys?.length) {
    const labels = q.answer.optionKeys.map((key) => {
      const opt = q.options?.find((o) => o.key === key)
      return opt ? `${opt.label}` : key.toUpperCase()
    })
    parts.push(`<p><strong>答案：</strong>${labels.join('、')}</p>`)
  }
  if (q.answer.texts?.length) {
    parts.push(`<p><strong>参考答案：</strong>${q.answer.texts.map((t) => renderRichText(t)).join('；')}</p>`)
  }
  if (q.answer.explanation) {
    parts.push(`<p><strong>解析：</strong></p>${renderRichText(q.answer.explanation)}`)
  }
  return parts.join('')
}

function buildArticleHtml(q: Question, index: number, includeAnswers: boolean): string {
  const media = [...(q.media ?? []), ...(includeAnswers ? q.answer.media ?? [] : [])]
    .filter((m) => m.src)
    .map(
      (m) =>
        `<figure style="margin:8px 0"><img src="${m.src}" alt="${m.alt || ''}" style="max-width:100%;max-height:220px;object-fit:contain"/></figure>`,
    )
    .join('')

  return `
    <article class="pdf-q" style="padding:16px 18px;margin-bottom:14px;border:1px solid #d8dee6;border-radius:10px;background:#fff;color:#152033;font-family:'Noto Sans SC',sans-serif;">
      <p style="margin:0 0 8px;font-size:12px;color:#718096;font-weight:600;">
        ${index + 1}. ${QUESTION_TYPE_LABELS[q.type]}
      </p>
      <div style="font-size:14px;line-height:1.6;">${renderRichText(q.stem)}</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.55;">${optionLines(q)}</div>
      ${media}
      ${includeAnswers ? `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #d8dee6;font-size:13px;">${answerBlock(q)}</div>` : ''}
    </article>
  `
}

/**
 * 将题目渲染为离屏 DOM，分页截图写入 PDF。
 * 大批量时按题分批截图，降低移动端内存峰值。
 */
export async function exportQuestionsPdf(options: PdfExportOptions): Promise<void> {
  const list = options.questions
  if (!list.length) throw new Error('没有可导出的题目')

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:720px;padding:12px;background:#eef1f4;z-index:-1;'
  document.body.appendChild(host)

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let cursorY = margin
  let first = true

  try {
    for (let i = 0; i < list.length; i++) {
      options.onProgress?.(i, list.length)
      const wrap = document.createElement('div')
      wrap.innerHTML = buildArticleHtml(list[i], i, options.includeAnswers)
      host.innerHTML = ''
      host.appendChild(wrap)

      const canvas = await html2canvas(wrap, {
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const imgHeight = (canvas.height * contentWidth) / canvas.width

      if (!first && cursorY + imgHeight > pageHeight - margin) {
        pdf.addPage()
        cursorY = margin
      }
      first = false

      // 超长单题：按页切片
      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, 'JPEG', margin, cursorY, contentWidth, imgHeight)
        cursorY += imgHeight + 4
      } else {
        let remain = imgHeight
        let srcY = 0
        const pxPage = ((pageHeight - margin * 2) * canvas.width) / contentWidth
        while (remain > 0) {
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = Math.min(pxPage, canvas.height - srcY)
          const ctx = sliceCanvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(
              canvas,
              0,
              srcY,
              canvas.width,
              sliceCanvas.height,
              0,
              0,
              canvas.width,
              sliceCanvas.height,
            )
          }
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)
          const sliceMm = (sliceCanvas.height * contentWidth) / canvas.width
          if (cursorY > margin && cursorY + sliceMm > pageHeight - margin) {
            pdf.addPage()
            cursorY = margin
          }
          pdf.addImage(sliceData, 'JPEG', margin, cursorY, contentWidth, sliceMm)
          cursorY += sliceMm + 2
          srcY += sliceCanvas.height
          remain -= sliceMm
          if (remain > 1) {
            pdf.addPage()
            cursorY = margin
          }
        }
      }
    }
    options.onProgress?.(list.length, list.length)

    const blob = pdf.output('blob')
    downloadBlob(blob, `${safeFileName(options.title)}.pdf`)
  } finally {
    host.remove()
  }
}

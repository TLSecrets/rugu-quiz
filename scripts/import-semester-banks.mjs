/**
 * 从 TLSecrets 各独立刷题站提取题库 → banks/2025-2026-2/*.json
 * 输出格式适配 build-banks.mjs（题型/题干/选项A-H/答案/解析/标签）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'banks', '2025-2026-2')
const BANK_TAG = '2025-2026-2'
const LETTERS = 'ABCDEFGH'

const SOURCES = [
  {
    key: 'qingxingsai',
    url: 'https://raw.githubusercontent.com/TLSecrets/qingxingsai.github.io/main/index.html',
    name: '青星赛心理健康',
    description: '来自青星赛心理健康刷题站',
    file: '青星赛心理健康.json',
  },
  {
    key: 'xigai',
    url: 'https://raw.githubusercontent.com/TLSecrets/xigai-quiz/main/index.html',
    name: '习概',
    description: '习近平新时代中国特色社会主义思想概论',
    file: '习概.json',
  },
  {
    key: 'nihongo',
    url: 'https://raw.githubusercontent.com/TLSecrets/nihongo-quiz/main/index.html',
    name: '大学日语Ⅲ',
    description: '单词读音、汉字、外来语、文法',
    file: '大学日语Ⅲ.json',
  },
  {
    key: 'embed',
    url: 'https://raw.githubusercontent.com/TLSecrets/embed-quiz/main/js/question.js',
    name: '嵌入式应用开发',
    description: '嵌入式应用开发课程题库',
    file: '嵌入式应用开发.json',
  },
  {
    key: 'comm',
    url: 'https://raw.githubusercontent.com/TLSecrets/comm-theory-static-quiz/main/js/question.js',
    name: '通信系统原理',
    description: '通信系统原理课程题库',
    file: '通信系统原理.json',
  },
  {
    key: 'rtthread',
    url: 'https://raw.githubusercontent.com/TLSecrets/rtthread-quiz/main/question_bank.json',
    name: '实时操作系统',
    description: 'RT-Thread 实时操作系统题库',
    file: '实时操作系统.json',
  },
]

function stripOptPrefix(text) {
  return String(text ?? '')
    .replace(/^[A-Ha-h][\.．、\)）]\s*/, '')
    .trim()
}

function idxToLetter(i) {
  return LETTERS[i] || ''
}

function fillOptions(opts) {
  const row = {}
  opts.forEach((text, i) => {
    if (i < 8) row[`选项${LETTERS[i]}`] = stripOptPrefix(text)
  })
  return row
}

function qRow(type, stem, extra = {}) {
  return {
    题型: type,
    题干: String(stem ?? '').trim(),
    选项A: '',
    选项B: '',
    选项C: '',
    选项D: '',
    选项E: '',
    选项F: '',
    选项G: '',
    选项H: '',
    答案: '',
    解析: '',
    图片: '',
    标签: '',
    领域: '',
    ...extra,
  }
}

function extractJsArray(source, varName) {
  const marker = `const ${varName} = `
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`找不到 ${varName}`)
  let i = start + marker.length
  while (i < source.length && /\s/.test(source[i])) i++
  const open = source[i]
  if (open !== '[' && open !== '{') throw new Error(`${varName} 不是数组/对象`)
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let inStr = null
  let escape = false
  for (let k = i; k < source.length; k++) {
    const ch = source[k]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        const lit = source.slice(i, k + 1)
        // 模板字符串 → 普通字符串，避免 eval 失败
        const normalized = lit
          .replace(/`([^`]*)`/g, (_, inner) => JSON.stringify(inner))
          .replace(/,\s*([\]}])/g, '$1')
        return Function(`"use strict"; return (${normalized})`)()
      }
    }
  }
  throw new Error(`解析 ${varName} 失败`)
}

function extractQuestionBankObject(html) {
  const marker = 'const questionBank = '
  const start = html.indexOf(marker)
  if (start < 0) throw new Error('找不到 questionBank')
  let i = start + marker.length
  while (i < html.length && /\s/.test(html[i])) i++
  if (html[i] !== '{') throw new Error('questionBank 不是对象')
  let depth = 0
  let inStr = null
  let escape = false
  for (let k = i; k < html.length; k++) {
    const ch = html[k]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return Function(`"use strict"; return (${html.slice(i, k + 1)})`)()
      }
    }
  }
  throw new Error('解析 questionBank 失败')
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 ${url} (${res.status})`)
  return await res.text()
}

function convertQingxing(html) {
  const list = extractJsArray(html, 'questionBank')
  return list.map((item) => {
    const opts = (item.opts || []).map(stripOptPrefix)
    return qRow('单选', item.q, {
      ...fillOptions(opts),
      答案: String(item.ans || '').trim().toUpperCase(),
    })
  })
}

function convertXigai(html) {
  const bank = extractQuestionBankObject(html)
  const out = []
  for (const item of bank.single || []) {
    out.push(
      qRow('单选', item.q, {
        ...fillOptions(item.options || []),
        答案: idxToLetter(item.answer),
        标签: item.page || '',
      }),
    )
  }
  for (const item of bank.multiple || []) {
    const ans = (item.answer || []).map(idxToLetter).join(',')
    out.push(
      qRow('多选', item.q, {
        ...fillOptions(item.options || []),
        答案: ans,
        标签: item.page || '',
      }),
    )
  }
  for (const item of bank.judge || []) {
    out.push(
      qRow('判断', item.q, {
        选项A: '正确',
        选项B: '错误',
        答案: item.answer ? '正确' : '错误',
        标签: item.page || '',
      }),
    )
  }
  return out
}

function convertNihongo(html) {
  const out = []
  const rd = extractJsArray(html, 'RD_DATA')
  for (const item of rd) {
    out.push(
      qRow('单选', `「${item.word}」の正しい読み方を選びなさい。\n${item.sentence || ''}`, {
        ...fillOptions(item.options || []),
        答案: idxToLetter(item.correct_index),
        解析: item.reading ? `読み：${item.reading}` : '',
        标签: '単語読み',
      }),
    )
  }
  const kj = extractJsArray(html, 'KJ_DATA')
  for (const item of kj) {
    const opts = item.options || []
    // options 可能不含正确答案，补上 kanji
    const all = opts.includes(item.kanji) ? opts : [...opts, item.kanji]
    const ansIdx = all.indexOf(item.kanji)
    out.push(
      qRow('单选', `次の仮名の正しい漢字表記を選びなさい：${item.kana}`, {
        ...fillOptions(all),
        答案: idxToLetter(ansIdx >= 0 ? ansIdx : 0),
        解析: item.kanji || '',
        标签: '漢字',
      }),
    )
  }
  const gg = extractJsArray(html, 'GG_DATA')
  for (const item of gg) {
    const texts = Array.isArray(item.accept) && item.accept.length ? item.accept : [item.meaning]
    out.push(
      qRow('填空', `次の外来語を中国語に訳しなさい：${item.word}`, {
        答案: texts.map((t) => String(t).trim()).filter(Boolean).join('|'),
        解析: item.meaning || '',
        标签: '外来語',
      }),
    )
  }
  const gr = extractJsArray(html, 'GR_DATA')
  for (const item of gr) {
    const ans =
      typeof item.correct_index === 'number'
        ? idxToLetter(item.correct_index)
        : typeof item.answer === 'number'
          ? idxToLetter(item.answer)
          : String(item.answer || item.correct || '').trim()
    out.push(
      qRow('单选', item.stem || item.question || '', {
        ...fillOptions(item.options || []),
        答案: ans.length === 1 ? ans.toUpperCase() : ans,
        解析: item.explanation || item.analysis || '',
        标签: '文法',
      }),
    )
  }
  return out
}

function convertEmbed(js) {
  const list = extractJsArray(js, 'questionList')
  return list.map((item) => {
    const typeMap = { radio: '单选', checkbox: '多选', fill: '填空', judge: '判断' }
    const type = typeMap[item.type] || '单选'
    const img = item.img ? String(item.img) : ''
    if (type === '填空') {
      // 原站用顿号/逗号分隔多空
      const ans = String(item.answer || '')
        .split(/[、,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .join('|')
      return qRow('填空', item.title, { 答案: ans, 图片: img })
    }
    if (type === '判断') {
      const ansRaw = String(item.answer || 'A').toUpperCase()
      return qRow('判断', item.title, {
        选项A: '正确',
        选项B: '错误',
        答案: ansRaw === 'A' || ansRaw === '对' || ansRaw === '正确' ? '正确' : '错误',
        图片: img,
      })
    }
    return qRow(type, item.title, {
      ...fillOptions(item.options || []),
      答案: String(item.answer || '').toUpperCase().replace(/\s/g, ''),
      图片: img,
    })
  })
}

function convertComm(js) {
  const list = extractJsArray(js, 'questionList')
  return list.map((item) => {
    if (item.type === 'calc') {
      return qRow('简答', item.question, {
        答案: item.answer || '',
        解析: item.explanation || '',
        图片: item.image || '',
        标签: item.chapter || '',
      })
    }
    if (item.type === 'judge') {
      const ans = String(item.answer || '').toUpperCase()
      const isTrue = ['A', '对', '正确', 'TRUE', 'T'].includes(ans) || item.answer === true
      return qRow('判断', item.question, {
        选项A: '正确',
        选项B: '错误',
        答案: isTrue ? '正确' : '错误',
        解析: item.explanation || '',
        图片: item.image || '',
        标签: item.chapter || '',
      })
    }
    const opts = (item.options || []).map((o) => (typeof o === 'string' ? o : o.text || ''))
    return qRow('单选', item.question, {
      ...fillOptions(opts),
      答案: String(item.answer || '').toUpperCase(),
      解析: item.explanation || '',
      图片: item.image || '',
      标签: item.chapter || '',
    })
  })
}

function convertRtthread(jsonText) {
  const list = JSON.parse(jsonText)
  return list.map((item) => {
    const tag = [item.topic, item.week != null ? `第${item.week}周` : ''].filter(Boolean).join(',')
    const expl = [item.analysis, item.memoryTip].filter(Boolean).join('\n')
    if (item.type === 'fill_blank') {
      const ans = (item.answers || []).map((a) => a.primary || (a.accepted && a.accepted[0]) || '').join('|')
      return qRow('填空', item.title, { 答案: ans, 解析: expl, 标签: tag })
    }
    // single_choice
    const opts = (item.options || []).map((o) => o.text || o.label || '')
    return qRow('单选', item.title, {
      ...fillOptions(opts),
      答案: String(item.correctAnswer || item.answer || '').toUpperCase(),
      解析: expl,
      标签: tag,
    })
  })
}

async function convertOne(src) {
  console.log(`→ ${src.key}`)
  const text = await fetchText(src.url)
  let questions
  switch (src.key) {
    case 'qingxingsai':
      questions = convertQingxing(text)
      break
    case 'xigai':
      questions = convertXigai(text)
      break
    case 'nihongo':
      questions = convertNihongo(text)
      break
    case 'embed':
      questions = convertEmbed(text)
      break
    case 'comm':
      questions = convertComm(text)
      break
    case 'rtthread':
      questions = convertRtthread(text)
      break
    default:
      throw new Error(`未知源 ${src.key}`)
  }
  questions = questions.filter((q) => q.题干)
  const payload = {
    name: src.name,
    description: src.description,
    tags: [BANK_TAG],
    questions,
  }
  const outPath = path.join(outDir, src.file)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`  [ok] ${src.file} · ${questions.length} 题 · 标签 ${BANK_TAG}`)
  return questions.length
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  let total = 0
  for (const src of SOURCES) {
    try {
      total += await convertOne(src)
    } catch (e) {
      console.error(`  [fail] ${src.key}:`, e.message || e)
      process.exitCode = 1
    }
  }
  console.log(`Done. ${SOURCES.length} 库 / 共 ${total} 题 → ${path.relative(root, outDir)}`)
}

main()

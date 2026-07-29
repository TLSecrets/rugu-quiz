/**
 * 扫描 banks/ → 生成 public/generated/manifest.json 与各题库 JSON
 * 约定字段与网页导入一致：题型/题干/选项A-H/答案/解析/图片/标签/领域
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const banksDir = path.join(root, 'banks')
const outDir = path.join(root, 'public', 'generated')

const TYPE_ALIASES = {
  单选: 'single',
  单选题: 'single',
  single: 'single',
  多选: 'multiple',
  多选题: 'multiple',
  multiple: 'multiple',
  判断: 'judge',
  判断题: 'judge',
  judge: 'judge',
  填空: 'blank',
  填空题: 'blank',
  blank: 'blank',
  简答: 'short',
  简答题: 'short',
  short: 'short',
}

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const OPTION_HEADERS = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '选项G', '选项H']
const JUDGE_TRUTHY = ['对', '正确', '是', 'true', 't', '√', '1', 'yes']
const JUDGE_FALSY = ['错', '错误', '否', 'false', 'f', '×', '0', 'no']

function slugify(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'bank'
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function normalizeHeader(header) {
  const h = String(header ?? '').trim()
  const map = {
    type: '题型',
    类型: '题型',
    stem: '题干',
    题目: '题干',
    answer: '答案',
    explanation: '解析',
    tags: '标签',
    domain: '领域',
    分类: '领域',
    category: '领域',
    images: '图片',
    image: '图片',
  }
  const lower = h.toLowerCase().replace(/\s/g, '')
  return map[lower] ?? map[h] ?? h
}

function createId(prefix, seed) {
  return `${prefix}-${seed}`
}

function parseMedia(raw, qid) {
  const media = []
  const answerMedia = []
  if (!raw?.trim()) return { media, answerMedia }
  String(raw)
    .split(/[;；]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((part, index) => {
      const isAnswer = /^答案[:：]/i.test(part)
      const src = part.replace(/^答案[:：]\s*/i, '').trim()
      if (!src) return
      const item = {
        id: `${qid}-img-${index}`,
        mime: 'image/*',
        src,
        placement: isAnswer ? 'in-answer' : 'unknown',
        alt: isAnswer ? '答案配图' : '题目配图',
      }
      if (isAnswer) answerMedia.push(item)
      else media.push(item)
    })
  return { media, answerMedia }
}

function buildOptions(row, type) {
  if (type === 'blank' || type === 'short') return undefined
  if (type === 'judge') {
    return [
      { id: 'opt-true', key: 'true', label: 'A', content: row['选项A'] || '正确' },
      { id: 'opt-false', key: 'false', label: 'B', content: row['选项B'] || '错误' },
    ]
  }
  const options = []
  OPTION_HEADERS.forEach((header, i) => {
    const content = String(row[header] ?? '').trim()
    if (!content) return
    options.push({
      id: `opt-${OPTION_KEYS[i]}`,
      key: OPTION_KEYS[i],
      label: header.replace('选项', ''),
      content,
    })
  })
  return options.length ? options : undefined
}

function parseAnswer(type, raw, options) {
  const answer = String(raw ?? '').trim()
  if (type === 'blank' || type === 'short') {
    return {
      texts: answer
        .split(/[|｜]/)
        .map((t) => t.trim())
        .filter(Boolean),
    }
  }
  if (type === 'judge') {
    const n = answer.replace(/\s/g, '')
    if (['错', '错误', '否', 'false', 'f', '×', 'B', 'b'].includes(n)) return { optionKeys: ['false'] }
    return { optionKeys: ['true'] }
  }
  const keys = answer
    .split(/[,，、\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => {
      const upper = token.toUpperCase()
      if (/^[A-H]$/.test(upper)) return OPTION_KEYS[upper.charCodeAt(0) - 65]
      return options?.find((o) => o.key === token.toLowerCase())?.key
    })
    .filter(Boolean)
  return { optionKeys: [...new Set(keys)] }
}

function cell(row, key) {
  return String(row[key] ?? '').trim()
}

function inferType(row) {
  const stem = cell(row, '题干')
  const answer = cell(row, '答案')
  const filled = OPTION_HEADERS.map((h) => cell(row, h)).filter(Boolean)
  const answerNorm = answer.replace(/\s/g, '')
  const isJudgeWord =
    JUDGE_TRUTHY.includes(answerNorm.toLowerCase()) ||
    JUDGE_FALSY.includes(answerNorm.toLowerCase()) ||
    JUDGE_TRUTHY.includes(answerNorm) ||
    JUDGE_FALSY.includes(answerNorm)

  if (isJudgeWord && filled.length === 0) return 'judge'
  if (filled.length === 0 && /（\s*）|\(\s*\)|_{2,}|＿{2,}/.test(stem)) return 'blank'
  if (filled.length === 2 && !cell(row, '选项C')) {
    const a = cell(row, '选项A')
    const b = cell(row, '选项B')
    const abJudge =
      (JUDGE_TRUTHY.includes(a) || JUDGE_FALSY.includes(a)) &&
      (JUDGE_TRUTHY.includes(b) || JUDGE_FALSY.includes(b))
    if (abJudge || isJudgeWord) return 'judge'
    return 'single'
  }
  if (filled.length >= 2) {
    const letters = answer
      .toUpperCase()
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter((t) => /^[A-H]$/.test(t))
    if (letters.length >= 2) return 'multiple'
    return 'single'
  }
  if (filled.length === 0 && answer.length >= 12) return 'short'
  return answer ? 'blank' : 'short'
}

function rowsToQuestions(rows, bankId, fileName) {
  const questions = []
  const issues = []
  rows.forEach((row, idx) => {
    const stem = String(row['题干'] ?? '').trim()
    const typeRaw = String(row['题型'] ?? '').trim()
    if (!stem && !typeRaw) return
    let type = TYPE_ALIASES[typeRaw] ?? TYPE_ALIASES[typeRaw.toLowerCase()]
    if (!type && !typeRaw && stem) {
      type = inferType(row)
      issues.push(`行 ${row.rowNum ?? idx + 1}: 题型已自动识别为 ${type}`)
    }
    if (!type) {
      issues.push(`行 ${row.rowNum ?? idx + 1}: 题型无效`)
      return
    }
    if (!stem) {
      issues.push(`行 ${row.rowNum ?? idx + 1}: 缺少题干`)
      return
    }
    const id = createId('q', `${bankId}-${idx + 1}`)
    const options = buildOptions(row, type)
    const { media, answerMedia } = parseMedia(row['图片'], id)
    questions.push({
      id,
      bankId,
      type,
      stem,
      media,
      options,
      answer: {
        ...parseAnswer(type, row['答案'], options),
        explanation: String(row['解析'] ?? '').trim() || undefined,
        media: answerMedia.length ? answerMedia : undefined,
      },
      tags: String(row['标签'] ?? '')
        .split(/[,，;；]/)
        .map((t) => t.trim())
        .filter(Boolean),
      domain:
        String(row['领域'] ?? '').trim() ||
        String(row['标签'] ?? '')
          .split(/[,，;；]/)
          .map((t) => t.trim())
          .filter(Boolean)[0] ||
        undefined,
      sourceMeta: { fileName, row: row.rowNum ?? idx + 1, inferredType: !typeRaw },
    })
  })
  return { questions, issues }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
    row = []
  }
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cell += ch
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',') pushCell()
    else if (ch === '\n') pushRow()
    else if (ch !== '\r') cell += ch
  }
  if (cell.length || row.length) pushRow()
  return rows
}

function matrixToRows(matrix) {
  if (matrix.length < 2) return []
  const headers = matrix[0].map(normalizeHeader)
  const rows = []
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i]
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue
    const row = { rowNum: i + 1 }
    headers.forEach((h, idx) => {
      if (h) row[h] = String(cells[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

async function parseFile(filePath) {
  const fileName = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const bankId = `generated-${slugify(fileName)}`
  const rel = path.relative(banksDir, filePath).replace(/\\/g, '/')

  if (ext === '.json') {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (Array.isArray(data?.questions) || data?.name) {
      // 若已是结构化，尽量直接用；表格式走 rows
      if (Array.isArray(data.questions) && data.questions[0]?.stem) {
        const questions = data.questions.map((q, i) => ({
          ...q,
          id: q.id || createId('q', `${bankId}-${i + 1}`),
          bankId,
          media: q.media || [],
        }))
        return {
          bank: {
            id: bankId,
            name: data.name || slugify(fileName),
            description: data.description || `构建自 ${rel}`,
            source: 'generated',
            questionCount: questions.length,
            file: rel,
            tags: Array.isArray(data.tags) ? data.tags.map(String).filter(Boolean) : undefined,
          },
          questions,
          issues: [],
        }
      }
      if (Array.isArray(data.questions)) {
        const { questions, issues } = rowsToQuestions(data.questions.map((r, i) => ({ ...r, rowNum: i + 1 })), bankId, fileName)
        return {
          bank: {
            id: bankId,
            name: data.name || slugify(fileName),
            description: data.description || `构建自 ${rel}`,
            source: 'generated',
            questionCount: questions.length,
            file: rel,
            tags: Array.isArray(data.tags) ? data.tags.map(String).filter(Boolean) : undefined,
          },
          questions,
          issues,
        }
      }
      if (Array.isArray(data)) {
        const { questions, issues } = rowsToQuestions(data.map((r, i) => ({ ...r, rowNum: i + 1 })), bankId, fileName)
        return {
          bank: {
            id: bankId,
            name: slugify(fileName),
            description: `构建自 ${rel}`,
            source: 'generated',
            questionCount: questions.length,
            file: rel,
          },
          questions,
          issues,
        }
      }
    }
    throw new Error('无法识别的 JSON 结构')
  }

  if (ext === '.csv') {
    const matrix = parseCsv(fs.readFileSync(filePath, 'utf8'))
    const { questions, issues } = rowsToQuestions(matrixToRows(matrix), bankId, fileName)
    return {
      bank: {
        id: bankId,
        name: slugify(fileName),
        description: `构建自 ${rel}`,
        source: 'generated',
        questionCount: questions.length,
        file: rel,
      },
      questions,
      issues,
    }
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    const { questions, issues } = rowsToQuestions(matrixToRows(matrix), bankId, fileName)
    return {
      bank: {
        id: bankId,
        name: slugify(fileName),
        description: `构建自 ${rel}`,
        source: 'generated',
        questionCount: questions.length,
        file: rel,
      },
      questions,
      issues,
    }
  }

  if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath)
    const text = (await mammoth.extractRawText({ buffer })).value
    const blocks = text
      .replace(/\r\n/g, '\n')
      .split(/\n\s*---\s*\n|\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
    const fieldRe =
      /^(题型|题干|选项A|选项B|选项C|选项D|选项E|选项F|选项G|选项H|答案|解析|图片|标签|领域)\s*[:：]\s*(.*)$/
    const rows = []
    let rowNum = 1
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      const row = { rowNum: rowNum++ }
      for (const line of lines) {
        const m = fieldRe.exec(line)
        if (m) row[m[1]] = m[2]
      }
      if (row.题干 || row.题型) rows.push(row)
    }
    const { questions, issues } = rowsToQuestions(rows, bankId, fileName)
    return {
      bank: {
        id: bankId,
        name: slugify(fileName),
        description: `构建自 ${rel}`,
        source: 'generated',
        questionCount: questions.length,
        file: rel,
      },
      questions,
      issues,
    }
  }

  return null
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  for (const f of fs.readdirSync(outDir)) {
    if (f === '.gitkeep') continue
    fs.rmSync(path.join(outDir, f), { force: true, recursive: true })
  }

  const files = walk(banksDir).filter((f) =>
    /\.(json|csv|xlsx|xls|docx)$/i.test(f),
  )

  const manifest = {
    generatedAt: new Date().toISOString(),
    banks: [],
  }

  for (const file of files) {
    try {
      const parsed = await parseFile(file)
      if (!parsed) continue
      const now = Date.now()
      const bank = {
        ...parsed.bank,
        createdAt: now,
        updatedAt: now,
        questionCount: parsed.questions.length,
      }
      const outName = `${bank.id}.json`
      fs.writeFileSync(
        path.join(outDir, outName),
        JSON.stringify({ bank, questions: parsed.questions }, null, 2),
        'utf8',
      )
      manifest.banks.push({
        id: bank.id,
        name: bank.name,
        description: bank.description,
        questionCount: bank.questionCount,
        file: parsed.bank.file,
        dataFile: outName,
        issues: parsed.issues,
      })
      if (parsed.issues.length) {
        console.warn(`[warn] ${file}: ${parsed.issues.join('; ')}`)
      } else {
        console.log(`[ok] ${file} → ${parsed.questions.length} 题`)
      }
    } catch (e) {
      console.error(`[fail] ${file}:`, e.message || e)
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`Done. ${manifest.banks.length} bank(s) → public/generated/`)
}

main()

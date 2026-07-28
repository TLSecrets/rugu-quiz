/**
 * 生成 public/templates 下可下载模板，以及 banks/examples 示例题库
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const templatesDir = path.join(root, 'public', 'templates')
const examplesDir = path.join(root, 'banks', 'examples')

const sampleRows = [
  {
    题型: '单选',
    题干: 'GitHub Pages 适合部署哪类应用？',
    选项A: '纯静态前端',
    选项B: '必须有服务端 Session 的应用',
    选项C: '仅限桌面客户端',
    选项D: '仅限 Docker 容器',
    答案: 'A',
    解析: 'Pages 托管静态资源。',
    图片: '',
    标签: '部署',
  },
  {
    题型: '多选',
    题干: '下列哪些属于本项目支持的题型？',
    选项A: '单选',
    选项B: '多选',
    选项C: '判断',
    选项D: '填空',
    选项E: '简答',
    选项F: '',
    答案: 'A,B,C,D,E',
    解析: '五种题型均支持。',
    图片: '',
    标签: '题型',
  },
  {
    题型: '判断',
    题干: '导入图片位置无法识别时可标记为 unknown。',
    选项A: '正确',
    选项B: '错误',
    选项C: '',
    选项D: '',
    答案: '正确',
    解析: 'UI 会分区展示未识别配图。',
    图片: '',
    标签: '媒体',
  },
  {
    题型: '填空',
    题干: '默认状态管理是 ____，本地库是 ____。',
    选项A: '',
    选项B: '',
    选项C: '',
    选项D: '',
    答案: 'Pinia|Dexie',
    解析: '多空用 | 分隔。',
    图片: '',
    标签: '技术栈',
  },
  {
    题型: '简答',
    题干: '简述选项乱序时为何要用稳定 key 判题。',
    选项A: '',
    选项B: '',
    选项C: '',
    选项D: '',
    答案: '显示标签 A/B/C 会随乱序变化，key 不变才能正确对答案。',
    解析: 'label 仅用于展示。',
    图片: '',
    标签: '练习',
  },
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeCsv(filePath, rows) {
  const headers = ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '答案', '解析', '图片', '标签']
  const escape = (v) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  fs.writeFileSync(filePath, `\uFEFF${lines.join('\n')}`, 'utf8')
}

function writeXlsx(filePath, rows, sheetName) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  XLSX.writeFile(book, filePath)
}

function writeJsonTemplate(filePath) {
  const payload = {
    name: '题库模板',
    description: '结构化 JSON 模板。也可使用 questions 为表格式对象数组。',
    questions: [
      {
        type: 'single',
        stem: '示例单选题干',
        options: [
          { key: 'a', label: 'A', content: '选项一' },
          { key: 'b', label: 'B', content: '选项二' },
          { key: 'c', label: 'C', content: '选项三' },
          { key: 'd', label: 'D', content: '选项四' },
        ],
        answer: { optionKeys: ['a'], explanation: '解析示例' },
        tags: ['示例'],
        media: [],
      },
      {
        type: 'blank',
        stem: '填空示例：____ 与 ____',
        answer: { texts: ['答案1', '答案2'], explanation: '多空用数组' },
        tags: ['示例'],
        media: [],
      },
    ],
  }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

function writeDocxTemplate(filePath, bodyText) {
  // 动态导入 jszip（generate 脚本使用）
  return import('jszip').then(async ({ default: JSZip }) => {
    const escapeXml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const paragraphs = bodyText
      .split('\n')
      .map((line) => {
        if (!line.trim()) {
          return '<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:p>'
        }
        return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
      })
      .join('')

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`

    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    )
    zip.folder('_rels')?.file(
      '.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    )
    zip.folder('word')?.file('document.xml', documentXml)
    const buf = await zip.generateAsync({ type: 'nodebuffer' })
    fs.writeFileSync(filePath, buf)
  })
}

async function writeDocxTextTemplate(filePath) {
  const body = `题型：单选
题干：这是 Word 模板中的示例单选题
选项A：选项一
选项B：选项二
选项C：选项三
选项D：选项四
答案：A
解析：按字段书写，题目之间用空行或 --- 分隔。
标签：示例

---

题型：判断
题干：Word 也可用表格（表头与 Excel 相同）导入。
选项A：正确
选项B：错误
答案：正确
解析：优先识别文档中的第一张表。
标签：导入
`
  fs.writeFileSync(filePath.replace(/\.docx$/, '.docx.txt'), body, 'utf8')
  await writeDocxTemplate(filePath, body)
}

ensureDir(templatesDir)
ensureDir(examplesDir)

async function main() {
  writeCsv(path.join(templatesDir, '题库模板.csv'), sampleRows)
  writeCsv(
    path.join(templatesDir, '单选题与多选题.csv'),
    sampleRows.filter((r) => r.题型 === '单选' || r.题型 === '多选'),
  )
  writeCsv(
    path.join(templatesDir, '判断题.csv'),
    sampleRows.filter((r) => r.题型 === '判断'),
  )
  writeCsv(
    path.join(templatesDir, '填空与简答.csv'),
    sampleRows.filter((r) => r.题型 === '填空' || r.题型 === '简答'),
  )

  writeXlsx(path.join(templatesDir, '综合题型.xlsx'), sampleRows, '题库')
  writeXlsx(
    path.join(templatesDir, '单选题与多选题.xlsx'),
    sampleRows.filter((r) => r.题型 === '单选' || r.题型 === '多选'),
    '选择题',
  )
  writeXlsx(
    path.join(templatesDir, '判断题.xlsx'),
    sampleRows.filter((r) => r.题型 === '判断'),
    '判断题',
  )
  writeXlsx(
    path.join(templatesDir, '填空与简答.xlsx'),
    sampleRows.filter((r) => r.题型 === '填空' || r.题型 === '简答'),
    '填空简答',
  )

  writeJsonTemplate(path.join(templatesDir, '题库模板.json'))

  const readme = `# 导入模板字段说明

| 字段 | 说明 |
|------|------|
| 题型 | 单选 / 多选 / 判断 / 填空 / 简答 |
| 题干 | 题目正文 |
| 选项A–F | 选择题、判断题使用；判断默认 A=正确 B=错误 |
| 答案 | 单选如 \`A\`；多选如 \`A,C\`；判断 \`正确/错误\`；填空多空用 \`|\` 分隔 |
| 解析 | 可选 |
| 图片 | 多图用 \`;\` 分隔；答案图加前缀 \`答案:\`；位置不明时按 unknown 展示 |
| 标签 | 可选，逗号分隔 |

## 文件

- \`综合题型.xlsx\` / 分题型 xlsx
- \`题库模板.csv\` / 分题型 csv
- \`题库模板.json\` 结构化 JSON
- \`题库模板.docx\` Word 字段模板（也支持表格，表头同上）
- \`题库模板.docx.txt\` 纯文本对照

题目之间用空行或 \`---\` 分隔。
`

  fs.writeFileSync(path.join(templatesDir, '字段说明.md'), readme, 'utf8')

  writeCsv(path.join(examplesDir, '构建示例.csv'), sampleRows)
  fs.writeFileSync(
    path.join(examplesDir, '构建示例.json'),
    JSON.stringify(
      {
        name: '构建示例题库',
        description: '放在 banks/examples，执行 npm run build:banks 后进入站点',
        questions: sampleRows,
      },
      null,
      2,
    ),
    'utf8',
  )

  await writeDocxTextTemplate(path.join(templatesDir, '题库模板.docx'))
  console.log('Templates and examples generated.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

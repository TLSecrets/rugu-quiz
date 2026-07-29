import type { Bank, Question, QuestionMedia } from '@/types/question'

/** 简单 SVG 占位图，用于验证多图 / 分区展示 */
function placeholderSvg(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 28% 28%)"/>
      <stop offset="100%" stop-color="hsl(${hue + 24} 32% 18%)"/>
    </linearGradient>
  </defs>
  <rect width="480" height="240" rx="12" fill="url(#g)"/>
  <text x="240" y="120" text-anchor="middle" fill="#d7e4ef" font-family="sans-serif" font-size="22">${label}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function media(
  id: string,
  label: string,
  placement: QuestionMedia['placement'],
  hue: number,
  alt?: string,
): QuestionMedia {
  return {
    id,
    mime: 'image/svg+xml',
    src: placeholderSvg(label, hue),
    placement,
    alt: alt ?? label,
  }
}

export const SAMPLE_BANK_ID = 'bank-sample-demo'

export const sampleBank: Bank = {
  id: SAMPLE_BANK_ID,
  name: '示例题库 · 入门演示',
  description: '覆盖五种题型，含多图占位、公式与表格样例。',
  source: 'builtin',
  questionCount: 10,
  tags: ['2025-2026', '示例'],
  createdAt: 0,
  updatedAt: 0,
}

export const sampleQuestions: Question[] = [
  {
    id: 'q-sample-01',
    bankId: SAMPLE_BANK_ID,
    type: 'single',
    stem: '下列哪个是「如故题库」Phase 1 已完成的内容？',
    media: [media('m1', '界面骨架示意', 'after-stem', 198)],
    options: [
      { id: 'o1', key: 'a', label: 'A', content: '页面骨架与深色主题' },
      { id: 'o2', key: 'b', label: 'B', content: 'DeepSeek 自动扣费代管' },
      { id: 'o3', key: 'c', label: 'C', content: '账号登录与云同步' },
      { id: 'o4', key: 'd', label: 'D', content: 'Docker 一键部署' },
    ],
    answer: {
      optionKeys: ['a'],
      explanation: 'Phase 1 只交付可运行的 UI 壳与路由，不含账号与 Docker。',
    },
    tags: ['产品', '阶段'],
    domain: '产品',
  },
  {
    id: 'q-sample-02',
    bankId: SAMPLE_BANK_ID,
    type: 'multiple',
    stem: '纯前端刷题站适合采用哪些技术约束？（多选）',
    media: [],
    options: [
      { id: 'o1', key: 'a', label: 'A', content: 'GitHub Pages 静态部署' },
      { id: 'o2', key: 'b', label: 'B', content: 'IndexedDB 本地持久化' },
      { id: 'o3', key: 'c', label: 'C', content: '必须自建后端账号体系' },
      { id: 'o4', key: 'd', label: 'D', content: 'Hash 路由避免服务端 rewrite' },
    ],
    answer: {
      optionKeys: ['a', 'b', 'd'],
      explanation: '无后端场景下用 Pages + IndexedDB + Hash 路由即可。',
    },
    tags: ['架构'],
    domain: '架构',
  },
  {
    id: 'q-sample-03',
    bankId: SAMPLE_BANK_ID,
    type: 'judge',
    stem: '题目与答案都可以包含多张图片，且图片位置可能无法从源文件可靠识别。',
    media: [
      media('m1', '题干图 1', 'after-stem', 210),
      media('m2', '位置未识别', 'unknown', 170, '位置未知的示意图片'),
    ],
    options: [
      { id: 'o1', key: 'true', label: 'A', content: '正确' },
      { id: 'o2', key: 'false', label: 'B', content: '错误' },
    ],
    answer: {
      optionKeys: ['true'],
      explanation: '统一模型用 placement / unknown 分区展示。',
      media: [media('ma1', '答案附图', 'in-answer', 160)],
    },
    tags: ['媒体'],
    domain: '媒体',
  },
  {
    id: 'q-sample-04',
    bankId: SAMPLE_BANK_ID,
    type: 'blank',
    stem: '本项目默认使用的状态管理库是 ____，本地数据库库是 ____。',
    media: [],
    answer: {
      texts: ['Pinia', 'Dexie'],
      explanation: 'Pinia 管运行时状态，Dexie 封装 IndexedDB。',
    },
    tags: ['技术栈'],
    domain: '技术栈',
  },
  {
    id: 'q-sample-05',
    bankId: SAMPLE_BANK_ID,
    type: 'short',
    stem: '简述「仓库 banks/ 构建收录」与「浏览器手动导入」各自解决什么问题。',
    media: [media('m1', '双通道示意', 'after-stem', 190)],
    answer: {
      texts: [
        '构建收录解决 GitHub Pages 无法运行时扫盘的问题；浏览器导入解决用户本地临时加题、不进仓库的需求。',
      ],
      explanation: '两通道并存，导入结果都规范化进同一 Question 模型。',
      media: [media('ma1', '规范化流程', 'in-answer', 205)],
    },
    tags: ['架构'],
    domain: '架构',
  },
  {
    id: 'q-sample-06',
    bankId: SAMPLE_BANK_ID,
    type: 'single',
    stem: '选项乱序时，判题应依赖哪一项？',
    media: [],
    options: [
      {
        id: 'o1',
        key: 'a',
        label: 'A',
        content: '显示标签 A/B/C',
        media: [media('om1', '标签会变', 'inline', 20)],
      },
      { id: 'o2', key: 'b', label: 'B', content: '选项稳定 key' },
      { id: 'o3', key: 'c', label: 'C', content: '选项在数组中的下标' },
      { id: 'o4', key: 'd', label: 'D', content: '题干哈希' },
    ],
    answer: {
      optionKeys: ['b'],
      explanation: 'label 可重排，key 保持不变。',
    },
    tags: ['练习'],
    domain: '练习',
  },
  {
    id: 'q-sample-07',
    bankId: SAMPLE_BANK_ID,
    type: 'multiple',
    stem: '以下哪些属于本项目明确不做的功能？',
    media: [media('m1', '范围边界', 'after-options', 220)],
    options: [
      { id: 'o1', key: 'a', label: 'A', content: '账号登录' },
      { id: 'o2', key: 'b', label: 'B', content: '考试计时' },
      { id: 'o3', key: 'c', label: 'C', content: '收藏与笔记' },
      { id: 'o4', key: 'd', label: 'D', content: 'Docker 部署' },
    ],
    answer: {
      optionKeys: ['a', 'b', 'd'],
      explanation: '收藏与笔记是 P0；登录、计时、Docker 为排除项。',
    },
    tags: ['范围'],
    domain: '产品',
  },
  {
    id: 'q-sample-08',
    bankId: SAMPLE_BANK_ID,
    type: 'judge',
    stem: 'AI 辅助导入时，用户 API Key 应只保存在本机，并由浏览器直连 DeepSeek。',
    media: [],
    options: [
      { id: 'o1', key: 'true', label: 'A', content: '正确' },
      { id: 'o2', key: 'false', label: 'B', content: '错误' },
    ],
    answer: {
      optionKeys: ['true'],
      explanation: '不经第三方中转，Key 不得写入仓库。',
    },
    tags: ['安全', 'AI'],
    domain: '安全',
  },
  {
    id: 'q-sample-09',
    bankId: SAMPLE_BANK_ID,
    type: 'single',
    stem: '质能方程 $E=mc^2$ 中，$c$ 表示什么？\n\n可用行内公式与 **Markdown** 混排。',
    media: [],
    options: [
      { id: 'o1', key: 'a', label: 'A', content: '光速' },
      { id: 'o2', key: 'b', label: 'B', content: '声速' },
      { id: 'o3', key: 'c', label: 'C', content: '电荷量' },
      { id: 'o4', key: 'd', label: 'D', content: '普朗克常数' },
    ],
    answer: {
      optionKeys: ['a'],
      explanation:
        '其中 $E$ 为能量，$m$ 为质量，$c$ 为真空中光速。块级公式示例：\n\n$$\nE = mc^2\n$$',
    },
    tags: ['公式', '物理'],
    domain: '公式',
  },
  {
    id: 'q-sample-10',
    bankId: SAMPLE_BANK_ID,
    type: 'short',
    stem: '根据下表说明「纯前端」部署方式，并写出勾股定理 $a^2+b^2=c^2$。\n\n| 方案 | 是否需要后端 |\n| --- | --- |\n| GitHub Pages | 否 |\n| 自建 API | 是 |',
    media: [],
    answer: {
      texts: ['GitHub Pages 无需后端；勾股定理为直角三角形两直角边平方和等于斜边平方。'],
      explanation: '表格由 Markdown 渲染；公式 $a^{2}+b^{2}=c^{2}$ 由 KaTeX 渲染。',
    },
    tags: ['公式', '表格'],
    domain: '公式',
  },
]

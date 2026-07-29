<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'

const toc = [
  { id: 'overview', label: '概览' },
  { id: 'banks-tags', label: '题库与标签' },
  { id: 'practice-exam', label: '练习与考试' },
  { id: 'learning', label: '错题 · 收藏 · 笔记' },
  { id: 'import-export', label: '导入导出与 AI' },
  { id: 'settings', label: '设置' },
  { id: 'non-goals', label: '明确不做' },
] as const

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <PageHeader title="使用手册" subtitle="如故题库使用说明：数据在本机，无需注册。">
    <nav class="toc card" aria-label="目录">
      <p class="toc__title">目录</p>
      <ol>
        <li v-for="item in toc" :key="item.id">
          <button type="button" class="toc__link" @click="scrollToSection(item.id)">
            {{ item.label }}
          </button>
        </li>
      </ol>
    </nav>

    <section id="overview" class="card">
      <h3 class="card__title">概览</h3>
      <p>
        如故题库是纯前端刷题站，题库、收藏、笔记、错题与设置保存在浏览器
        IndexedDB，不依赖后端账号。适合部署到 GitHub Pages 自用或班级分享。
      </p>
      <ul>
        <li>题型：单选、多选、判断、填空、简答；支持 Markdown 与 LaTeX（$…$ / $$…$$）</li>
        <li>来源：仓库 <code>banks/</code> 构建同步、浏览器导入、可选 AI 辅助整理</li>
        <li>学习：练习、不限时模拟考试、搜索、收藏、笔记、持久错题本、PDF 导出</li>
      </ul>
    </section>

    <section id="banks-tags" class="card">
      <h3 class="card__title">题库与标签</h3>
      <p>
        在「题库」页可为题库设置标签（如学年 <code>2025-2026-2</code>），并在标签目录中统一添加、重命名、删除。
        删除标签会从所有题库上移除该标签。
      </p>
      <p>
        <strong>多标签筛选</strong>出现在题库列表、练习选题库、考试选题库等处：
      </p>
      <ul>
        <li>
          <strong>或运算（默认）</strong>：题库只要带有所选标签中的<strong>任意一个</strong>就会显示。例如选
          A、B，则带 A 或带 B 或两者都有的题库都会出现。
        </li>
        <li>
          <strong>与运算</strong>：题库必须<strong>同时包含</strong>全部所选标签。例如选 A、B，则只有同时有 A 和 B
          的题库会出现。
        </li>
      </ul>
      <p>
        可在
        <RouterLink class="link" to="/settings">设置 → 题库标签筛选</RouterLink>
        切换；筛选区域也会显示当前是「或」还是「与」。
      </p>
      <p>搜索页的「题库标签」目前为单选，不受该设置影响。</p>
    </section>

    <section id="practice-exam" class="card">
      <h3 class="card__title">练习与考试</h3>
      <h4 class="card__sub">练习</h4>
      <ul>
        <li>可选顺序 / 随机、多题库、题型过滤、选项乱序、答后自动下一题、即时或手动看答案</li>
        <li>可用标签缩小题库列表后「全选当前列表」，再开始刷题</li>
        <li>答题中可用题号导航跳转；进度保存在本机</li>
      </ul>
      <h4 class="card__sub">模拟考试</h4>
      <ul>
        <li>按题库与题型组卷，设置每题分值与抽题数量；<strong>不限时</strong></li>
        <li>可导出空白试卷 PDF；交卷后评分，简答可自评，错题可进入错题本</li>
      </ul>
    </section>

    <section id="learning" class="card">
      <h3 class="card__title">错题 · 收藏 · 笔记</h3>
      <ul>
        <li><strong>错题本</strong>：练习 / 考试判错会累计；可专项训练、筛选移出、导出 PDF</li>
        <li><strong>收藏</strong>：在答题卡收藏题目，便于复习</li>
        <li><strong>笔记</strong>：为题目写本地笔记</li>
      </ul>
    </section>

    <section id="import-export" class="card">
      <h3 class="card__title">导入导出与 AI</h3>
      <p>
        打开
        <RouterLink class="link" to="/import-export">导入导出</RouterLink>
        可下载 Excel / CSV / Word 模板，或导入已有文件。常用字段：
      </p>
      <ul>
        <li>题型（可空，系统会尝试推断）、题干、选项 A–H、答案、解析、图片、标签、领域</li>
        <li>多选答案如 <code>A,C</code>；填空多空用 <code>|</code> 分隔</li>
      </ul>
      <p>
        <strong>AI 辅助导入</strong>：在设置中填写 OpenAI 兼容 Key（默认 DeepSeek），将杂乱文本粘贴转换。Key
        只存在本机，由浏览器直连接口，费用由你的账户结算。
      </p>
      <p>
        开发者可将源文件放入仓库 <code>banks/</code>，执行 <code>npm run build:banks</code>
        生成 <code>public/generated/</code>；用户首次打开站点时会自动同步尚未入库的构建题库。
      </p>
    </section>

    <section id="settings" class="card">
      <h3 class="card__title">设置</h3>
      <ul>
        <li>主题：浅色 / 深色 / 跟随系统；阅读字号</li>
        <li>练习默认项：乱序、填空宽松匹配、自动下一题、答案展示方式、默认题型</li>
        <li>题库标签筛选：或运算 / 与运算（默认或）</li>
        <li>AI 接口：Key、Base URL、模型</li>
        <li>数据管理：可清空学习数据（保留设置），或重置全部本地数据</li>
      </ul>
      <p class="note">
        换浏览器、清站点数据或隐私模式会导致本地题库与进度消失；重要内容请自行导出备份。
      </p>
    </section>

    <section id="non-goals" class="card">
      <h3 class="card__title">明确不做</h3>
      <ul>
        <li>账号登录 / 注册 / 云同步</li>
        <li>考试计时 / 正式考场限时</li>
        <li>Docker / 自建后端</li>
      </ul>
      <p>
        更多开发与部署说明见仓库 README。返回
        <RouterLink class="link" to="/">首页</RouterLink>
        开始使用。
      </p>
    </section>
  </PageHeader>
</template>

<style scoped>
.card {
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  scroll-margin-top: 4.5rem;
}

.card__title {
  font-size: var(--font-size-md);
  margin: 0;
}

.card__sub {
  font-size: var(--font-size-sm);
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
}

.card p,
.card li {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.65;
  margin: 0;
}

.card ul {
  margin: 0;
  padding-left: 1.25em;
  display: grid;
  gap: var(--space-2);
}

.card strong {
  color: var(--color-text);
  font-weight: 600;
}

.card code {
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--color-surface-muted);
}

.toc ol {
  margin: 0;
  padding-left: 1.25em;
  display: grid;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.toc__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.toc__link {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.link {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.note {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}
</style>

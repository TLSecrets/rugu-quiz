<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useNotesStore } from '@/stores/notes'
import { useWrongsStore } from '@/stores/wrongs'

const banks = useBanksStore()
const favorites = useFavoritesStore()
const notes = useNotesStore()
const wrongs = useWrongsStore()
</script>

<template>
  <PageHeader
    title="如故题库"
    subtitle="纯前端刷题站，数据留在本机。可导入题库、收藏笔记，并一键部署到 GitHub Pages。"
  >
    <div class="hero">
      <div class="hero__panel">
        <p class="hero__eyebrow">专业 · 本地 · GitHub Pages</p>
        <h3 class="hero__lead">如故题库</h3>
        <p class="hero__text">
          当前共 {{ banks.banks.length }} 套题库、{{ banks.totalQuestions }} 道题；收藏
          {{ favorites.items.length }} · 笔记 {{ notes.items.length }} · 错题
          {{ wrongs.activeItems.length }}。
        </p>
        <div class="hero__actions">
          <RouterLink class="btn btn--primary" to="/banks">查看题库</RouterLink>
          <RouterLink class="btn btn--ghost" to="/practice">继续练习</RouterLink>
          <RouterLink class="btn btn--ghost" to="/wrong">错题本</RouterLink>
          <RouterLink class="btn btn--ghost" to="/exam">模拟考试</RouterLink>
        </div>
      </div>
      <ul class="hero__list">
        <li>仓库 <code>banks/</code> 构建收录 + 浏览器导入 / AI 辅助</li>
        <li>搜索 · 收藏 · 笔记 · 错题本 · 不限时模拟考试 · 公式 · PDF</li>
        <li>选项乱序 · 深色模式 · 移动端适配</li>
        <li>不做账号登录、考试计时、Docker</li>
      </ul>
    </div>
  </PageHeader>
</template>

<style scoped>
.hero {
  display: grid;
  gap: var(--space-5);
}

.hero__panel {
  padding: var(--space-8) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.hero__eyebrow {
  font-size: var(--font-size-xs);
  letter-spacing: 0.12em;
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}

.hero__lead {
  font-size: clamp(1.5rem, 4vw, 2rem);
  margin-bottom: var(--space-3);
}

.hero__text {
  color: var(--color-text-secondary);
  max-width: 36em;
  margin-bottom: var(--space-6);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.hero__list {
  margin: 0;
  padding: var(--space-5) var(--space-6);
  list-style: none;
  display: grid;
  gap: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.hero__list code {
  font-size: 0.92em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: background var(--duration) var(--ease-out), color var(--duration) var(--ease-out),
    border-color var(--duration) var(--ease-out);
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
}

.btn--primary:hover {
  background: var(--color-accent-hover);
}

.btn--ghost {
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-text);
}

.btn--ghost:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

@media (min-width: 800px) {
  .hero {
    grid-template-columns: 1.4fr 1fr;
    align-items: stretch;
  }
}
</style>

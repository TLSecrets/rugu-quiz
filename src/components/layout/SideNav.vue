<script setup lang="ts">
import { useRoute } from 'vue-router'
import { primaryNav } from '@/nav'

const route = useRoute()

function isActive(key: string) {
  return route.meta.nav === key
}
</script>

<template>
  <aside class="side">
    <div class="side__brand">
      <p class="side__name">如故题库</p>
      <p class="side__tag">专业刷题 · 本地可用</p>
    </div>
    <nav class="side__nav" aria-label="主导航">
      <RouterLink
        v-for="item in primaryNav"
        :key="item.key"
        :to="item.to"
        class="side__link"
        :class="{ 'side__link--active': isActive(item.key) }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
    <p class="side__foot">如故题库 · 可发布</p>
  </aside>
</template>

<style scoped>
.side {
  position: sticky;
  top: 0;
  height: 100dvh;
  flex-direction: column;
  padding: var(--space-6) var(--space-4);
  background: var(--color-nav-bg);
  color: var(--color-nav-text);
  border-right: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
}

.side__brand {
  padding: 0 var(--space-3) var(--space-8);
}

.side__name {
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-nav-active);
  letter-spacing: 0.04em;
}

.side__tag {
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  color: color-mix(in srgb, var(--color-nav-text) 80%, transparent);
}

.side__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.side__link {
  display: flex;
  align-items: center;
  min-height: var(--touch-min);
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: background var(--duration) var(--ease-out), color var(--duration) var(--ease-out);
}

.side__link:hover {
  color: var(--color-nav-active);
  background: rgb(255 255 255 / 0.06);
}

.side__link--active {
  color: var(--color-nav-active);
  background: var(--color-nav-active-bg);
}

.side__foot {
  margin-top: auto;
  padding: var(--space-4) var(--space-3) 0;
  font-size: var(--font-size-xs);
  color: color-mix(in srgb, var(--color-nav-text) 55%, transparent);
}
</style>

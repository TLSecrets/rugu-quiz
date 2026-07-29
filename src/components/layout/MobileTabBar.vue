<script setup lang="ts">
import { useRoute } from 'vue-router'
import { mobileTabNav } from '@/nav'

const route = useRoute()

function isActive(key: string) {
  return route.meta.nav === key
}
</script>

<template>
  <nav class="tabs" aria-label="底部导航">
    <RouterLink
      v-for="item in mobileTabNav"
      :key="item.key"
      :to="item.to"
      class="tabs__item"
      :class="{ 'tabs__item--active': isActive(item.key) }"
    >
      <span class="tabs__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabs {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(14px);
  border-top: 1px solid var(--color-border);
}

.tabs__item {
  display: grid;
  place-items: center;
  min-height: var(--tabbar-height);
  min-width: 0;
  padding: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition: color var(--duration) var(--ease-out);
}

.tabs__item--active {
  color: var(--color-accent);
}

.tabs__label {
  display: block;
  max-width: 100%;
  padding: 0;
  text-align: center;
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 22rem) {
  .tabs__item {
    font-weight: 400;
    padding: 0.15rem;
  }
}
</style>

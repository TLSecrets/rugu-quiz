<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

defineProps<{ title: string }>()

const settings = useSettingsStore()
</script>

<template>
  <header class="header">
    <div class="header__brand">
      <span class="header__mark" aria-hidden="true">如故</span>
      <div class="header__titles">
        <p class="header__product">如故题库</p>
        <h1 class="header__page">{{ title }}</h1>
      </div>
    </div>
    <div class="header__actions">
      <RouterLink class="header__link header__link--mobile" to="/notes">笔记</RouterLink>
      <RouterLink class="header__link header__link--mobile" to="/settings">设置</RouterLink>
      <button
        type="button"
        class="header__theme"
        :aria-label="`当前主题：${settings.themeLabel}，点击切换`"
        @click="settings.cycleTheme()"
      >
        {{ settings.themeLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: var(--header-height);
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--color-bg-elevated) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.header__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-nav-bg);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.header__titles {
  min-width: 0;
}

.header__product {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
  text-transform: none;
}

.header__page {
  font-size: var(--font-size-lg);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header__theme {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: border-color var(--duration) var(--ease-out), color var(--duration) var(--ease-out);
}

.header__theme:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.header__link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.header__link--mobile {
  display: inline-flex;
}

@media (min-width: 900px) {
  .header {
    padding-inline: var(--space-8);
  }

  .header__mark {
    display: none;
  }

  .header__link--mobile {
    display: none;
  }
}
</style>

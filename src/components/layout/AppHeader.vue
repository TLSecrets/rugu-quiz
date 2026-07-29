<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mobileMoreNav } from '@/nav'
import { useSettingsStore } from '@/stores/settings'

defineProps<{ title: string }>()

const settings = useSettingsStore()
const route = useRoute()
const moreOpen = ref(false)
const moreRoot = ref<HTMLElement | null>(null)

function isMoreActive(key: string) {
  return route.meta.nav === key
}

function toggleMore() {
  moreOpen.value = !moreOpen.value
}

function closeMore() {
  moreOpen.value = false
}

function onDocPointer(e: Event) {
  if (!moreOpen.value || !moreRoot.value) return
  if (e.target instanceof Node && moreRoot.value.contains(e.target)) return
  moreOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
})
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
      <div ref="moreRoot" class="more">
        <button
          type="button"
          class="header__more"
          :aria-expanded="moreOpen"
          aria-haspopup="menu"
          aria-controls="header-more-menu"
          @click="toggleMore"
        >
          更多
        </button>
        <div
          v-show="moreOpen"
          id="header-more-menu"
          class="more__panel"
          role="menu"
        >
          <RouterLink
            v-for="item in mobileMoreNav"
            :key="item.key"
            :to="item.to"
            class="more__link"
            role="menuitem"
            :class="{ 'more__link--active': isMoreActive(item.key) }"
            @click="closeMore"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </div>
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
  padding: calc(var(--space-3) + env(safe-area-inset-top)) var(--space-4) var(--space-3);
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
  width: 2.5rem;
  height: 2.5rem;
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

.header__theme,
.header__more {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: border-color var(--duration) var(--ease-out), color var(--duration) var(--ease-out);
}

.header__theme:hover,
.header__more:hover {
  border-color: var(--color-border-strong);
  color: var(--color-text);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.more {
  position: relative;
}

.more__panel {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-2));
  min-width: 10rem;
  max-height: min(70dvh, 24rem);
  overflow-y: auto;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  display: grid;
  gap: 2px;
  z-index: 30;
}

.more__link {
  min-height: var(--touch-min);
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.more__link:hover,
.more__link--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

/* --layout-tablet: 48rem — 侧栏已有全导航，收起「更多」与品牌角标 */
@media (min-width: 48rem) {
  .header {
    padding-inline: var(--space-5);
  }

  .header__mark {
    display: none;
  }

  .more {
    display: none;
  }
}

/* --layout-desktop: 56.25rem */
@media (min-width: 56.25rem) {
  .header {
    padding-inline: var(--space-8);
  }
}
</style>

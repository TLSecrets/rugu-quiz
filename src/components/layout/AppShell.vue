<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SideNav from './SideNav.vue'
import MobileTabBar from './MobileTabBar.vue'
import AppHeader from './AppHeader.vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { MQ_TABLET } from '@/lib/layoutBreakpoints'

const route = useRoute()
const pageTitle = computed(() => (route.meta.title as string) || '如故题库')
/** ≥48rem：侧栏；否则底栏。用 v-if 避免 scoped display 互相覆盖 */
const isTabletUp = useMediaQuery(MQ_TABLET)
</script>

<template>
  <div class="shell" :class="{ 'shell--tablet': isTabletUp }">
    <SideNav v-if="isTabletUp" class="shell__side" />
    <div class="shell__main">
      <AppHeader :title="pageTitle" />
      <main class="shell__content">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <MobileTabBar v-if="!isTabletUp" />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--color-bg);
  background-image: var(--shell-glow);
  background-attachment: scroll;
}

.shell__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100dvh;
}

.shell__content {
  flex: 1;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
  /* 手机：为固定底栏 + 安全区留空，避免最后操作被挡住 */
  padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-6));
}

.shell--tablet {
  grid-template-columns: var(--nav-width) 1fr;
}

.shell--tablet .shell__side {
  display: flex;
}

.shell--tablet .shell__content {
  padding: var(--space-6) var(--space-5);
  padding-bottom: var(--space-10);
}

/* --layout-desktop: 56.25rem — 宽屏更大留白 */
@media (min-width: 56.25rem) {
  .shell--tablet .shell__content {
    padding: var(--space-8) var(--space-8);
    padding-bottom: var(--space-12);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration) var(--ease-out), transform var(--duration) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }

  .fade-enter-from,
  .fade-leave-to {
    transform: none;
  }
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { bootstrapDatabase } from '@/db/bootstrap'
import { useBanksStore } from '@/stores/banks'
import { useFavoritesStore } from '@/stores/favorites'
import { useNotesStore } from '@/stores/notes'
import { useSettingsStore } from '@/stores/settings'
import { useWrongsStore } from '@/stores/wrongs'

const settings = useSettingsStore()
const banks = useBanksStore()
const favorites = useFavoritesStore()
const notes = useNotesStore()
const wrongs = useWrongsStore()

const booting = ref(true)
const bootError = ref<string | null>(null)

async function boot() {
  booting.value = true
  bootError.value = null
  try {
    await bootstrapDatabase()
    await Promise.all([
      settings.init(),
      banks.refresh(),
      favorites.refresh(),
      notes.refresh(),
      wrongs.refresh(),
    ])
  } catch (e) {
    bootError.value = e instanceof Error ? e.message : '初始化失败'
  } finally {
    booting.value = false
  }
}

onMounted(() => {
  void boot()
})
</script>

<template>
  <div v-if="booting" class="boot">
    <LoadingState label="正在准备本地题库…" />
  </div>
  <div v-else-if="bootError" class="boot">
    <ErrorState title="初始化失败" :message="bootError" retryable @retry="boot" />
  </div>
  <AppShell v-else />
</template>

<style scoped>
.boot {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--space-6);
  background: var(--color-bg);
  background-image: var(--shell-glow);
}
</style>

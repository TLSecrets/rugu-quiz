<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty">
    <h2 class="empty__title">{{ title }}</h2>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <div v-if="$slots.default" class="empty__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-5);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
}

.empty__title {
  font-size: var(--font-size-lg);
  color: var(--color-text);
}

.empty__desc {
  max-width: 36em;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.empty__actions {
  margin-top: var(--space-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>

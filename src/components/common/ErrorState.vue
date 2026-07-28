<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    message: string
    retryable?: boolean
  }>(),
  {
    title: '出错了',
    retryable: false,
  },
)

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="error" role="alert">
    <h2 class="error__title">{{ title }}</h2>
    <p class="error__msg">{{ message }}</p>
    <div v-if="retryable || $slots.default" class="error__actions">
      <button v-if="retryable" type="button" class="btn" @click="$emit('retry')">重试</button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
}

.error__title {
  font-size: var(--font-size-lg);
  color: var(--color-danger);
}

.error__msg {
  max-width: 40em;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.error__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.btn {
  min-height: var(--touch-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 600;
}
</style>

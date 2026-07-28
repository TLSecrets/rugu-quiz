<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  {
    label: '加载中…',
  },
)
</script>

<template>
  <div class="loading" role="status" aria-live="polite">
    <span class="loading__dot" aria-hidden="true" />
    <p class="loading__label">{{ label }}</p>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
}

.loading__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: pulse 1s var(--ease-out) infinite;
}

.loading__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading__dot {
    animation: none;
    opacity: 1;
  }
}
</style>

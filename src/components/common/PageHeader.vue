<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="page">
    <header class="page__head">
      <h2 class="page__title">{{ title }}</h2>
      <p v-if="subtitle" class="page__subtitle">{{ subtitle }}</p>
    </header>
    <div class="page__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  animation: rise 280ms var(--ease-out);
}

.page__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page__title {
  font-size: var(--font-size-2xl);
}

.page__subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  max-width: 40em;
}

.page__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

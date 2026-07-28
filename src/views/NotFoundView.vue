<script setup lang="ts">
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <PageHeader title="页面不存在">
    <EmptyState title="找不到该页面" description="链接可能已失效，或功能尚未开放。">
      <RouterLink class="link" to="/">返回首页</RouterLink>
    </EmptyState>
  </PageHeader>
</template>

<style scoped>
.link {
  min-height: var(--touch-min);
  display: inline-flex;
  align-items: center;
  color: var(--color-accent);
  font-weight: 600;
  font-size: var(--font-size-sm);
}
</style>

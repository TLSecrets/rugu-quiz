<script setup lang="ts">
import { computed } from 'vue'
import { renderRichText } from '@/lib/richtext'

const props = withDefaults(
  defineProps<{
    source?: string
    /** 行内紧凑（选项等） */
    inline?: boolean
    tag?: string
  }>(),
  {
    source: '',
    inline: false,
    tag: 'div',
  },
)

const html = computed(() => renderRichText(props.source || ''))
</script>

<template>
  <component
    :is="tag"
    class="rich"
    :class="{ 'rich--inline': inline }"
    v-html="html"
  />
</template>

<style scoped>
.rich {
  line-height: 1.65;
  overflow-wrap: anywhere;
  color: inherit;
}

.rich--inline {
  display: inline;
  line-height: inherit;
}

.rich :deep(p) {
  margin: 0 0 0.65em;
}

.rich :deep(p:last-child) {
  margin-bottom: 0;
}

.rich :deep(ul),
.rich :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.35em;
}

.rich :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6em 0;
  font-size: 0.92em;
}

.rich :deep(th),
.rich :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.4em 0.55em;
  text-align: left;
  vertical-align: top;
}

.rich :deep(th) {
  background: var(--color-surface-muted);
  font-weight: 600;
}

.rich :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.rich :deep(pre) {
  margin: 0.6em 0;
  padding: 0.75em 1em;
  overflow: auto;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.rich :deep(pre code) {
  padding: 0;
  border: none;
  background: transparent;
}

.rich :deep(a) {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rich :deep(.katex-display) {
  margin: 0.75em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.rich :deep(.katex) {
  font-size: 1.05em;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { MediaPlacement, QuestionMedia } from '@/types/question'

const props = withDefaults(
  defineProps<{
    items: QuestionMedia[]
    /** 若指定，只渲染该 placement；不传则渲染全部 */
    placement?: MediaPlacement | MediaPlacement[]
    caption?: string
  }>(),
  {
    items: () => [],
  },
)

const placementLabel: Record<MediaPlacement, string> = {
  inline: '题内',
  'after-stem': '题干后',
  'after-options': '选项后',
  'in-answer': '答案区',
  unknown: '位置未识别',
}

const filtered = computed(() => {
  if (!props.placement) return props.items
  const set = new Set(Array.isArray(props.placement) ? props.placement : [props.placement])
  return props.items.filter((m) => set.has(m.placement))
})
</script>

<template>
  <div v-if="filtered.length" class="media" :data-placement="Array.isArray(placement) ? placement.join(',') : placement">
    <p v-if="caption" class="media__caption">{{ caption }}</p>
    <figure v-for="item in filtered" :key="item.id" class="media__figure">
      <img class="media__img" :src="item.src" :alt="item.alt || '题目配图'" loading="lazy" />
      <figcaption class="media__meta">
        <span>{{ placementLabel[item.placement] }}</span>
        <span v-if="item.alt"> · {{ item.alt }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.media {
  display: grid;
  gap: var(--space-3);
}

.media__caption {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}

.media__figure {
  margin: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.media__img {
  width: 100%;
  height: auto;
  max-height: 280px;
  object-fit: contain;
  background: color-mix(in srgb, var(--color-bg) 60%, transparent);
}

.media__meta {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
}
</style>

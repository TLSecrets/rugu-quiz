<script setup lang="ts">
import { ref } from 'vue'
import { normalizeBankTags, parseBankTagsInput } from '@/lib/bankTags'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
  }>(),
  {
    placeholder: '输入标签后回车，如 2025-2026',
  },
)

const emit = defineEmits<{
  'update:modelValue': [tags: string[]]
}>()

const draft = ref('')

function commitDraft() {
  const added = parseBankTagsInput(draft.value)
  if (!added.length) {
    draft.value = ''
    return
  }
  emit('update:modelValue', normalizeBankTags([...props.modelValue, ...added]))
  draft.value = ''
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter' || ev.key === ',') {
    ev.preventDefault()
    commitDraft()
  } else if (ev.key === 'Backspace' && !draft.value && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function removeTag(tag: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag),
  )
}
</script>

<template>
  <div class="tags-field">
    <div class="chips">
      <button
        v-for="tag in modelValue"
        :key="tag"
        type="button"
        class="chip"
        :title="`移除 ${tag}`"
        @click="removeTag(tag)"
      >
        {{ tag }} ×
      </button>
    </div>
    <input
      v-model="draft"
      class="input"
      type="text"
      :placeholder="placeholder"
      @keydown="onKeydown"
      @blur="commitDraft"
    />
  </div>
</template>

<style scoped>
.tags-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.input {
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}
</style>

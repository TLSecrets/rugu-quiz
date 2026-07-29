<script setup lang="ts">
import { computed, ref } from 'vue'
import { normalizeBankTags, parseBankTagsInput } from '@/lib/bankTags'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    /** 可选：从目录挑选已有标签 */
    suggestions?: string[]
    placeholder?: string
  }>(),
  {
    suggestions: () => [],
    placeholder: '输入新标签后回车，如 2025-2026',
  },
)

const emit = defineEmits<{
  'update:modelValue': [tags: string[]]
}>()

const draft = ref('')

const unusedSuggestions = computed(() =>
  props.suggestions.filter((t) => !props.modelValue.includes(t)),
)

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

function addSuggestion(tag: string) {
  emit('update:modelValue', normalizeBankTags([...props.modelValue, tag]))
}
</script>

<template>
  <div class="tags-field">
    <div class="chips">
      <span v-for="tag in modelValue" :key="tag" class="chip">
        <span class="chip__text">{{ tag }}</span>
        <button type="button" class="chip__x" :title="`从本题库移除 ${tag}`" @click="removeTag(tag)">
          ×
        </button>
      </span>
    </div>
    <input
      v-model="draft"
      class="input"
      type="text"
      :placeholder="placeholder"
      @keydown="onKeydown"
      @blur="commitDraft"
    />
    <div v-if="unusedSuggestions.length" class="suggest">
      <span class="suggest__label">选用已有</span>
      <button
        v-for="tag in unusedSuggestions"
        :key="tag"
        type="button"
        class="suggest__btn"
        @click="addSuggestion(tag)"
      >
        + {{ tag }}
      </button>
    </div>
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
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 32px;
  padding: 0 0.35rem 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.chip__x {
  min-width: 28px;
  min-height: 28px;
  border-radius: var(--radius-sm);
  color: inherit;
  font-size: 1rem;
  line-height: 1;
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

.suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.suggest__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.suggest__btn {
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border-strong);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
</style>

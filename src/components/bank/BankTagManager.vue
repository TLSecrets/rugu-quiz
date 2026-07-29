<script setup lang="ts">
import { ref } from 'vue'
import { useBanksStore } from '@/stores/banks'

const banks = useBanksStore()

const newTag = ref('')
const renaming = ref<string | null>(null)
const renameDraft = ref('')
const busy = ref(false)
const msg = ref<string | null>(null)
const err = ref<string | null>(null)

async function onAdd() {
  msg.value = null
  err.value = null
  busy.value = true
  try {
    const name = await banks.addTag(newTag.value)
    newTag.value = ''
    msg.value = `已添加标签「${name}」`
  } catch (e) {
    err.value = e instanceof Error ? e.message : '添加失败'
  } finally {
    busy.value = false
  }
}

function beginRename(tag: string) {
  renaming.value = tag
  renameDraft.value = tag
  msg.value = null
  err.value = null
}

function cancelRename() {
  renaming.value = null
  renameDraft.value = ''
}

async function confirmRename() {
  if (!renaming.value) return
  msg.value = null
  err.value = null
  busy.value = true
  try {
    await banks.renameTag(renaming.value, renameDraft.value)
    msg.value = `已将「${renaming.value}」改为「${renameDraft.value.trim()}」`
    renaming.value = null
    renameDraft.value = ''
  } catch (e) {
    err.value = e instanceof Error ? e.message : '修改失败'
  } finally {
    busy.value = false
  }
}

async function onDelete(tag: string) {
  if (!confirm(`删除标签「${tag}」？将从所有题库上移除该标签。`)) return
  msg.value = null
  err.value = null
  busy.value = true
  try {
    await banks.deleteTag(tag)
    if (renaming.value === tag) cancelRename()
    msg.value = `已删除标签「${tag}」`
  } catch (e) {
    err.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mgr">
    <div class="mgr__head">
      <h3 class="mgr__title">标签管理</h3>
      <p class="mgr__desc">在此添加、修改标签名称；修改后会同步到所有使用该标签的题库。</p>
    </div>

    <div class="mgr__add">
      <input
        v-model="newTag"
        type="text"
        class="input"
        placeholder="新标签，如 2026-2027"
        maxlength="40"
        :disabled="busy"
        @keydown.enter.prevent="onAdd"
      />
      <button type="button" class="btn btn--primary" :disabled="busy || !newTag.trim()" @click="onAdd">
        添加标签
      </button>
    </div>

    <ul v-if="banks.allBankTags.length" class="list">
      <li v-for="tag in banks.allBankTags" :key="tag" class="row">
        <template v-if="renaming === tag">
          <input
            v-model="renameDraft"
            class="input"
            type="text"
            maxlength="40"
            :disabled="busy"
            @keydown.enter.prevent="confirmRename"
            @keydown.escape.prevent="cancelRename"
          />
          <button type="button" class="btn btn--primary" :disabled="busy" @click="confirmRename">
            保存
          </button>
          <button type="button" class="btn" :disabled="busy" @click="cancelRename">取消</button>
        </template>
        <template v-else>
          <span class="row__name">{{ tag }}</span>
          <button type="button" class="btn" :disabled="busy" @click="beginRename(tag)">修改</button>
          <button type="button" class="btn btn--danger" :disabled="busy" @click="onDelete(tag)">
            删除
          </button>
        </template>
      </li>
    </ul>
    <p v-else class="empty">还没有标签，先添加一个学年或分类吧。</p>

    <p v-if="msg" class="flash flash--ok">{{ msg }}</p>
    <p v-if="err" class="flash flash--err">{{ err }}</p>
  </section>
</template>

<style scoped>
.mgr {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  margin-bottom: var(--space-5);
}

.mgr__title {
  font-size: var(--font-size-md);
}

.mgr__desc {
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.mgr__add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.input {
  flex: 1;
  min-width: 10rem;
  min-height: var(--touch-min);
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-2);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: none;
}

.row__name {
  flex: 1;
  min-width: 6rem;
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.btn {
  min-height: 36px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-text);
  border-color: transparent;
  font-weight: 600;
}

.btn--danger {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
}

.empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.flash {
  font-size: var(--font-size-sm);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.flash--ok {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.flash--err {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** 监听 matchMedia，跨断点时更新；避免用 CSS display 与 scoped 子组件打架 */
export function useMediaQuery(query: string): Ref<boolean> {
  const mq = typeof window !== 'undefined' ? window.matchMedia(query) : null
  const matches = ref(mq?.matches ?? false)

  function sync(e?: MediaQueryListEvent) {
    matches.value = e ? e.matches : (mq?.matches ?? false)
  }

  onMounted(() => {
    mq?.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    mq?.removeEventListener('change', sync)
  })

  return matches
}

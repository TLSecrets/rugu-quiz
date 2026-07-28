import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * GitHub Pages 部署说明：
 * - 默认 `base: './'` + Hash 路由，一般可直接用于
 *   `https://<user>.github.io/<repo>/` 或自定义域名。
 * - 若资源路径异常，可设环境变量：
 *   VITE_BASE=/<repo>/
 *   例如仓库名为 rugu-quiz 时：VITE_BASE=/rugu-quiz/
 * - 用户站 `https://<user>.github.io/` 使用 VITE_BASE=/
 */
const base = process.env.VITE_BASE || './'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})

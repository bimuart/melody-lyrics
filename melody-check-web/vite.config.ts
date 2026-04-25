import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 项目页使用仓库名子路径；本地与 Cloudflare 保持根路径。
  base: process.env.VITE_PUBLIC_BASE || "/",
})

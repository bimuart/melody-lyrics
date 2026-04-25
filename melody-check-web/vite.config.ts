import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 项目页需要仓库名子路径；本地与其他部署保持根路径。
  base: process.env.GITHUB_ACTIONS ? "/melody-lyrics-check/" : "/",
})

# 歌词字音 & 旋律校对（Vue 上线版）

独立 Vue 3 + Vite 前端，与仓库根目录 [`core-js`](../core-js/) 逻辑一致，**不修改**原有 `test-pages/production-demo.html`。

## 准备

```bash
cd melody-check-web
npm install
npm run sync:assets
```

`sync:assets` 会将上级目录的 `core-js/` 与 `demo-cases/` 复制到 `public/`（`public/core-js`、`public/demo-cases` 已加入 `.gitignore`）。`predev` / `prebuild` 会自动执行同步。

## 开发

```bash
npm run dev
```

浏览器打开终端提示的本地地址。需能加载 CDN：`@tonejs/midi`、`pinyin-pro`。

## 构建与部署

```bash
npm run build
```

产物在 `dist/`，可部署到任意静态服务器。若部署在子路径，在 `vite.config.ts` 中设置 `base`（例如 `base: '/melody-check/'`）。

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

| 变量 | 说明 |
|------|------|
| `VITE_LYRICS_ANNOTATE_URL` | AI 分词接口地址，默认 `http://127.0.0.1:8000/api/lyrics/annotate` |

跨域请求需后端配置 CORS。

## 功能验收（与旧版 HTML 对齐）

- 歌词 / 旋律输入、防抖计算、渲染区回写
- MIDI 上传、按「每句小节数」重新分句
- 示例轮换（优先 `fetch` `/demo-cases/*.md`，失败用内置 fallback）
- 结果区悬停 / 点击固定校验提示；歌词区非法改字回退
- AI 分词按钮
- 顶栏主题：浅色 / 深色 / 跟随系统（`localStorage`：`melody-check-theme`）

## 技术说明

- 核心库仍以 **全局 script** 形式注入（见 `index.html`），与 `window.Compute`、`window.MidiParser` 等对接。
- UI 使用 CSS 变量（`src/assets/tokens.css`）与 `data-theme` 切换日夜间样式。

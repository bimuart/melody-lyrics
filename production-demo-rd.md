# Melody-Lyrics 生产版研发文档（HTML/JS 第一阶段）

## 1. 目标

在不影响现有 `test-pages/demo-js.html`、`test-pages/melody.html` 和 `core-js/*.js` 的前提下，新增一个生产版原型页面（纯 HTML/JS），实现以下能力：

- 支持歌词与旋律原始输入计算。
- 支持上传 MIDI 并转换为旋律原始输入文本（按拍分句）。
- 保留可编辑的“计算渲染”窗口，并支持从渲染窗口回算。
- 在渲染区提供单字级联动高亮、单字校验下划线、左右偏差半边背景。
- 提供“撤销”能力，记录歌词/旋律输入版本历史。

## 2. 已冻结需求（本轮）

1. **MIDI 分句规则**：仍按拍分句，提供“小节数”下拉，参考 `test-pages/melody.html`。  
2. **旋律输入框内容**：MIDI 上传后，显示 `MelodyParser.notesToSentenceText` 产物。  
3. **撤销语义**：不再使用“重置基准”；改为“撤销”，记录每个版本的输入框状态（仅歌词输入、旋律输入）。  
4. **按钮语义**：
   - `计算`：从原始输入（歌词/旋律）计算，调用 `Compute.buildSingleCharIntervalArrayFromText`。
   - `应用渲染`：从渲染窗口回算，调用 `Compute.buildSingleCharIntervalArrayFromRenderText`。
5. **高亮粒度**：仅高亮当前 item；多音一个字按整字高亮。  
6. **样式叠加规则**：
   - 单字校验不通过：橙色下划线（始终保留）。
   - 左/右偏差非 0：左右半边背景色透明叠加（沿用 `DEVIATION_HIGHLIGHT` 的 low/high 分级，左右同色体系）。

## 3. 页面信息架构

### 3.1 输入区

- 歌词输入（原始输入格式）。
- 旋律输入（原始输入格式，支持手输及 MIDI 导入后回填）。
- MIDI 操作区：
  - 文件选择。
  - 每句小节数（`barsPerSentence`）。
  - 分句偏移（`offsetFraction`）。
  - 解析 MIDI 按钮。
  - 重新分句按钮。

### 3.2 计算与编辑区

- 计算渲染：歌词（可编辑）与歌词可视化合并为同一窗口（上编辑、下可视化）。
- 计算渲染：旋律（可编辑）。
- `计算`、`应用渲染`、`撤销` 按钮。
- 状态栏（成功/错误）。

### 3.3 结果区

- 单字音程数组 JSON（可查看/复制）。
- 歌词渲染可视化面板（token 级样式）。
- 旋律渲染可视化面板（token 级样式）。

## 4. 状态模型

## 4.1 关键状态

- `originalLyricsText`: 当前歌词输入框文本。
- `originalMelodyText`: 当前旋律输入框文本。
- `renderLyricsText`: 计算渲染歌词文本。
- `renderMelodyText`: 计算渲染旋律文本。
- `singleCharArray`: 计算得到的单字音程数组。
- `undoStack`: 输入版本栈（元素结构：`{ lyricsText, melodyText, source, at }`）。
- `hoverKey`: 当前悬停项（格式：`line-seg-item`）。
- MIDI 相关：
  - `parsedMidi`
  - `templateNotes`
  - `timingInfo`

### 4.2 版本记录策略

- 记录对象：仅歌词输入与旋律输入。
- 入栈时机（建议）：
  - 初始示例加载完成后。
  - MIDI 成功解析并回填旋律后。
  - 用户触发 `计算` 前若输入有变化。
  - 用户手动触发“保存快照”类动作（如后续新增）。
- 撤销规则：
  - 至少保留 1 个版本。
  - 点击撤销回到上一个版本，并刷新输入框显示。
  - 撤销本身不自动触发计算，由用户显式点击 `计算`。

## 5. 渲染规则（重点）

## 5.1 Token 建模

从 `singleCharArray` 遍历得到单字 token：

- 基础字段：`char`、`py`、`tone`、`notes[]`
- 校验字段：`singleValid`（`item[4]`）
- 偏差字段：
  - `leftDeviations`（`item[5][1]`）
  - `rightDeviations`（`item[6][1]`）
- 唯一键：`line-seg-item`

### 5.2 样式映射

- **下划线**：`singleValid !== 1` -> `border-bottom: 2px solid orange`
- **左半边背景**：`leftDeviations` 有非 0 值 -> `linear-gradient` 左半区着色
- **右半边背景**：`rightDeviations` 有非 0 值 -> `linear-gradient` 右半区着色
- **分级**：
  - `absDeviation <= lowMax` -> `colors.low`
  - `absDeviation > lowMax` -> `colors.high`
- **hover 联动**：
  - 鼠标悬停歌词 token 时，同 key 的旋律 token 高亮。
  - 鼠标悬停旋律 token 时，同 key 的歌词 token 高亮。

### 5.3 歌词合并窗口编辑约束（第一阶段实现）

- 歌词渲染合并窗口采用 `contenteditable` 编辑器承载“计算渲染歌词文本”。
- 用户允许修改：拼音内容、分词斜线、换行。
- 用户禁止修改：汉字字符序列（增字、删字、替字、换序）。
- 约束方式：编辑后比对“汉字序列”与当前 `singleCharArray` 期望序列，不一致则自动回退到上次合法内容并提示错误。

## 6. 技术依赖（第一阶段）

- 页面：原生 HTML + 原生 JS + CSS。
- 解析核心：`core-js` 现有模块（`LyricsParser`、`MelodyParser`、`Integrator`、`Compute`、`Json2Window`、`IntervalConfig`）。
- 外部库（暂沿用 CDN，第二阶段本地化）：
  - `pinyin-pro`
  - `@tonejs/midi`

## 7. 兼容与风险

- `textarea` 无法直接做 token 级 hover 样式；需要新增“可视化渲染层”（`div + span`）实现高亮和半边背景。
- MIDI 解析依赖浏览器文件 API 与 `@tonejs/midi`，需在现代浏览器运行。
- 句数不一致仍按 `Integrator` 规则报错，状态栏需给出明确提示。
- 若输入格式非法，`计算`/`应用渲染` 必须可恢复并可继续编辑。

## 8. 验收标准（第一阶段）

- 新页面文件可独立打开运行，且不改动旧页面行为。
- MIDI 上传后可回填旋律输入文本，并参与 `计算`。
- `计算` 与 `应用渲染` 两条链路均可闭环。
- 撤销可在多个输入版本间回退。
- 渲染区满足：
  - 同 key 跨面板 hover 联动；
  - 单字校验失败下划线；
  - 左/右偏差半边背景（low/high 分级）。
- JSON 区能正确展示最新单字音程数组。

## 9. 第二阶段建议（非本次实现）

- 迁移到 `Vite + TypeScript + 模块化`，去除全局 `window.*` 依赖。
- `pinyin-pro` 与 `@tonejs/midi` 改为 npm 本地依赖，锁定版本。
- 增加可视化错误定位（定位到句/词/字）。
- 增加导出导入与持久化（本地草稿）。

import { onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import { DEMO_CASE_FILES, DEMO_CASE_FALLBACK } from "../constants/demoCases";
import {
  buildPreviewHtml,
  extractAnnotateResult,
  normalizeEditorText,
  parseDemoCaseMarkdown,
  renderHoverValidationLines,
  toAnnotatePlainLyricsText,
  toComputeLyricsFormat,
  type HoverInfo,
  type ValidationLine,
} from "../lib/checkHelpers";

const ANNOTATE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_LYRICS_ANNOTATE_URL) ||
  "http://127.0.0.1:8000/api/lyrics/annotate";
const ANNOTATE_STREAM_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_LYRICS_ANNOTATE_STREAM_URL) ||
  "http://127.0.0.1:8000/api/lyrics/annotate/stream";

function assertCoreReady(): void {
  if (!window.Compute?.buildSingleCharIntervalArrayFromText) {
    throw new Error("核心脚本未加载：请确认已执行 npm run sync:assets 并刷新页面。");
  }
}

export function useLyricsMelodyCheck() {
  const leftColumnFr = ref(42);
  const inputAreaH = ref(180);
  const previewResultH = ref(350);
  const layoutNarrow = ref(
    typeof globalThis !== "undefined" && typeof globalThis.matchMedia === "function"
      ? globalThis.matchMedia("(max-width: 900px)").matches
      : false
  );

  const lyricsInput = ref("");
  const melodyInput = ref("");
  const statusMessage = ref("");
  const statusIsError = ref(false);
  const barsPerSentence = ref("2");

  const melodyInnerHtml = ref("");
  const lyricsHtml = ref("");
  const hoverInfoMap = shallowRef<Record<string, HoverInfo>>({});
  const tooltip = reactive({
    visible: false,
    x: 0,
    y: 0,
    lines: [] as ValidationLine[],
  });

  const currentSingleCharArray = shallowRef<unknown[][]>([]);
  const lastValidLyricsRenderText = ref("");
  const lastValidMelodyRenderText = ref("");

  let autoCalcTimer: ReturnType<typeof setTimeout> | null = null;
  let autoApplyTimer: ReturnType<typeof setTimeout> | null = null;

  const currentParsedMidi = shallowRef<unknown>(null);
  const currentTemplateNotes = shallowRef<unknown[]>([]);
  const currentTimingInfo = ref({
    bpm: 120,
    beatsPerBar: 4,
    numerator: 4,
    denominator: 4,
  });

  const demoCaseIndex = ref(-1);
  const aiAnnotateLoading = ref(false);
  let aiAnnotateController: AbortController | null = null;
  /** Lyrics result contenteditable root (for applyFromRenderPanels / scheduleAutoApply). */
  const lyricsEditorElement = shallowRef<HTMLElement | null>(null);

  function setStatus(text: string, isError: boolean) {
    statusMessage.value = text;
    statusIsError.value = isError;
  }

  function renderPreview() {
    const lines = Array.isArray(currentSingleCharArray.value) ? currentSingleCharArray.value : [];
    const { melodyInnerHtml: m, lyricsHtml: l, hoverInfoMap: map } = buildPreviewHtml(lines as unknown[][]);
    melodyInnerHtml.value = m;
    lyricsHtml.value = l;
    hoverInfoMap.value = map;
  }

  function renderBySingleCharArray(arr: unknown[][]) {
    currentSingleCharArray.value = Array.isArray(arr) ? arr : [];
    tooltip.visible = false;
    tooltip.lines = [];
    assertCoreReady();
    lastValidLyricsRenderText.value = window.Json2Window!.singleCharToRenderLyrics(currentSingleCharArray.value);
    lastValidMelodyRenderText.value = window.Json2Window!.singleCharToRenderMelody(currentSingleCharArray.value);
    renderPreview();
  }

  function calcFromRawInputs() {
    try {
      assertCoreReady();
      const lyricsText = toComputeLyricsFormat(lyricsInput.value);
      const arr = window.Compute!.buildSingleCharIntervalArrayFromText(lyricsText, melodyInput.value);
      renderBySingleCharArray(arr as unknown[][]);
      setStatus("计算成功（原始输入链路）。", false);
    } catch (err) {
      setStatus("计算失败：" + (err instanceof Error ? err.message : String(err)), true);
    }
  }

  function getFallbackPyByIndex(i: number): string {
    const arr = Array.isArray(currentSingleCharArray.value) ? currentSingleCharArray.value : [];
    let idx = 0;
    for (const line of arr) {
      for (const seg of Array.isArray(line) ? line : []) {
        for (const item of Array.isArray(seg) ? seg : []) {
          const it = item as unknown[];
          if (idx === i) {
            const py = String(it?.[1] || "");
            const tone = Number(it?.[2]) || 0;
            return py + String(tone);
          }
          idx += 1;
        }
      }
    }
    return "";
  }

  function fillMissingPinyinInRenderText(renderText: string): string {
    const src = String(renderText || "");
    let out = "";
    let i = 0;
    let hanIdx = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/[\u4e00-\u9fa5]/.test(ch)) {
        let next = i + 1;
        let py = "";
        if (src[next] === "(") {
          const end = src.indexOf(")", next + 1);
          if (end >= 0) {
            py = src.slice(next + 1, end).trim();
            next = end + 1;
          }
        }
        const fallbackPy = getFallbackPyByIndex(hanIdx);
        if (!py) {
          py = fallbackPy;
        } else if (!/[0-4]$/.test(py) && fallbackPy) {
          // 只删了声调数字时，保留当前拼音字母并补回历史声调位
          const fbTone = fallbackPy.match(/[0-4]$/)?.[0] || "";
          if (fbTone) py += fbTone;
        }
        out += ch + (py ? "(" + py + ")" : "");
        hanIdx += 1;
        i = next;
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }

  function getLyricsEditorTextFromDom(el: HTMLElement): string {
    const raw = normalizeEditorText(el.innerText || el.textContent || "");
    const renderText = toComputeLyricsFormat(raw);
    return fillMissingPinyinInRenderText(renderText);
  }

  function applyFromRenderPanels() {
    const lyricsEditorEl = lyricsEditorElement.value;
    try {
      assertCoreReady();
      if (!lyricsEditorEl) return;
      const lyricsRenderText = getLyricsEditorTextFromDom(lyricsEditorEl);
      const melodyRenderText = normalizeEditorText(melodyInput.value || "");
      const arr = window.Compute!.buildSingleCharIntervalArrayFromRenderText(lyricsRenderText, melodyRenderText);
      currentSingleCharArray.value = arr as unknown[][];
      lastValidLyricsRenderText.value = lyricsRenderText;
      lastValidMelodyRenderText.value = melodyRenderText;
      lyricsInput.value = window.Json2Window!.singleCharToParsedLyrics(arr);
      melodyInput.value = toMelodyInputWithoutSlash(window.Json2Window!.singleCharToParsedMelody(arr));
      renderPreview();
      setStatus("应用渲染成功（渲染链路回算）。", false);
    } catch (err) {
      setStatus("应用渲染失败：" + (err instanceof Error ? err.message : String(err)), true);
    }
  }

  function toMelodyInputWithoutSlash(text: string): string {
    return String(text || "")
      .split("\n")
      .map((line) =>
        line
          .replace(/\s*\/\s*/g, " ")
          .replace(/[ \t]+/g, " ")
          .trim()
      )
      .join("\n");
  }

  function scheduleAutoCalc() {
    if (autoCalcTimer) clearTimeout(autoCalcTimer);
    autoCalcTimer = setTimeout(() => calcFromRawInputs(), 180);
  }

  function scheduleAutoApply() {
    if (autoApplyTimer) clearTimeout(autoApplyTimer);
    autoApplyTimer = setTimeout(() => applyFromRenderPanels(), 180);
  }

  function getExpectedHanSequence(): string {
    const arr = Array.isArray(currentSingleCharArray.value) ? currentSingleCharArray.value : [];
    let chars = "";
    arr.forEach((line) => {
      (Array.isArray(line) ? line : []).forEach((segment) => {
        (Array.isArray(segment) ? segment : []).forEach((item) => {
          chars += String((item as unknown[] && (item as unknown[])[0]) || "");
        });
      });
    });
    return chars;
  }

  function getHanSequenceFromRenderText(text: string): string {
    const matched = String(text || "").match(/[\u4e00-\u9fa5]/g);
    return matched ? matched.join("") : "";
  }

  function onLyricsEditorInput(ev: Event) {
    const lyricsEditorEl = (ev.currentTarget as HTMLElement) || lyricsEditorElement.value;
    if (!lyricsEditorEl) return;
    const candidate = getLyricsEditorTextFromDom(lyricsEditorEl);
    const expected = getExpectedHanSequence();
    const got = getHanSequenceFromRenderText(candidate);
    if (expected !== got) {
      assertCoreReady();
      lastValidLyricsRenderText.value = window.Json2Window!.singleCharToRenderLyrics(currentSingleCharArray.value);
      renderPreview();
      setStatus("仅可编辑拼音、斜线和换行；不允许增删或改动汉字。", true);
      return;
    }
    lastValidLyricsRenderText.value = candidate;
    scheduleAutoApply();
  }

  function onLyricsEditorKeydown(ev: KeyboardEvent) {
    if (ev.key === "Enter") {
      ev.preventDefault();
    }
  }

  function clearTokenHover(root: HTMLElement) {
    root.querySelectorAll(".token.hover").forEach((n) => n.classList.remove("hover"));
  }

  function highlightToken(root: HTMLElement, key: string) {
    root.querySelectorAll(".token[data-key]").forEach((n) => {
      if ((n as HTMLElement).dataset.key === key) n.classList.add("hover");
    });
  }

  const TOOLTIP_W = 240;

  function clampTooltipPos(x: number, y: number): { x: number; y: number } {
    const h = 300;
    const w = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(8, Math.min(x, w - TOOLTIP_W - 8)),
      y: Math.max(8, Math.min(y, vh - h - 8)),
    };
  }

  function tooltipPosForEvent(ev: MouseEvent): { x: number; y: number } {
    const w = window.innerWidth;
    const rawX = ev.clientX > w * 0.6 ? ev.clientX - TOOLTIP_W - 14 : ev.clientX + 14;
    const rawY = ev.clientY - 10;
    return clampTooltipPos(rawX, rawY);
  }

  function onPreviewPointerMove(ev: MouseEvent, root: HTMLElement) {
    const target = (ev.target as HTMLElement)?.closest?.(".token") as HTMLElement | null;
    if (!target) {
      clearTokenHover(root);
      tooltip.visible = false;
      tooltip.lines = [];
      return;
    }
    const key = target.dataset.key;
    if (!key) {
      clearTokenHover(root);
      tooltip.visible = false;
      tooltip.lines = [];
      return;
    }
    clearTokenHover(root);
    highlightToken(root, key);
    const lines = renderHoverValidationLines(key, hoverInfoMap.value);
    const p = tooltipPosForEvent(ev);
    tooltip.visible = true;
    tooltip.x = p.x;
    tooltip.y = p.y;
    tooltip.lines = lines;
  }

  function onPreviewMouseLeave(root: HTMLElement) {
    clearTokenHover(root);
    tooltip.visible = false;
    tooltip.lines = [];
  }

  async function loadDemoCase(casePath: string, fallbackCase: (typeof DEMO_CASE_FALLBACK)[number] | undefined) {
    let parsed: { title: string; lyrics: string; melody: string } | null = null;
    let usedFallback = false;
    try {
      const resp = await fetch(casePath);
      if (!resp.ok) throw new Error("读取示例失败：" + casePath);
      const md = await resp.text();
      parsed = parseDemoCaseMarkdown(md);
      if (!parsed.lyrics || !parsed.melody) {
        throw new Error("示例格式错误，需包含“歌词/旋律”代码块。");
      }
    } catch {
      parsed = fallbackCase
        ? { title: fallbackCase.title, lyrics: fallbackCase.lyrics, melody: fallbackCase.melody }
        : null;
      usedFallback = true;
    }

    if (!parsed || !parsed.lyrics || !parsed.melody) {
      throw new Error("加载示例失败：无可用示例数据。");
    }

    lyricsInput.value = parsed.lyrics;
    melodyInput.value = parsed.melody;
    calcFromRawInputs();
    setStatus((usedFallback ? "已加载内置示例：" : "已加载示例：") + parsed.title, false);
  }

  function nextDemoCase() {
    demoCaseIndex.value = (demoCaseIndex.value + 1) % DEMO_CASE_FILES.length;
    const idx = demoCaseIndex.value;
    loadDemoCase(DEMO_CASE_FILES[idx], DEMO_CASE_FALLBACK[idx]).catch((err) => {
      setStatus("加载示例失败：" + (err instanceof Error ? err.message : String(err)), true);
    });
  }

  async function parseMidiToMelodyInput(file: File) {
    try {
      assertCoreReady();
      type MP = NonNullable<Window["MidiParser"]>;
      const mp = window.MidiParser as MP;
      const buf = await file.arrayBuffer();
      currentParsedMidi.value = mp.parseMidiArrayBuffer(buf);
      currentTemplateNotes.value = mp.flattenNotes(currentParsedMidi.value);
      currentTimingInfo.value = mp.getTimingInfo(currentParsedMidi.value) as typeof currentTimingInfo.value;

      melodyInput.value = mp.notesToSentenceText(currentTemplateNotes.value as unknown[], {
        bpm: currentTimingInfo.value.bpm,
        beatsPerBar: currentTimingInfo.value.beatsPerBar,
        barsPerSentence: Number(barsPerSentence.value),
        offsetFraction: 0,
      });
      scheduleAutoApply();
      setStatus(
        "MIDI 解析成功：" +
          file.name +
          "，音符 " +
          currentTemplateNotes.value.length +
          "，拍号 " +
          currentTimingInfo.value.numerator +
          "/" +
          currentTimingInfo.value.denominator,
        false
      );
      return true;
    } catch (err) {
      setStatus("MIDI 解析失败：" + (err instanceof Error ? err.message : String(err)), true);
      return false;
    }
  }

  function regroupMidiToMelodyInput() {
    try {
      assertCoreReady();
      if (!Array.isArray(currentTemplateNotes.value) || currentTemplateNotes.value.length === 0) {
        setStatus("请先解析 MIDI 文件。", true);
        return;
      }
      type MP = NonNullable<Window["MidiParser"]>;
      const mp = window.MidiParser as MP;
      melodyInput.value = mp.notesToSentenceText(currentTemplateNotes.value as unknown[], {
        bpm: currentTimingInfo.value.bpm,
        beatsPerBar: currentTimingInfo.value.beatsPerBar,
        barsPerSentence: Number(barsPerSentence.value),
        offsetFraction: 0,
      });
      scheduleAutoApply();
      setStatus("已按当前每句小节数重新分句。", false);
    } catch (err) {
      setStatus("重新分句失败：" + (err instanceof Error ? err.message : String(err)), true);
    }
  }

  function parseSseEventBlock(block: string): { event: string; data: string } {
    const lines = String(block || "").split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    lines.forEach((line) => {
      if (!line || line.startsWith(":")) return;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim() || "message";
        return;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    });
    return { event, data: dataLines.join("\n") };
  }

  function readTextField(payload: unknown): string | null {
    if (typeof payload === "string") return payload;
    if (typeof payload === "number" && Number.isFinite(payload)) return String(payload);
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    const keys = ["text", "delta", "content", "result"] as const;
    for (const k of keys) {
      const v = p[k];
      if (typeof v === "string") return v;
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return null;
  }

  function extractThinkText(src: string): string {
    const text = String(src || "");
    const done = Array.from(text.matchAll(/<think>([\s\S]*?)<\/think>/g));
    if (done.length > 0) {
      return String(done[done.length - 1]?.[1] || "").trim();
    }
    const open = text.match(/<think>([\s\S]*)$/);
    return open ? String(open[1] || "").trim() : "";
  }

  function stripThinkBlocks(src: string): string {
    return String(src || "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/<think>[\s\S]*$/g, "")
      .trim();
  }

  async function requestAiLyricsAnnotateLegacy(text: string) {
    const resp = await fetch(String(ANNOTATE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    let payload: unknown = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }
    if (!resp.ok) {
      const p = payload as { message?: string; msg?: string; error?: string } | null;
      const msg = (p && (p.message || p.msg || p.error)) || resp.statusText || "请求失败";
      throw new Error(String(msg));
    }
    const raw = extractAnnotateResult(payload);
    if (raw === null || raw === undefined) {
      throw new Error("响应中缺少 data.result");
    }
    const out = typeof raw === "number" && Number.isFinite(raw) ? String(raw) : raw;
    if (typeof out !== "string") throw new Error("data.result 应为字符串");
    lyricsInput.value = out;
  }

  async function requestAiLyricsAnnotate() {
    const text = toAnnotatePlainLyricsText(lyricsInput.value).trim();
    if (!text) {
      setStatus("请先填写歌词输入。", true);
      return;
    }
    aiAnnotateController?.abort();
    aiAnnotateController = new AbortController();
    aiAnnotateLoading.value = true;
    setStatus("AI分词流式请求中…", false);
    try {
      const resp = await fetch(String(ANNOTATE_STREAM_URL), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ text }),
        signal: aiAnnotateController.signal,
      });
      if (!resp.ok) {
        throw new Error(resp.statusText || "请求失败");
      }
      if (!resp.body) {
        throw new Error("响应体为空");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let sseBuf = "";
      let modelText = "";
      let finalText = "";
      let gotDone = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const parts = sseBuf.split("\n\n");
        sseBuf = parts.pop() || "";
        for (const part of parts) {
          const ev = parseSseEventBlock(part);
          if (!ev.data) continue;
          if (ev.event === "error") {
            let msg = ev.data;
            try {
              const parsed = JSON.parse(ev.data) as { message?: string; msg?: string; error?: string };
              msg = parsed.message || parsed.msg || parsed.error || ev.data;
            } catch {
              // keep raw text
            }
            throw new Error(msg || "流式接口返回错误");
          }
          if (ev.event === "done") {
            gotDone = true;
            continue;
          }
          if (ev.event === "delta" || ev.event === "message") {
            let piece = "";
            try {
              piece = readTextField(JSON.parse(ev.data)) || "";
            } catch {
              piece = ev.data;
            }
            if (piece) {
              modelText += piece;
              const think = extractThinkText(modelText);
              if (think) {
                setStatus(think, false);
              }
              finalText = stripThinkBlocks(modelText);
              if (finalText) {
                lyricsInput.value = finalText;
              }
            }
          }
        }
      }
      if (!gotDone && !finalText) {
        throw new Error("流式响应未返回有效内容");
      }
      if (finalText) lyricsInput.value = finalText;
      scheduleAutoCalc();
      setStatus("AI分词已写入歌词输入。", false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("AI分词已取消。", true);
        return;
      }
      try {
        await requestAiLyricsAnnotateLegacy(text);
        scheduleAutoCalc();
        setStatus("AI分词已写入歌词输入。", false);
      } catch (legacyErr) {
        const msg = legacyErr instanceof Error ? legacyErr.message : String(legacyErr || err);
        setStatus("AI分词失败：" + msg, true);
      }
    } finally {
      aiAnnotateLoading.value = false;
      aiAnnotateController = null;
    }
  }

  function setLyricsEditorEl(el: HTMLElement | null) {
    lyricsEditorElement.value = el;
  }

  watch([lyricsHtml, lyricsEditorElement], () => {
    applyLyricsHtmlToEditor(lyricsEditorElement.value);
  });

  let removeLayoutMq: (() => void) | null = null;
  onMounted(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onMq = () => {
      layoutNarrow.value = mq.matches;
    };
    onMq();
    mq.addEventListener("change", onMq);
    removeLayoutMq = () => mq.removeEventListener("change", onMq);
    try {
      assertCoreReady();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e), true);
      return;
    }
    nextDemoCase();
  });
  onUnmounted(() => {
    aiAnnotateController?.abort();
    removeLayoutMq?.();
  });

  /** After lyricsHtml changes, push into contenteditable (caller runs in nextTick). */
  function applyLyricsHtmlToEditor(el: HTMLElement | null) {
    if (!el) return;
    const sel = getSelectionOffsets(el);
    if (el.innerHTML !== lyricsHtml.value) {
      el.innerHTML = lyricsHtml.value;
    }
    restoreSelectionOffsets(el, sel);
  }

  function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

    const preStart = range.cloneRange();
    preStart.selectNodeContents(root);
    preStart.setEnd(range.startContainer, range.startOffset);
    const start = preStart.toString().length;

    const preEnd = range.cloneRange();
    preEnd.selectNodeContents(root);
    preEnd.setEnd(range.endContainer, range.endOffset);
    const end = preEnd.toString().length;

    return { start, end };
  }

  function resolveTextPoint(root: HTMLElement, targetOffset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let remain = Math.max(0, targetOffset);
    while (node) {
      const len = node.textContent?.length || 0;
      if (remain <= len) return { node, offset: remain };
      remain -= len;
      node = walker.nextNode();
    }
    return { node: root, offset: root.childNodes.length };
  }

  function restoreSelectionOffsets(root: HTMLElement, pos: { start: number; end: number } | null) {
    if (!pos) return;
    if (document.activeElement !== root) return;
    const sel = window.getSelection?.();
    if (!sel) return;
    const startPoint = resolveTextPoint(root, pos.start);
    const endPoint = resolveTextPoint(root, pos.end);
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return reactive({
    leftColumnFr,
    inputAreaH,
    previewResultH,
    layoutNarrow,
    lyricsInput,
    melodyInput,
    statusMessage,
    statusIsError,
    barsPerSentence,
    melodyInnerHtml,
    lyricsHtml,
    tooltip,
    currentSingleCharArray,
    demoCaseIndex,
    aiAnnotateLoading,
    setStatus,
    calcFromRawInputs,
    scheduleAutoCalc,
    scheduleAutoApply,
    onLyricsEditorInput,
    onLyricsEditorKeydown,
    onPreviewPointerMove,
    onPreviewMouseLeave,
    nextDemoCase,
    parseMidiToMelodyInput,
    regroupMidiToMelodyInput,
    requestAiLyricsAnnotate,
    applyLyricsHtmlToEditor,
    lyricsEditorElement,
    setLyricsEditorEl,
    renderPreview,
  });
}

<script setup lang="ts">
import { nextTick, ref } from "vue";
import AppShell from "./components/AppShell.vue";
import LyricsMelodyInputs from "./components/LyricsMelodyInputs.vue";
import MelodyLyricsPreview from "./components/MelodyLyricsPreview.vue";
import ValidationTooltip from "./components/ValidationTooltip.vue";
import { useLyricsMelodyCheck } from "./composables/useLyricsMelodyCheck";
import { useTheme } from "./composables/useTheme";
import { INPUT_TEXTAREA_MAX_H, INPUT_TEXTAREA_MIN_H, runRowSplitHDrag } from "./lib/columnSplit";

const theme = useTheme();
const check = useLyricsMelodyCheck();
const maskPhase = ref<"idle" | "prep" | "in" | "out">("idle");

function onMidiChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (check.melodyInput && !globalThis.confirm("上传 MIDI 后将覆盖当前旋律输入，是否继续？")) {
    input.value = "";
    return;
  }
  void check.parseMidiToMelodyInput(file).finally(() => {
    input.value = "";
  });
}

function onInputAreaDragDown(ev: MouseEvent) {
  const t = ev.target as HTMLElement | null;
  if (t?.closest("button")) return;
  runRowSplitHDrag(
    ev,
    check.inputAreaH,
    (n) => {
      check.inputAreaH = n;
    },
    INPUT_TEXTAREA_MIN_H,
    INPUT_TEXTAREA_MAX_H
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function onThemeCycle() {
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    theme.cyclePreference();
    return;
  }
  maskPhase.value = "prep";
  await nextTick();
  await waitNextFrame();
  maskPhase.value = "in";
  await sleep(300);
  theme.cyclePreference();
  maskPhase.value = "out";
  await sleep(1500);
  maskPhase.value = "idle";
}
</script>

<template>
  <div class="app">
    <AppShell
      :status-message="check.statusMessage"
      :status-is-error="check.statusIsError"
      :dark-mode="theme.resolvedDark"
      @theme-cycle="onThemeCycle"
      @sample="check.nextDemoCase"
    />
    <div
      v-if="maskPhase !== 'idle'"
      class="theme-mask"
      :class="maskPhase === 'in' ? 'is-in' : maskPhase === 'out' ? 'is-out' : ''"
      aria-hidden="true"
    />

    <div class="page-body">
      <LyricsMelodyInputs
        v-model:melody-input="check.melodyInput"
        v-model:lyrics-input="check.lyricsInput"
        v-model:left-column-fr="check.leftColumnFr"
        v-model:bars-per-sentence="check.barsPerSentence"
        :input-area-h="check.inputAreaH"
        :layout-narrow="check.layoutNarrow"
        :ai-loading="check.aiAnnotateLoading"
        @update:lyrics-input="check.scheduleAutoCalc()"
        @melody-blur="check.scheduleAutoApply()"
        @ai-annotate="check.requestAiLyricsAnnotate()"
        @midi-change="onMidiChange"
        @bars-apply="check.regroupMidiToMelodyInput"
      />

      <div class="split-bar" aria-hidden="false">
        <div class="split-drag" @mousedown="onInputAreaDragDown" />
        <span class="split-label">↓ 校对</span>
        <span class="split-hint">悬停任意歌词片段、旋律片段，查看声调分析</span>
        <button type="button" class="btn-primary" @click="check.calcFromRawInputs">重新校对</button>
      </div>

      <div class="result-wrap">
        <MelodyLyricsPreview
          v-model:left-column-fr="check.leftColumnFr"
          v-model:preview-result-h="check.previewResultH"
          :layout-narrow="check.layoutNarrow"
          :melody-inner-html="check.melodyInnerHtml"
          :set-lyrics-editor-el="check.setLyricsEditorEl"
          @lyrics-input="check.onLyricsEditorInput"
          @lyrics-keydown="check.onLyricsEditorKeydown"
          @pointer-move="(e, root) => check.onPreviewPointerMove(e, root)"
          @leave="(root) => check.onPreviewMouseLeave(root)"
        />
      </div>
    </div>

    <ValidationTooltip
      :visible="check.tooltip.visible"
      :x="check.tooltip.x"
      :y="check.tooltip.y"
      :lines="check.tooltip.lines"
    />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.theme-mask {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  background:
    radial-gradient(120% 120% at 50% 20%, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.8) 80%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8));
}

.theme-mask.is-in {
  transition: opacity 0.3s cubic-bezier(0.33, 0, 0.2, 1);
  opacity: 0.8;
}

.theme-mask.is-out {
  transition: opacity 1.5s cubic-bezier(0.25, 0.1, 0.25, 1);
  opacity: 0;
}

.page-body {
  flex: 1;
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
}

.split-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px 16px;
  min-height: 40px;
  height: 40px;
  padding: 0 28px;
  margin: 0px 0 0;
  background: var(--split-bar-bg);
  border-top: 0.5px solid var(--split-bar-border);
  border-bottom: 0.5px solid var(--border-mid);
  box-sizing: border-box;
  position: relative;
}

.split-drag {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: row-resize;
}

.split-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--split-label);
  white-space: nowrap;
}

.split-hint {
  margin: 0;
  min-width: 0;
  text-align: center;
  font-size: 13px;
  color: var(--ink-60);
  line-height: 1.35;
}

.split-bar .btn-primary {
  background: var(--split-btn-bg);
  color: var(--split-btn-text);
  border-color: var(--split-btn-border);
}

.split-bar .btn-primary:hover {
  background: var(--split-btn-hover-bg);
  border-color: var(--split-btn-hover-border);
}

.result-wrap {
  width: 100%;
  padding-top: 0;
  box-sizing: border-box;
}
</style>

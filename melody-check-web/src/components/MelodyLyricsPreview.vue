<script setup lang="ts">
import type { Ref } from "vue";
import { computed, ref, toValue } from "vue";
import {
  COL_SPLIT_TRACK_PX,
  PREVIEW_OUT_MAX_H,
  PREVIEW_OUT_MIN_H,
  runColumnSplitVDrag,
  runRowSplitHDrag,
} from "../lib/columnSplit";

const props = defineProps<{
  melodyInnerHtml: string | Ref<string>;
  setLyricsEditorEl: (el: HTMLElement | null) => void;
  leftColumnFr: number;
  layoutNarrow: boolean;
  previewResultH: number;
}>();

const melodyHtml = computed(() => String(toValue(props.melodyInnerHtml)));

const emit = defineEmits<{
  lyricsInput: [e: Event];
  lyricsKeydown: [e: KeyboardEvent];
  "update:leftColumnFr": [n: number];
  "update:previewResultH": [n: number];
  pointerMove: [e: MouseEvent, root: HTMLElement];
  leave: [root: HTMLElement];
}>();

const hoverRoot = ref<HTMLElement | null>(null);
const gridRef = ref<HTMLElement | null>(null);
const melodyBodyRef = ref<HTMLElement | null>(null);
const lyricsBodyRef = ref<HTMLElement | null>(null);
let syncingFrom: "melody" | "lyrics" | null = null;

const gridStyle = computed(() => {
  if (props.layoutNarrow) {
    return {};
  }
  const l = props.leftColumnFr;
  const r = 100 - l;
  return {
    gridTemplateColumns: `${l}fr ${COL_SPLIT_TRACK_PX}px ${r}fr`,
  } as Record<string, string>;
});

function onVDown(e: MouseEvent) {
  if (props.layoutNarrow) return;
  const el = gridRef.value;
  if (!el) return;
  runColumnSplitVDrag(e, el, props.leftColumnFr, (n) => emit("update:leftColumnFr", n));
}

function onHDown(e: MouseEvent) {
  runRowSplitHDrag(
    e,
    props.previewResultH,
    (n) => emit("update:previewResultH", n),
    PREVIEW_OUT_MIN_H,
    PREVIEW_OUT_MAX_H
  );
}

function syncScroll(from: "melody" | "lyrics") {
  const melodyEl = melodyBodyRef.value;
  const lyricsEl = lyricsBodyRef.value;
  if (!melodyEl || !lyricsEl) return;
  if (syncingFrom && syncingFrom !== from) return;
  syncingFrom = from;
  if (from === "melody") {
    lyricsEl.scrollTop = melodyEl.scrollTop;
    lyricsEl.scrollLeft = melodyEl.scrollLeft;
  } else {
    melodyEl.scrollTop = lyricsEl.scrollTop;
    melodyEl.scrollLeft = lyricsEl.scrollLeft;
  }
  requestAnimationFrame(() => {
    syncingFrom = null;
  });
}

function setLyricsBodyEl(el: HTMLElement | null) {
  lyricsBodyRef.value = el;
  props.setLyricsEditorEl(el);
}
</script>

<template>
  <div
    ref="hoverRoot"
    class="preview-root"
    @mousemove="hoverRoot && emit('pointerMove', $event, hoverRoot)"
    @mouseleave="hoverRoot && emit('leave', hoverRoot)"
  >
    <div
      ref="gridRef"
      class="preview-pair"
      :class="{ 'preview-pair--stacked': layoutNarrow }"
      :style="!layoutNarrow ? gridStyle : undefined"
    >
      <section class="out-card out-card--melody">
        <div class="out-head">
          <h2 class="out-title out-title--melody">旋律校对</h2>
          <div class="out-head-actions">
            <span class="out-sub">计算每句匹配度</span>
          </div>
        </div>
        <div class="out-body-wrap" :style="{ height: previewResultH + 'px' }">
          <div
            ref="melodyBodyRef"
            class="out-body readonly melody-wrap"
            spellcheck="false"
            @scroll="syncScroll('melody')"
          >
            <div class="melody-inner" v-html="melodyHtml" />
          </div>
        </div>
      </section>
      <div
        v-if="!layoutNarrow"
        class="gutter gutter-v"
        role="separator"
        aria-orientation="vertical"
        @mousedown="onVDown"
      />
      <section class="out-card out-card--lyrics">
        <div class="out-head">
          <h2 class="out-title out-title--lyrics">歌词校对</h2>
          <div class="out-head-actions">
            <span class="out-sub">编辑拼音、分隔线</span>
          </div>
        </div>
        <div class="out-body-wrap" :style="{ height: previewResultH + 'px' }">
          <div
            class="out-body lyrics-editor"
            contenteditable="true"
            spellcheck="false"
            :ref="(el) => setLyricsBodyEl((el as HTMLElement) || null)"
            @input="emit('lyricsInput', $event)"
            @keydown="emit('lyricsKeydown', $event)"
            @scroll="syncScroll('lyrics')"
          />
        </div>
      </section>
    </div>
    <div
      class="gutter gutter-h"
      role="separator"
      aria-orientation="horizontal"
      @mousedown="onHDown"
    />
  </div>
</template>

<style scoped>
.preview-root {
  min-width: 0;
  padding: 0 28px 20px;
  max-width: 1500px;
  margin: 0 auto;
  box-sizing: border-box;
}

.preview-pair {
  display: grid;
  align-items: stretch;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  min-width: 0;
}

.preview-pair--stacked {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gutter {
  flex-shrink: 0;
  z-index: 1;
  touch-action: none;
  background: transparent;
}

.gutter-v {
  display: block;
  width: 100%;
  min-width: 0;
  margin: 0;
  min-height: 120px;
  cursor: col-resize;
  align-self: stretch;
}

.gutter-h {
  display: block;
  width: 100%;
  height: 6px;
  margin-top: 0;
  cursor: row-resize;
}

.out-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-card);
  border-left: 3px solid var(--melody-stripe);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  overflow: hidden;
}

.out-card--lyrics {
  border-left-color: var(--lyrics-stripe);
}

.out-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 14px 8px;
  min-width: 0;
}

.out-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  flex-shrink: 0;
}

.out-title--melody {
  color: var(--indigo-500);
}

.out-title--lyrics {
  color: var(--sage-600);
}

.out-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1 1 160px;
  min-width: 0;
}

.out-sub {
  margin: 0;
  font-size: 12px;
  color: var(--ink-60);
  line-height: 1.4;
  min-width: 0;
}

.out-body-wrap {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-top: 0.5px solid var(--border-mid);
  background: var(--panel-fill);
  flex: 0 0 auto;
}

.out-body {
  height: 100%;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  border: none;
  padding: 10px 12px 12px 14px;
  background: transparent;
  color: var(--ink);
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  line-height: 1.6;
  box-sizing: border-box;
}

.readonly {
  cursor: default;
}

.lyrics-editor:focus {
  outline: 2px solid var(--indigo-500);
  outline-offset: 0;
}

.melody-inner :deep(.melody-line-row) {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.melody-inner :deep(.melody-line-prefix) {
  flex: 0 0 4.2em;
  width: 4.2em;
  text-align: right;
  font-size: 12px;
  font-weight: 500;
  line-height: 2;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.melody-inner :deep(.melody-line-prefix.pct-hi) {
  color: var(--sage-600);
}

.melody-inner :deep(.melody-line-prefix.pct-mid) {
  color: var(--amber-500);
}

.melody-inner :deep(.melody-line-prefix.pct-lo) {
  color: var(--rose-600);
}

.melody-inner :deep(.melody-line-content) {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 2;
}

.melody-inner :deep(.line),
.lyrics-editor :deep(.line) {
  margin-bottom: 6px;
}

.melody-inner :deep(.segment),
.lyrics-editor :deep(.segment) {
  display: inline-block;
  margin-right: 8px;
}

.melody-inner :deep(.token),
.lyrics-editor :deep(.token) {
  display: inline-block;
  position: relative;
  margin-right: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  vertical-align: baseline;
  border-bottom: 2px solid transparent;
}

.melody-inner :deep(.m-ok) {
  background: var(--tok-blue-bg);
  color: var(--tok-blue-text);
  border-bottom-color: transparent;
}

.melody-inner :deep(.m-mid) {
  background: var(--tok-amber-bg);
  color: var(--tok-amber-text);
  border-bottom-color: var(--amber-500);
}

.melody-inner :deep(.m-bad),
.melody-inner :deep(.m-inv) {
  background: var(--tok-rose-bg);
  color: var(--tok-rose-text);
  border-bottom-color: var(--rose-600);
}

.lyrics-editor :deep(.l-ok) {
  background: var(--tok-green-bg);
  color: var(--tok-green-text);
}

.lyrics-editor :deep(.l-mid) {
  background: var(--tok-amber-bg);
  color: var(--tok-amber-text);
  border-bottom-color: var(--amber-500);
}

.lyrics-editor :deep(.l-bad),
.lyrics-editor :deep(.l-inv) {
  background: var(--tok-rose-bg);
  color: var(--tok-rose-text);
  border-bottom-color: var(--rose-600);
}

.melody-inner :deep(.token.hover),
.lyrics-editor :deep(.token.hover) {
  outline: 1px solid var(--indigo-500);
  box-shadow: 0 0 0 1px rgba(74, 111, 165, 0.3);
}

.lyrics-editor :deep(.ly-char) {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 400;
}

.lyrics-editor :deep(.py-sub) {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-60);
  font-weight: 400;
  margin-left: 1px;
  vertical-align: bottom;
  position: relative;
  top: 0.15em;
}

.melody-inner :deep(.gap),
.lyrics-editor :deep(.gap) {
  display: inline-block;
  width: 4px;
  min-height: 1em;
}
</style>

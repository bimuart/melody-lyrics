<script setup lang="ts">
import type { Ref } from "vue";
import { computed, ref, toValue } from "vue";
import {
  COL_SPLIT_TRACK_PX,
  runColumnSplitVDrag,
} from "../lib/columnSplit";

const props = defineProps<{
  melodyInput: string | Ref<string>;
  lyricsInput: string | Ref<string>;
  aiLoading: boolean | Ref<boolean>;
  leftColumnFr: number;
  layoutNarrow: boolean;
  barsPerSentence: string | Ref<string>;
  inputAreaH: number;
}>();

const emit = defineEmits<{
  "update:melodyInput": [v: string];
  "update:lyricsInput": [v: string];
  "update:leftColumnFr": [n: number];
  "update:barsPerSentence": [v: string];
  melodyBlur: [];
  aiAnnotate: [];
  midiChange: [e: Event];
  barsApply: [];
}>();

const melodyVal = computed(() => String(toValue(props.melodyInput)));
const lyricsVal = computed(() => String(toValue(props.lyricsInput)));
const aiBusy = computed(() => Boolean(toValue(props.aiLoading)));
const barsVal = computed(() => String(toValue(props.barsPerSentence)));
const melodyInputRef = ref<HTMLTextAreaElement | null>(null);
const lyricsInputRef = ref<HTMLTextAreaElement | null>(null);
let syncingFrom: "melody" | "lyrics" | null = null;

function onBarsSelectChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value;
  emit("update:barsPerSentence", v);
  emit("barsApply");
}

const gridRef = ref<HTMLElement | null>(null);

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

function syncInputScroll(from: "melody" | "lyrics") {
  const melodyEl = melodyInputRef.value;
  const lyricsEl = lyricsInputRef.value;
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

</script>

<template>
  <div class="input-section">
    <div
      ref="gridRef"
      class="input-grid"
      :class="{ 'input-grid--stacked': layoutNarrow }"
      :style="!layoutNarrow ? gridStyle : undefined"
    >
      <section class="input-card input-card--melody">
        <div class="card-head">
          <h2 class="input-title input-title--melody">旋律输入</h2>
          <div class="card-head-actions">
            <span class="card-sub">直接输入或用MIDI文件自动填充</span>
            <label class="btn-sec file-midi">
              上传 MIDI
              <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/x-midi"
                class="file-input"
                @change="emit('midiChange', $event)"
              />
            </label>
            <label class="btn-sec bars-ctl">
              <span class="bars-lab">每句小节</span>
              <span class="bar-value">{{ barsVal }}</span>
              <select class="bar-select-overlay" :value="barsVal" @change="onBarsSelectChange">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </label>
          </div>
        </div>
        <div class="input-textarea-wrap" :style="{ height: inputAreaH + 'px' }">
          <textarea
            ref="melodyInputRef"
            class="input-textarea input-textarea--mono"
            :value="melodyVal"
            spellcheck="false"
            @input="$emit('update:melodyInput', ($event.target as HTMLTextAreaElement).value)"
            @blur="$emit('melodyBlur')"
            @scroll="syncInputScroll('melody')"
          />
        </div>
      </section>
      <div
        v-if="!layoutNarrow"
        class="gutter gutter-v"
        role="separator"
        aria-orientation="vertical"
        @mousedown="onVDown"
      />
      <section class="input-card input-card--lyrics">
        <div class="card-head">
          <h2 class="input-title input-title--lyrics">歌词输入</h2>
          <div class="card-head-actions">
            <span class="card-sub">空格或斜杠分词，特殊字可注音</span>
            <button
              type="button"
              class="btn-sec"
              :disabled="aiBusy"
              @click="$emit('aiAnnotate')"
            >
              {{ aiBusy ? "AI分词中…" : "AI分词" }}
            </button>
          </div>
        </div>
        <div class="input-textarea-wrap" :style="{ height: inputAreaH + 'px' }">
          <textarea
            ref="lyricsInputRef"
            class="input-textarea input-textarea--mono"
            :value="lyricsVal"
            spellcheck="false"
            @input="$emit('update:lyricsInput', ($event.target as HTMLTextAreaElement).value)"
            @scroll="syncInputScroll('lyrics')"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.input-section {
  padding: 20px 28px 0;
  max-width: 1500px;
  margin: 0 auto;
}

.input-grid {
  display: grid;
  align-items: stretch;
  /* 默认 1fr 1fr；宽屏时由 :style 覆盖为 leftFr 与 100-leftFr */
  grid-template-columns: 1fr 1fr;
  gap: 0;
  min-width: 0;
}

.input-grid--stacked {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-card {
  position: relative;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-card);
  padding: 0;
  border-left: 3px solid var(--melody-stripe);
  border-top-right-radius: var(--radius-card);
  border-bottom-right-radius: var(--radius-card);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  overflow: hidden;
}

.input-card--lyrics {
  border-left-color: var(--lyrics-stripe);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 14px 8px;
  min-width: 0;
}

.input-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  flex-shrink: 0;
}

.input-title--melody {
  color: var(--indigo-500);
}

.input-title--lyrics {
  color: var(--sage-600);
}

.card-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: 1 1 200px;
  min-width: 0;
}

.card-sub {
  margin: 0;
  font-size: 12px;
  color: var(--ink-60);
  line-height: 1.4;
  min-width: 0;
}

.file-midi {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0;
}

.file-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 0.1px;
  height: 0.1px;
  opacity: 0;
}

.bars-ctl {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  margin: 0;
  position: relative;
  padding-right: 18px;
}

.bars-ctl::after {
  content: "▾";
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--ink-60);
  pointer-events: none;
}

.bars-lab {
  white-space: nowrap;
  font-size: 13px;
}

.bar-value {
  min-width: 0.8em;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: var(--ink-60);
}

.bar-select-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  font-size: 12px;
  background: transparent;
  color: transparent;
  cursor: pointer;
  opacity: 0;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  outline: none;
}

.input-textarea-wrap {
  min-width: 0;
  min-height: 0;
  margin: 0 0 0;
  border-top: 0.5px solid var(--border-mid);
  background: var(--panel-fill);
  box-sizing: border-box;
}

.input-textarea {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  resize: none;
  border: none;
  background: transparent;
  padding: 10px 12px 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink);
}

.input-textarea--mono {
  font-family: var(--font-mono);
}

.btn-sec {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 5px;
  border: 0.5px solid var(--border-mid);
  background: var(--surface);
  color: var(--ink-60);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.btn-sec:hover:not(:disabled) {
  background: var(--surface-2);
}

.btn-sec:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 可拖的透明区，不画线（避免多出一道细线） */
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

.input-grid--stacked .gutter-v {
  display: none;
}
</style>

<script setup lang="ts">
import type { Ref } from "vue";
import { computed, toValue } from "vue";

const props = defineProps<{
  statusMessage: string | Ref<string>;
  statusIsError: boolean | Ref<boolean>;
  darkMode: boolean | Ref<boolean>;
}>();

const emit = defineEmits<{
  themeCycle: [];
  sample: [];
}>();

const statusText = computed(() => String(toValue(props.statusMessage)));
const statusErr = computed(() => Boolean(toValue(props.statusIsError)));
const isDark = computed(() => Boolean(toValue(props.darkMode)));
const statusShouldScroll = computed(() => !statusErr.value && statusText.value.length > 20);
</script>

<template>
  <header class="app-header">
    <div class="app-header-inner">
      <div class="brand">
        <h1 class="head-title">歌词字音 & 音乐旋律校对</h1>
        <p class="head-sub">检查文字声调与旋律音程匹配情况。</p>
      </div>
      <p class="head-status" :class="[statusErr ? 'is-err' : 'is-ok', statusShouldScroll ? 'is-scroll' : '']">
        <span class="status-text">{{ statusText || "" }}</span>
      </p>
      <div class="head-tools">
        <button type="button" class="ghost" @click="emit('sample')">示例</button>
        <button
          type="button"
          class="ghost theme-ghost"
          :title="isDark ? '切换浅色模式' : '切换深色模式'"
          @click="emit('themeCycle')"
        >
          <span aria-hidden="true">{{ isDark ? "☀" : "☾" }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: var(--header-bg);
  min-height: 56px;
  padding: 0 28px;
  display: flex;
  align-items: center;
}

.app-header-inner {
  max-width: 1500px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  min-height: 56px;
  padding: 8px 0;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 200px;
}

.head-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--header-title);
  line-height: 1.25;
}

.head-sub {
  margin: 0;
  font-size: 12px;
  color: var(--header-sub);
  line-height: 1.35;
  max-width: 36rem;
}

.head-status {
  margin: 0;
  font-size: 12px;
  max-width: 200px;
  line-height: 1.3;
  flex: 0 1 auto;
  overflow: hidden;
  white-space: nowrap;
}

.head-status.is-ok {
  color: var(--header-status-ok);
}

.head-status.is-err {
  color: var(--header-status-err);
}

.head-status .status-text {
  display: inline-block;
}

.head-status.is-scroll .status-text {
  padding-left: 100%;
  animation: head-status-marquee 10s linear infinite;
}

.head-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.ghost {
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  background: var(--header-ghost);
  color: var(--header-ghost-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.ghost:hover {
  background: var(--header-ghost-hover);
  color: var(--header-ghost-text-hover);
}

.theme-ghost {
  width: 34px;
  padding: 0;
  font-size: 16px;
  font-weight: 600;
}

@keyframes head-status-marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-100%);
  }
}

@media (max-width: 900px) {
  .head-status {
    order: 10;
    width: 100%;
    max-width: none;
  }
}
</style>

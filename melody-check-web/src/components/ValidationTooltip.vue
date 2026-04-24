<script setup lang="ts">
import type { Ref } from "vue";
import { computed, toValue } from "vue";
import type { ValidationLine } from "../lib/checkHelpers";

const props = defineProps<{
  visible: boolean | Ref<boolean>;
  x: number | Ref<number>;
  y: number | Ref<number>;
  lines: ValidationLine[] | Ref<ValidationLine[]>;
}>();

const vis = computed(() => Boolean(toValue(props.visible)));
const px = computed(() => Number(toValue(props.x)));
const py = computed(() => Number(toValue(props.y)));
const displayLines = computed(() => toValue(props.lines) as ValidationLine[]);
</script>

<template>
  <Teleport to="body">
    <div
      v-show="vis"
      class="v-tooltip"
      :style="{
        left: px + 'px',
        top: py + 'px',
      }"
      role="tooltip"
    >
      <ul class="v-list">
        <li v-for="(line, i) in displayLines" :key="i" class="v-block">
          <template v-if="line && typeof line === 'object' && !Array.isArray(line)">
            <div class="v-line-head">
              <span class="v-t">{{ line.title }}</span>
              <span
                v-if="line.status"
                class="v-s"
                :class="line.status === '匹配' ? 'ok' : line.status === '不匹配' ? 'bad' : ''"
                >{{ line.status }}</span
              >
            </div>
            <div v-for="(d, j) in line.details || []" :key="j" class="v-d">{{ d }}</div>
          </template>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<style scoped>
.v-tooltip {
  position: fixed;
  z-index: 10000;
  width: 240px;
  max-width: min(240px, 92vw);
  padding: 12px 14px;
  background: var(--tooltip-bg);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.v-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.v-block {
  margin-bottom: 10px;
}

.v-block:last-child {
  margin-bottom: 0;
}

.v-line-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}

.v-t {
  font-size: 11px;
  font-weight: 500;
  color: var(--tooltip-title);
}

.v-s {
  font-size: 12px;
  font-weight: 500;
}

.v-s.ok {
  color: var(--tooltip-match);
}

.v-s.bad {
  color: var(--tooltip-mismatch);
}

.v-d {
  font-size: 12px;
  line-height: 1.45;
  color: var(--tooltip-body);
  margin-top: 2px;
}
</style>

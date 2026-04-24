/** 两列中间可拖区宽度（与 grid 第三列一致） */
export const COL_SPLIT_TRACK_PX = 12;

export const COL_SPLIT_MIN_FR = 15;
export const COL_SPLIT_MAX_FR = 85;

/** 约再小两行（~13px * 1.5 * 2） */
export const INPUT_TEXTAREA_MIN_H = 80;
export const INPUT_TEXTAREA_MAX_H = 720;

/** 下方校对区两栏内容区共用高度 */
export const PREVIEW_OUT_MIN_H = 120;
export const PREVIEW_OUT_MAX_H = 720;

/**
 * 中间竖线拖拽：根据 grid 总宽与水平位移更新左列 fr。
 */
export function runColumnSplitVDrag(
  e: MouseEvent,
  gridEl: HTMLElement,
  startFr: number,
  onFr: (n: number) => void
): void {
  e.preventDefault();
  const startX = e.clientX;
  const startL = startFr;
  const gridW = gridEl.getBoundingClientRect().width;
  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX;
    if (gridW < 1) return;
    const dFr = (dx / gridW) * 100;
    onFr(Math.max(COL_SPLIT_MIN_FR, Math.min(COL_SPLIT_MAX_FR, startL + dFr)));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

/**
 * 底部分隔条：纵向拖拽，更新内容区高度（与上方横条行为一致）。
 */
export function runRowSplitHDrag(
  e: MouseEvent,
  startH: number,
  onH: (n: number) => void,
  min: number,
  max: number
): void {
  e.preventDefault();
  const startY = e.clientY;
  const startP = startH;
  const onMove = (ev: MouseEvent) => {
    const dy = ev.clientY - startY;
    onH(Math.max(min, Math.min(max, startP + dy)));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };
  document.body.style.userSelect = "none";
  document.body.style.cursor = "row-resize";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

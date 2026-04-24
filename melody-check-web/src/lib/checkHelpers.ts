export function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeEditorText(text: string): string {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

export function compactSlashSpacing(text: string): string {
  return String(text || "").replace(/\s*\/\s*/g, "/");
}

export function toComputeLyricsFormat(text: string): string {
  const src = String(text || "");
  // 支持「字拼音」无括号写法，并修正「字/(ni3)」「字 (ni3)」等形式，
  // 避免字与拼音之间的空格/斜杠被误当作分词分隔。
  return src
    .replace(
      /([\u4e00-\u9fa5])(?:\s|\/|／)+\(\s*([a-zA-ZvVüÜ]+[0-4]?)\s*\)/g,
      (_m, ch: string, py: string) => ch + "(" + py + ")"
    )
    .replace(
      /([\u4e00-\u9fa5])\s*\(\s*([a-zA-ZvVüÜ]+[0-4]?)\s*\)/g,
      (_m, ch: string, py: string) => ch + "(" + py + ")"
    )
    .replace(
      /([\u4e00-\u9fa5])(?:\s|\/|／)*([a-zA-ZvVüÜ]+[0-4]?)/g,
      (_m, ch: string, py: string) => ch + "(" + py + ")"
    );
}

/**
 * 发送给 AI 分词接口前清洗歌词：
 * - 去掉拼音（含无括号和括号注音）
 * - 保留空格、斜杠、逗号、冒号等分隔符，保持原分词线索
 */
export function toAnnotatePlainLyricsText(text: string): string {
  return String(text || "")
    .replace(/[（(［\[【]\s*[a-zA-ZvVüÜ]+[0-4]?\s*[）)\]］】]/g, "")
    .replace(/[a-zA-ZvVüÜ]+[0-4]?/g, "")
    .replace(/[（(［\[【]\s*[）)\]］】]/g, "");
}

export function parseDemoCaseMarkdown(mdText: string): { title: string; lyrics: string; melody: string } {
  const text = String(mdText || "");
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const lyricsMatch = text.match(/##\s*歌词[\s\S]*?```(?:text)?\s*([\s\S]*?)```/i);
  const melodyMatch = text.match(/##\s*旋律[\s\S]*?```(?:text)?\s*([\s\S]*?)```/i);
  return {
    title: titleMatch ? titleMatch[1].trim() : "示例",
    lyrics: lyricsMatch ? lyricsMatch[1].trim() : "",
    melody: melodyMatch ? melodyMatch[1].trim() : "",
  };
}

export function getDeviationColorClass(deviations: unknown): string | null {
  const cfg = window.IntervalConfig?.DEVIATION_HIGHLIGHT;
  if (!cfg || !Array.isArray(deviations)) return null;
  const nums = deviations.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  if (!nums.every((n) => n !== 0)) return null;
  const absValues = nums.map((n) => Math.abs(n));
  const maxAbs = Math.max.apply(null, absValues);
  if (maxAbs <= Number(cfg.lowMax || 2)) return cfg.colors.low;
  return cfg.colors.high;
}

export function getInvalidUnderlineColor(): string {
  return window.IntervalConfig?.SINGLE_CHAR_UNDERLINE_COLOR || "#5b21b6";
}

export function isDeviationFailed(deviations: unknown): boolean {
  const nums = Array.isArray(deviations) ? deviations.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
  if (nums.length === 0) return false;
  return nums.every((n) => n !== 0);
}

export function getMatchTextColor(): string {
  const cfg = window.IntervalConfig?.DEVIATION_HIGHLIGHT;
  return (cfg?.colors?.zero as string) || "#8fd19e";
}

export function getMismatchTextColor(): string {
  const cfg = window.IntervalConfig?.DEVIATION_HIGHLIGHT;
  return (cfg?.colors?.high as string) || "#ff6b6b";
}

export function getToneRange(prevTone: number, nextTone: number): number[] | null {
  const cfg = window.IntervalConfig?.TONE_INTERVAL_RANGES;
  if (!cfg) return null;
  const key = String(Number(prevTone) || 0) + String(Number(nextTone) || 0);
  return Array.isArray(cfg[key]) && cfg[key].length === 2 ? (cfg[key] as number[]) : null;
}

export function formatSemitoneRange(range: number[] | null): string {
  if (!Array.isArray(range) || range.length !== 2) return "无建议区间";
  const a = Number(range[0]);
  const b = Number(range[1]);
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  if (low === -30 && high === 30) return "任意半音";
  if (low === -30) return high + " 个半音及以下";
  if (high === 30) return low + " 个半音及以上";
  return low + " ~ " + high + " 个半音";
}

export function buildIntervalPairs(nextNotes: unknown, prevNotes: unknown): string[] {
  const next = Array.isArray(nextNotes) ? nextNotes : [];
  const prev = Array.isArray(prevNotes) ? prevNotes : [];
  const pairs: string[] = [];
  next.forEach((n2: string) => {
    prev.forEach((n1: string) => {
      pairs.push(String(n2) + " ~ " + String(n1));
    });
  });
  return pairs;
}

export function formatActualIntervals(intervals: unknown, pairs: string[]): string {
  const arr = Array.isArray(intervals) ? intervals : [];
  if (!arr.length) return "无";
  const valueText = arr.join("或");
  const pairArr = Array.isArray(pairs) ? pairs.filter(Boolean) : [];
  if (!pairArr.length) return valueText;
  return valueText + "（" + pairArr.join(" / ") + "）";
}

export type HoverSide = {
  char: string;
  tone: number;
  notes: string[];
  range: number[] | null;
  intervals: unknown[];
  deviations: unknown[];
};

export type HoverInfo = {
  char: string;
  tone: number;
  notes: string[];
  /** 1 = 字音匹配, 0 = 不匹配 */
  singleValid: number;
  left: HoverSide;
  right: HoverSide;
};

export type ValidationLine =
  | string
  | {
      title: string;
      status?: string;
      details?: string[];
    };

function countCharsInLine(line: unknown[]): number {
  let n = 0;
  (Array.isArray(line) ? line : []).forEach((segment) => {
    n += (Array.isArray(segment) ? segment : []).length;
  });
  return n;
}

function getPrevItemInLine(line: unknown[], segIdx: number, itemIdx: number): unknown[] | null {
  const segs = Array.isArray(line) ? line : [];
  if (itemIdx > 0) {
    const seg = Array.isArray(segs[segIdx]) ? (segs[segIdx] as unknown[]) : [];
    return (seg[itemIdx - 1] as unknown[]) || null;
  }
  for (let s = segIdx - 1; s >= 0; s -= 1) {
    const seg = Array.isArray(segs[s]) ? (segs[s] as unknown[]) : [];
    if (seg.length > 0) return seg[seg.length - 1] as unknown[];
  }
  return null;
}

function getNextItemInLine(line: unknown[], segIdx: number, itemIdx: number): unknown[] | null {
  const segs = Array.isArray(line) ? line : [];
  const seg = Array.isArray(segs[segIdx]) ? (segs[segIdx] as unknown[]) : [];
  if (itemIdx < seg.length - 1) return (seg[itemIdx + 1] as unknown[]) || null;
  for (let s = segIdx + 1; s < segs.length; s += 1) {
    const nextSeg = Array.isArray(segs[s]) ? (segs[s] as unknown[]) : [];
    if (nextSeg.length > 0) return nextSeg[0] as unknown[];
  }
  return null;
}

function linePenalty(line: unknown[]): number {
  const HIGH_WEIGHT = 0.5;
  const LOW_WEIGHT = 0.3;
  let penalty = 0;
  const segs = Array.isArray(line) ? line : [];
  segs.forEach((segment, segIdx) => {
    const seg = Array.isArray(segment) ? segment : [];
    seg.forEach((item: unknown, itemIdx: number) => {
      const it = item as unknown[];
      const singleValid = Number(it[4]) === 1;
      if (!singleValid) penalty += HIGH_WEIGHT;
      const leftDeviations = it[5] && Array.isArray((it[5] as number[])[1]) ? (it[5] as [unknown, unknown[]])[1] : [];
      if (getPrevItemInLine(line, segIdx, itemIdx)) {
        if (isDeviationFailed(leftDeviations)) penalty += HIGH_WEIGHT;
        else if (getDeviationColorClass(leftDeviations)) penalty += LOW_WEIGHT;
      }
      const rightDeviations = it[6] && Array.isArray((it[6] as number[])[1]) ? (it[6] as [unknown, unknown[]])[1] : [];
      if (getNextItemInLine(line, segIdx, itemIdx)) {
        if (isDeviationFailed(rightDeviations)) penalty += HIGH_WEIGHT;
        else if (getDeviationColorClass(rightDeviations)) penalty += LOW_WEIGHT;
      }
    });
  });
  return penalty;
}

export function computeLineMatchPercent(line: unknown[]): number | null {
  const total = countCharsInLine(line);
  if (total <= 0) return null;
  const penalty = linePenalty(line);
  const ratio = Math.min(penalty / total, 1);
  return (1 - ratio) * 100;
}

/** 90%+ 绿，60–90% 琥珀，60% 以下玫红 */
export function getLinePctClass(pct: number | null): "pct-hi" | "pct-mid" | "pct-lo" {
  if (pct === null) return "pct-lo";
  if (pct >= 90) return "pct-hi";
  if (pct >= 60) return "pct-mid";
  return "pct-lo";
}

export function buildPreviewHtml(lines: unknown[][]): {
  melodyInnerHtml: string;
  lyricsHtml: string;
  hoverInfoMap: Record<string, HoverInfo>;
} {
  const hoverInfoMap: Record<string, HoverInfo> = {};
  const melodyRows: string[] = [];
  const lyricLines: string[] = [];

  lines.forEach((line, li) => {
    const lyricSegs: string[] = [];
    const melodySegs: string[] = [];
    const pct = computeLineMatchPercent(line);
    const prefixText = pct === null ? "—" : String(Math.round(pct * 10) / 10) + "%";
    const prefixPctClass = getLinePctClass(pct);

    (Array.isArray(line) ? line : []).forEach((segment, si) => {
      const lyricToks: string[] = [];
      const melodyToks: string[] = [];
      const segArr = Array.isArray(segment) ? segment : [];

      segArr.forEach((item: unknown, ii: number) => {
        const it = item as unknown[];
        const key = li + "-" + si + "-" + ii;
        const char = String(it[0] || "");
        const py = String(it[1] || "");
        const tone = Number(it[2]) || 0;
        const notes = Array.isArray(it[3]) ? (it[3] as string[]) : [];
        const singleValid = Number(it[4]) === 1;
        const leftDeviations = it[5] && Array.isArray((it[5] as [unknown, unknown[]])[1]) ? (it[5] as [unknown, unknown[]])[1] : [];
        const leftIntervals = it[5] && Array.isArray((it[5] as [unknown[], unknown[]])[0]) ? (it[5] as [unknown[], unknown[]])[0] : [];
        const rightDeviations = it[6] && Array.isArray((it[6] as [unknown, unknown[]])[1]) ? (it[6] as [unknown, unknown[]])[1] : [];
        const rightIntervals = it[6] && Array.isArray((it[6] as [unknown[], unknown[]])[0]) ? (it[6] as [unknown[], unknown[]])[0] : [];

        const leftColor = getDeviationColorClass(leftDeviations);
        const rightColor = getDeviationColorClass(rightDeviations);
        const leftFail = isDeviationFailed(leftDeviations);
        const rightFail = isDeviationFailed(rightDeviations);

        let grad = "";
        if (leftColor || rightColor) {
          grad =
            "background-image:linear-gradient(to right, " +
            (leftColor ? leftColor + "55" : "transparent") +
            " 0%, " +
            (leftColor ? leftColor + "55" : "transparent") +
            " 50%, " +
            (rightColor ? rightColor + "55" : "transparent") +
            " 50%, " +
            (rightColor ? rightColor + "55" : "transparent") +
            " 100%);";
        }

        let lClass = "token l-tok";
        if (!singleValid) lClass += " l-inv";
        else if (leftFail || rightFail) lClass += " l-bad";
        else if (leftColor || rightColor) lClass += " l-mid";
        else lClass += " l-ok";

        const lStyle = (grad ? grad : "") + (!singleValid ? "border-bottom:2px solid var(--rose-600);" : "");

        lyricToks.push(
          '<span class="' +
            lClass +
            '" data-key="' +
            escapeHtml(key) +
            '" style="' +
            lStyle +
            '"><span class="ly-char">' +
            escapeHtml(char) +
            '</span><sub class="py-sub">' +
            escapeHtml(py + String(tone)) +
            "</sub></span>"
        );

        let mClass = "token m-tok";
        if (!singleValid) mClass += " m-inv";
        else if (leftFail || rightFail) mClass += " m-bad";
        else if (leftColor || rightColor) mClass += " m-mid";
        else mClass += " m-ok";

        const mStyle = (grad ? grad : "") + (!singleValid ? "border-bottom:2px solid var(--rose-600);" : "");

        melodyToks.push(
          '<span class="' +
            mClass +
            '" data-key="' +
            escapeHtml(key) +
            '" style="' +
            mStyle +
            '">' +
            escapeHtml(notes.join("-")) +
            "</span>"
        );

        const leftItem = ii > 0 ? (segArr[ii - 1] as unknown[]) : null;
        const rightItem = ii < segArr.length - 1 ? (segArr[ii + 1] as unknown[]) : null;
        hoverInfoMap[key] = {
          char,
          tone,
          notes,
          singleValid: singleValid ? 1 : 0,
          left: {
            char: leftItem ? String(leftItem[0] || "") : "",
            tone: leftItem ? Number(leftItem[2]) || 0 : 0,
            notes: leftItem && Array.isArray(leftItem[3]) ? (leftItem[3] as string[]) : [],
            range: leftItem ? getToneRange(Number(leftItem[2]) || 0, tone) : null,
            intervals: leftIntervals as unknown[],
            deviations: leftDeviations,
          },
          right: {
            char: rightItem ? String(rightItem[0] || "") : "",
            tone: rightItem ? Number(rightItem[2]) || 0 : 0,
            notes: rightItem && Array.isArray(rightItem[3]) ? (rightItem[3] as string[]) : [],
            range: rightItem ? getToneRange(tone, Number(rightItem[2]) || 0) : null,
            intervals: rightIntervals as unknown[],
            deviations: rightDeviations,
          },
        };

        if (ii < segArr.length - 1) {
          lyricToks.push('<span class="gap">\u200b</span>');
          melodyToks.push('<span class="gap">\u200b</span>');
        }
      });

      if (si < (Array.isArray(line) ? line.length : 0) - 1) {
        lyricToks.push('<span class="token">/</span>');
        melodyToks.push('<span class="token">/</span>');
      }

      lyricSegs.push('<span class="segment">' + lyricToks.join("") + "</span>");
      melodySegs.push('<span class="segment">' + melodyToks.join("") + "</span>");
    });

    lyricLines.push('<div class="line">' + lyricSegs.join("") + "</div>");
    melodyRows.push(
      '<div class="melody-line-row">' +
        '<div class="melody-line-prefix ' +
        prefixPctClass +
        '">' +
        escapeHtml(prefixText) +
        "</div>" +
        '<div class="melody-line-content">' +
        melodySegs.join("") +
        "</div></div>"
    );
  });

  return {
    melodyInnerHtml: melodyRows.join(""),
    lyricsHtml: lyricLines.join(""),
    hoverInfoMap,
  };
}

export function renderHoverValidationLines(key: string, hoverInfoMap: Record<string, HoverInfo>): ValidationLine[] {
  const info = hoverInfoMap[key];
  if (!info) {
    return [{ title: "字音：" }, { title: "左侧：" }, { title: "右侧：" }];
  }
  const toneText = String(info.tone || 0);
  const noteText = (Array.isArray(info.notes) ? info.notes : []).join("-") || "无";
  const singleLine: ValidationLine =
    Number(info.singleValid) === 1
      ? { title: "字音：", status: "匹配", details: [] }
      : {
          title: "字音：",
          status: "不匹配",
          details: ["“" + toneText + "”音调与“" + noteText + "”旋律反方向"],
        };

  let leftLine: ValidationLine = { title: "左侧：", status: "匹配", details: [] };
  if (info.left && info.left.char) {
    const ab = String(info.left.tone || 0) + "、" + String(info.tone || 0);
    const leftMismatch = isDeviationFailed(info.left.deviations);
    leftLine = {
      title: "左侧：",
      status: leftMismatch ? "不匹配" : "匹配",
      details: [
        "“" + info.left.char + info.char + "” 声调：“" + ab + "”",
        "建议音程：" + formatSemitoneRange(info.left.range),
        "当前音程：" + formatActualIntervals(info.left.intervals, buildIntervalPairs(info.left.notes, info.notes)),
      ],
    };
  }

  let rightLine: ValidationLine = { title: "右侧：", status: "匹配", details: [] };
  if (info.right && info.right.char) {
    const ab = String(info.tone || 0) + "、" + String(info.right.tone || 0);
    const rightMismatch = isDeviationFailed(info.right.deviations);
    rightLine = {
      title: "右侧：",
      status: rightMismatch ? "不匹配" : "匹配",
      details: [
        "“" + info.char + info.right.char + "” 声调：“" + ab + "”",
        "建议音程：" + formatSemitoneRange(info.right.range),
        "当前音程：" + formatActualIntervals(info.right.intervals, buildIntervalPairs(info.notes, info.right.notes)),
      ],
    };
  }

  return [singleLine, leftLine, rightLine];
}

export function extractAnnotateResult(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return null;
  const inner = (payload as { data?: { result?: unknown } }).data;
  if (inner && typeof inner === "object" && "result" in inner) return inner.result;
  return null;
}

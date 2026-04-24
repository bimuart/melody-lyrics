/**
 * LyricsParser 对外方法说明（挂载在 window.LyricsParser / window.LyricParser）：
 * - parseLyricsTo3DArray(lyricsText)
 *   将歌词原文解析成三维数组：[句子][分词][字信息]，字信息结构为 [字, 拼音, 声调]。
 *   支持行内注音：连续汉字后可跟半角或全角括号内的拼音（数字调），如「长亭外(wai1)」「长(chang2)」；
 *   多字组后仅一组括号时，拼音只作用于该组最后一个汉字；其余汉字仍用 pinyin-pro 补全。
 * - formatMiddleLayer(parsed3D)
 *   将歌词三维数组转为中间层字符串数组（每句一行，分词用 "/" 连接）。
 * - parseMiddleLayerTo3DArray(middleText)
 *   将中间层文本（如 "你(ni3)好(hao3) / 世(shi4)界(jie4)"）解析回三维数组。
 */
(function attachLyricsParser(global) {
  "use strict";

  function parseLyricsTo3DArray(lyricsText) {
    const lineSeparator = /\r?\n/;
    const allHanRegex = /[\u4e00-\u9fa5]/;

    const lines = String(lyricsText || "")
      .split(lineSeparator)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const segments = splitLineByCommonDelimiters(line);
      if (segments.length === 0) return [];
      return segments.map((segment) => parseSegmentToItems(segment, allHanRegex));
    });
  }

  function splitLineByCommonDelimiters(line) {
    const text = String(line || "");
    const segments = [];
    let buf = "";
    // 仅用于“括号本身不分词”：在括号内忽略常见分隔符切分
    let parenDepth = 0; // () / （）
    let squareDepth = 0; // [] / 【】

    function flush() {
      const s = buf.trim();
      if (s) segments.push(s);
      buf = "";
    }

    const isDelimiter = (ch) =>
      /[\s\/／,，、。.!！？?；;：:·・\-—~～…]/.test(ch);

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "(" || ch === "（") {
        parenDepth += 1;
        buf += ch;
        continue;
      }
      if (ch === ")" || ch === "）") {
        parenDepth = Math.max(0, parenDepth - 1);
        buf += ch;
        continue;
      }
      if (ch === "[" || ch === "【") {
        squareDepth += 1;
        buf += ch;
        continue;
      }
      if (ch === "]" || ch === "】") {
        squareDepth = Math.max(0, squareDepth - 1);
        buf += ch;
        continue;
      }

      if (parenDepth === 0 && squareDepth === 0 && isDelimiter(ch)) {
        flush();
      } else {
        buf += ch;
      }
    }
    flush();
    return segments;
  }

  function parseSegmentToItems(segmentText, allHanRegex) {
    const text = String(segmentText || "");
    const items = [];
    const n = text.length;
    let i = 0;

    while (i < n) {
      const ch = text[i];
      if (!allHanRegex.test(ch)) {
        i += 1;
        continue;
      }

      const start = i;
      while (i < n && allHanRegex.test(text[i])) i += 1;
      const hanRun = text.slice(start, i);

      let explicit = null;
      if (i < n && (text[i] === "(" || text[i] === "（")) {
        const close = text[i] === "（" ? "）" : ")";
        i += 1;
        const innerStart = i;
        while (i < n && text[i] !== close) i += 1;
        explicit = text.slice(innerStart, i).trim();
        if (i < n && text[i] === close) i += 1;
      }

      const runItems = parseHanRunWithExplicitLast(hanRun, explicit, allHanRegex);
      items.push.apply(items, runItems);
    }

    return items;
  }

  function splitLineIntoHanRunsWithOptionalParens(line, allHanRegex) {
    const runs = [];
    const n = line.length;
    let i = 0;

    while (i < n) {
      const ch = line[i];
      if (!allHanRegex.test(ch)) {
        i += 1;
        continue;
      }
      const start = i;
      while (i < n && allHanRegex.test(line[i])) i += 1;
      const hanRun = line.slice(start, i);
      let explicit = null;
      if (i < n && (line[i] === "(" || line[i] === "（")) {
        const close = line[i] === "（" ? "）" : ")";
        i += 1;
        const innerStart = i;
        while (i < n && line[i] !== close) i += 1;
        explicit = line.slice(innerStart, i).trim();
        if (i < n && line[i] === close) i += 1;
      }
      runs.push({ hanRun, explicit });
    }
    return runs;
  }

  function parseExplicitPinyinToPair(token) {
    const t = String(token || "").trim().toLowerCase();
    if (!t) return null;
    const m = t.match(/^([a-zvü]+)([0-4])$/i);
    if (m) return [m[1], Number(m[2])];
    const m0 = t.match(/^([a-zvü]+)$/i);
    if (m0) return [m0[1], 0];
    return null;
  }

  function parseHanRunWithExplicitLast(hanRun, explicitForLast, allHanRegex) {
    const items = [];
    const chars = [];
    for (const ch of hanRun) {
      if (allHanRegex.test(ch)) chars.push(ch);
    }
    const lastIdx = chars.length - 1;
    for (let j = 0; j < chars.length; j += 1) {
      const ch = chars[j];
      const isLast = j === lastIdx;
      if (isLast && explicitForLast) {
        const pair = parseExplicitPinyinToPair(explicitForLast);
        if (pair) items.push([ch, pair[0], pair[1]]);
        else items.push([ch, ...getPinyinAndTone(ch)]);
      } else {
        const pair = getPinyinAndTone(ch);
        items.push([ch, pair[0], pair[1]]);
      }
    }
    return items;
  }

  function getPinyinAndTone(ch) {
    try {
      const pinyinApi =
        global.pinyinPro && typeof global.pinyinPro.pinyin === "function" ? global.pinyinPro.pinyin : null;
      if (!pinyinApi) return ["", 0];

      const pinyinNum = pinyinApi(ch, { toneType: "num" });
      if (!pinyinNum || typeof pinyinNum !== "string") return ["", 0];

      const normalized = pinyinNum.trim().toLowerCase();
      const match = normalized.match(/^([a-zvü]+)([0-4])$/i);
      if (!match) return [normalized, 0];
      return [match[1], Number(match[2])];
    } catch (err) {
      return ["", 0];
    }
  }

  function formatMiddleLayer(parsed3D) {
    return parsed3D.map((lineArr) =>
      lineArr
        .map((segmentArr) =>
          segmentArr
            .map((it) => {
              const py = it[1] || "";
              const tone = Number(it[2]) || 0;
              return py ? `${it[0]}(${py}${tone})` : `${it[0]}(?)`;
            })
            .join("")
        )
        .join(" / ")
    );
  }

  function parseMiddleLayerTo3DArray(middleText) {
    const linePrefixRegex = /^第\d+句:\s*/;
    const charToneRegex = /([\u4e00-\u9fa5])\(([^)]*)\)/g;
    const lines = String(middleText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const normalizedLine = line.replace(linePrefixRegex, "");
      const segments = normalizedLine
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      return segments.map((segment) => {
        const chars = [];
        let matched;
        while ((matched = charToneRegex.exec(segment)) !== null) {
          const token = (matched[2] || "").trim().toLowerCase();
          const m = token.match(/^([a-zvü]+)([0-4])$/i);
          if (m) chars.push([matched[1], m[1], Number(m[2])]);
          else chars.push([matched[1], "", 0]);
        }
        return chars;
      });
    });
  }

  const api = {
    parseLyricsTo3DArray,
    formatMiddleLayer,
    parseMiddleLayerTo3DArray,
  };

  global.LyricParser = api;
  global.LyricsParser = api;
  // Backward compatibility for existing pages
  global.parseLyricsTo3DArray = parseLyricsTo3DArray;
  global.formatMiddleLayer = formatMiddleLayer;
  global.parseMiddleLayerTo3DArray = parseMiddleLayerTo3DArray;
})(window);

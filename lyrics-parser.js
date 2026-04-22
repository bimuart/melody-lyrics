/**
 * 将歌词解析为三维数组：
 * 1) 最外层：按换行拆分为句子
 * 2) 次外层：按标点拆分为分词片段
 * 3) 最内层：每个字对应 [单字, 拼音, 声调]
 */
(function attachLyricsParser(global) {
  "use strict";

  function parseLyricsTo3DArray(lyricsText) {
    const lineSeparator = /\r?\n/;
    const nonHanRegex = /[^\u4e00-\u9fa5]/;
    const allHanRegex = /[\u4e00-\u9fa5]/;

    const lines = String(lyricsText || "")
      .split(lineSeparator)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      const segments = splitByNonHan(line, nonHanRegex);
      return segments.map((segment) => parseSegment(segment, allHanRegex));
    });
  }

  function splitByNonHan(text, nonHanRegex) {
    const result = [];
    let current = "";

    for (const ch of text) {
      if (nonHanRegex.test(ch)) {
        if (current.trim()) result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result;
  }

  function parseSegment(segment, allHanRegex) {
    const items = [];
    for (const ch of segment) {
      if (!allHanRegex.test(ch)) continue;
      const pair = getPinyinAndTone(ch);
      items.push([ch, pair[0], pair[1]]);
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

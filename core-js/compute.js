/**
 * Compute 对外方法说明（挂载在 window.Compute）：
 * - buildIntegratedWithSideMetrics(integrated3D):
 *   以“新整合数组”为基础，给每个字增加左右关系指标（即“单字音程数组”）：
 *   item[5] = [左侧音程数组, 左侧偏差数组]
 *   item[6] = [右侧音程数组, 右侧偏差数组]
 * - buildSingleCharIntervalArray(integrated3D):
 *   buildIntegratedWithSideMetrics 的语义化别名，返回“单字音程数组”。
 * - buildSingleCharIntervalArrayFromText(lyricsText, melodyText):
 *   顶层串联：文本 -> 歌词3D/音名3D -> 新整合数组 -> 单字音程数组。
 * - buildSingleCharIntervalArrayFromRenderText(lyricsRenderText, melodyRenderText):
 *   顶层串联：计算渲染文本 -> 歌词3D/音名3D -> 新整合数组 -> 单字音程数组。
 * - noteNameToMidi(noteName): 音名转 MIDI 编号（如 C4 -> 60）。
 * - calcSemitoneDiff([note1, note2]): 半音差值计算（note1 - note2）。
 * - calcIntervalDeviation(diff, prevTone, nextTone):
 *   根据声调组合区间判断偏差，区间内返回 0，超出返回到最近边界的距离。
 * - validateSingleChar(tone, melodyNotes):
 *   单字校验。音名<=1 直接通过；否则按“最后音-第一音”是否在该声调区间内返回 1/0。
 */
(function attachCompute(global) {
  "use strict";

  function noteNameToMidi(noteName) {
    const text = String(noteName || "").trim().toUpperCase();
    const matched = text.match(/^([A-G])(#|B)?(-?\d+)$/);
    if (!matched) return null;

    const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let semitone = baseMap[matched[1]];
    const accidental = matched[2] || "";
    if (accidental === "#") semitone += 1;
    if (accidental === "B") semitone -= 1;

    const midi = (Number(matched[3]) + 1) * 12 + semitone;
    if (midi < 0 || midi > 127) return null;
    return midi;
  }

  /**
   * 根据两个音名计算半音差值（音名1 - 音名2）
   * @param {[string, string]} notes 例如 ["E3", "D3"]
   * @returns {number}
   */
  function calcSemitoneDiff(notes) {
    if (!Array.isArray(notes) || notes.length !== 2) {
      throw new Error("入参必须是长度为2的数组，例如 [\"E3\",\"D3\"]");
    }

    const midi1 = noteNameToMidi(notes[0]);
    const midi2 = noteNameToMidi(notes[1]);
    if (midi1 === null || midi2 === null) {
      throw new Error("音名格式不合法，请使用例如 C4、F#3、Bb2");
    }

    return midi1 - midi2;
  }

  function firstNoteName(melodyArr) {
    if (!Array.isArray(melodyArr) || melodyArr.length === 0) return null;
    const note = String(melodyArr[0] || "").trim();
    return note.length > 0 ? note : null;
  }

  function getToneIntervalRange(prevTone, nextTone) {
    const cfg =
      global.IntervalConfig && global.IntervalConfig.TONE_INTERVAL_RANGES
        ? global.IntervalConfig.TONE_INTERVAL_RANGES
        : null;
    if (!cfg) return null;
    const key = String(Number(prevTone) || 0) + String(Number(nextTone) || 0);
    return Array.isArray(cfg[key]) && cfg[key].length === 2 ? cfg[key] : null;
  }

  /**
   * 判断音程差是否在配置区间内；在区间内返回 0，否则返回到最近边界的距离
   */
  function calcIntervalDeviation(diff, prevTone, nextTone) {
    const range = getToneIntervalRange(prevTone, nextTone);
    if (!range) return null;
    const a = Number(range[0]);
    const b = Number(range[1]);
    const low = Math.min(a, b);
    const high = Math.max(a, b);

    if (diff >= low && diff <= high) return 0;
    if (diff < low) return low - diff;
    return diff - high;
  }

  function calcAllIntervalDeviations(intervals, prevTone, nextTone) {
    const arr = Array.isArray(intervals) ? intervals : [];
    return arr.map((diff) => calcIntervalDeviation(diff, prevTone, nextTone));
  }

  function getSingleCharRange(tone) {
    const cfg =
      global.IntervalConfig && global.IntervalConfig.SINGLE_CHAR_INTERVAL_RANGES
        ? global.IntervalConfig.SINGLE_CHAR_INTERVAL_RANGES
        : null;
    if (!cfg) return null;
    const key = String(Number(tone) || 0);
    return Array.isArray(cfg[key]) && cfg[key].length === 2 ? cfg[key] : null;
  }

  /**
   * 单字校验：
   * - 音名数组长度 <= 1 直接通过（1）
   * - 否则计算 (最后一个音 - 第一个音) 是否落在该声调区间内
   * - 通过为 1，不通过为 0
   */
  function validateSingleChar(tone, melodyNotes) {
    const notes = Array.isArray(melodyNotes) ? melodyNotes.filter(Boolean) : [];
    if (notes.length <= 1) return 1;

    const range = getSingleCharRange(tone);
    if (!range) return 1;

    const first = notes[0];
    const last = notes[notes.length - 1];
    let diff;
    try {
      diff = calcSemitoneDiff([last, first]);
    } catch (err) {
      return 0;
    }

    const a = Number(range[0]);
    const b = Number(range[1]);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    return diff >= low && diff <= high ? 1 : 0;
  }

  function calcAllSemitoneDiffs(nextNotes, prevNotes) {
    const next = Array.isArray(nextNotes) ? nextNotes : [];
    const prev = Array.isArray(prevNotes) ? prevNotes : [];
    const diffs = [];

    next.forEach((n2) => {
      prev.forEach((n1) => {
        try {
          // 邻字方向：后一个音 - 前一个音
          diffs.push(calcSemitoneDiff([n2, n1]));
        } catch (err) {
          // ignore invalid note token
        }
      });
    });
    return diffs;
  }

  function cloneIntegrated3D(integrated3D) {
    const lines = Array.isArray(integrated3D) ? integrated3D : [];
    return lines.map((line) =>
      (Array.isArray(line) ? line : []).map((segment) =>
        (Array.isArray(segment) ? segment : []).map((item) => (Array.isArray(item) ? item.slice() : [item]))
      )
    );
  }

  function calcPairMetrics(currItem, nextItem) {
    const curr = Array.isArray(currItem) ? currItem : [];
    const next = Array.isArray(nextItem) ? nextItem : [];
    const currNotes = Array.isArray(curr[3]) ? curr[3] : [];
    const nextNotes = Array.isArray(next[3]) ? next[3] : [];
    const intervals = calcAllSemitoneDiffs(nextNotes, currNotes);
    const deviations = calcAllIntervalDeviations(intervals, curr[2], next[2]);
    return [intervals, deviations];
  }

  /**
   * 新结构：在“新整合数组”每个字项后追加左右关系指标
   * item 原结构：[字, 拼音, 声调, 音名数组, 单字校验]
   * item 新结构：[字, 拼音, 声调, 音名数组, 单字校验, [左侧音程数组, 左侧偏差数组], [右侧音程数组, 右侧偏差数组]]
   */
  function buildIntegratedWithSideMetrics(integrated3D) {
    const result = cloneIntegrated3D(integrated3D);

    result.forEach((line) => {
      line.forEach((segment) => {
        const seg = Array.isArray(segment) ? segment : [];
        for (let i = 0; i < seg.length; i += 1) {
          const curr = seg[i];

          let leftMetrics = [[], []];
          if (i > 0) {
            leftMetrics = calcPairMetrics(seg[i - 1], curr);
          }

          let rightMetrics = [[], []];
          if (i < seg.length - 1) {
            rightMetrics = calcPairMetrics(curr, seg[i + 1]);
          }

          curr[5] = [leftMetrics[0], leftMetrics[1]];
          curr[6] = [rightMetrics[0], rightMetrics[1]];
        }
      });
    });

    return result;
  }

  function buildSingleCharIntervalArray(integrated3D) {
    return buildIntegratedWithSideMetrics(integrated3D);
  }

  function buildSingleCharIntervalArrayFromText(lyricsText, melodyText) {
    if (!global.LyricsParser || typeof global.LyricsParser.parseLyricsTo3DArray !== "function") {
      throw new Error("LyricsParser.parseLyricsTo3DArray is not available.");
    }
    if (!global.MelodyParser || typeof global.MelodyParser.sentenceTextTo3DArray !== "function") {
      throw new Error("MelodyParser.sentenceTextTo3DArray is not available.");
    }
    if (!global.Integrator || typeof global.Integrator.integrateLyricsMelody3D !== "function") {
      throw new Error("Integrator.integrateLyricsMelody3D is not available.");
    }

    const lyrics3D = global.LyricsParser.parseLyricsTo3DArray(lyricsText);
    const melody3D = global.MelodyParser.sentenceTextTo3DArray(melodyText);
    const merged = global.Integrator.integrateLyricsMelody3D(lyrics3D, melody3D);
    if (!merged || !merged.ok) {
      throw new Error((merged && merged.message) || "Failed to integrate lyrics and melody.");
    }
    return buildSingleCharIntervalArray(merged.integrated);
  }

  /**
   * 顶层串联（从计算渲染文本出发）：
   * 1) parseMiddleLayerTo3DArray(lyricsRenderText)
   * 2) sentenceTextTo3DArray(melodyRenderText)
   * 3) integrateLyricsMelody3D(lyrics3D, melody3D)
   * 4) buildSingleCharIntervalArray(integrated3D)
   */
  function buildSingleCharIntervalArrayFromRenderText(lyricsRenderText, melodyRenderText) {
    if (!global.LyricsParser || typeof global.LyricsParser.parseMiddleLayerTo3DArray !== "function") {
      throw new Error("LyricsParser.parseMiddleLayerTo3DArray is not available.");
    }
    if (!global.MelodyParser || typeof global.MelodyParser.sentenceTextTo3DArray !== "function") {
      throw new Error("MelodyParser.sentenceTextTo3DArray is not available.");
    }
    if (!global.Integrator || typeof global.Integrator.integrateLyricsMelody3D !== "function") {
      throw new Error("Integrator.integrateLyricsMelody3D is not available.");
    }

    const lyrics3D = global.LyricsParser.parseMiddleLayerTo3DArray(lyricsRenderText);
    const melody3D = global.MelodyParser.sentenceTextTo3DArray(melodyRenderText);
    const merged = global.Integrator.integrateLyricsMelody3D(lyrics3D, melody3D);
    if (!merged || !merged.ok) {
      throw new Error((merged && merged.message) || "Failed to integrate lyrics and melody.");
    }
    return buildSingleCharIntervalArray(merged.integrated);
  }

  global.Compute = {
    noteNameToMidi,
    calcSemitoneDiff,
    calcIntervalDeviation,
    validateSingleChar,
    buildIntegratedWithSideMetrics,
    buildSingleCharIntervalArray,
    buildSingleCharIntervalArrayFromText,
    buildSingleCharIntervalArrayFromRenderText,
  };
})(window);

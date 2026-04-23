/**
 * Integrator 对外方法说明（挂载在 window.Integrator）：
 * - integrateLyricsMelody3D(lyrics3D, melody3D)
 *   按句与字位置将音名三维数组合并到歌词三维数组中，输出“新整合数组”。
 *   规则：
 *   1) 句数不一致时返回 ok=false 与错误信息；
 *   2) 句内音名更多时，超出部分并入该句最后一个字；
 *   3) 句内音名更少时，优先填充前面的字；
 *   4) 合并后每个字项结构为 [字, 拼音, 声调, 音名数组, 单字校验(1/0)]。
 */
(function attachIntegrator(global) {
  "use strict";

  function flattenLyricPointers(sentenceArr) {
    const pointers = [];
    sentenceArr.forEach((segment, segIdx) => {
      segment.forEach((item, itemIdx) => {
        pointers.push({ segIdx, itemIdx });
      });
    });
    return pointers;
  }

  function flattenMelodyGroups(sentenceArr) {
    const groups = [];
    sentenceArr.forEach((segment) => {
      segment.forEach((group) => {
        if (Array.isArray(group)) groups.push(group);
      });
    });
    return groups;
  }

  function cloneLyrics3D(lyrics3D) {
    return lyrics3D.map((sentence) =>
      sentence.map((segment) =>
        segment.map((item) => {
          const base = Array.isArray(item) ? item.slice(0, 3) : [String(item), "", 0];
          if (!Array.isArray(base[3])) base[3] = [];
          return [base[0], base[1], base[2], []];
        })
      )
    );
  }

  function cloneMelodyGroup(group) {
    return Array.isArray(group) ? group.slice() : [];
  }

  function integrateLyricsMelody3D(lyrics3D, melody3D) {
    const lyricSentences = Array.isArray(lyrics3D) ? lyrics3D : [];
    const melodySentences = Array.isArray(melody3D) ? melody3D : [];

    if (lyricSentences.length !== melodySentences.length) {
      return {
        ok: false,
        message: `句子数量不一致：歌词=${lyricSentences.length}，音名=${melodySentences.length}`,
        integrated: null,
      };
    }

    const integrated = cloneLyrics3D(lyricSentences);

    for (let s = 0; s < lyricSentences.length; s += 1) {
      const lyricPointers = flattenLyricPointers(lyricSentences[s]);
      const melodyGroups = flattenMelodyGroups(melodySentences[s]);

      if (lyricPointers.length === 0) continue;

      const minLen = Math.min(lyricPointers.length, melodyGroups.length);
      for (let i = 0; i < minLen; i += 1) {
        const ptr = lyricPointers[i];
        integrated[s][ptr.segIdx][ptr.itemIdx][3] = cloneMelodyGroup(melodyGroups[i]);
      }

      // Melody more than lyric: append all extras to last lyric element.
      if (melodyGroups.length > lyricPointers.length) {
        const lastPtr = lyricPointers[lyricPointers.length - 1];
        const target = integrated[s][lastPtr.segIdx][lastPtr.itemIdx][3];
        for (let i = lyricPointers.length; i < melodyGroups.length; i += 1) {
          const extra = cloneMelodyGroup(melodyGroups[i]);
          target.push.apply(target, extra);
        }
      }
      // Melody fewer than lyric: earlier lyrics already filled first.
    }

    // 单字校验：将结果写入每个字项的第 5 位（1/0）
    if (global.Compute && typeof global.Compute.validateSingleChar === "function") {
      integrated.forEach((line) => {
        line.forEach((segment) => {
          segment.forEach((item) => {
            const tone = Number(item[2]) || 0;
            const notes = Array.isArray(item[3]) ? item[3] : [];
            item[4] = global.Compute.validateSingleChar(tone, notes);
          });
        });
      });
    }

    return {
      ok: true,
      message: "整合成功",
      integrated,
    };
  }

  global.Integrator = {
    integrateLyricsMelody3D,
  };
})(window);

(function attachJson2Window(global) {
  "use strict";

  function normalize(singleCharInterval3D) {
    return Array.isArray(singleCharInterval3D) ? singleCharInterval3D : [];
  }

  function unitsFromSegment(segment) {
    const seg = Array.isArray(segment) ? segment : [];
    return seg.map((item) => {
      const it = Array.isArray(item) ? item : [];
      return {
        char: it[0] || "",
        py: it[1] || "",
        tone: Number(it[2]) || 0,
        notes: Array.isArray(it[3]) ? it[3].slice() : [],
      };
    });
  }

  // 方法1：单字音程数组 -> 歌词解析文本（分词间空格）
  function singleCharToParsedLyrics(singleCharInterval3D) {
    return normalize(singleCharInterval3D)
      .map((line) =>
        (Array.isArray(line) ? line : [])
          .map((segment) => unitsFromSegment(segment).map((u) => u.char).join(""))
          .filter(Boolean)
          .join(" ")
      )
      .join("\n");
  }

  // 方法2：单字音程数组 -> 旋律解析文本（分词间斜杠）
  function singleCharToParsedMelody(singleCharInterval3D) {
    return normalize(singleCharInterval3D)
      .map((line) =>
        (Array.isArray(line) ? line : [])
          .map((segment) =>
            unitsFromSegment(segment)
              .map((u) => u.notes.join("-"))
              .filter(Boolean)
              .join(" ")
          )
          .filter(Boolean)
          .join(" / ")
      )
      .join("\n");
  }

  // 方法3：单字音程数组 -> 歌词计算渲染文本（字+拼音+音调，分词间斜杠）
  function singleCharToRenderLyrics(singleCharInterval3D) {
    return normalize(singleCharInterval3D)
      .map((line) =>
        (Array.isArray(line) ? line : [])
          .map((segment) =>
            unitsFromSegment(segment)
              .map((u) => (u.py ? `${u.char}(${u.py}${u.tone})` : `${u.char}(?)`))
              .join("")
          )
          .filter(Boolean)
          .join(" / ")
      )
      .join("\n");
  }

  // 方法4：单字音程数组 -> 旋律计算渲染文本（带 "-" 与 "/"）
  function singleCharToRenderMelody(singleCharInterval3D) {
    return singleCharToParsedMelody(singleCharInterval3D);
  }

  global.Json2Window = {
    singleCharToParsedLyrics,
    singleCharToParsedMelody,
    singleCharToRenderLyrics,
    singleCharToRenderMelody,
  };
})(window);

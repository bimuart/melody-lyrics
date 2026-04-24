/**
 * IntervalConfig 对外配置说明（挂载在 window.IntervalConfig）：
 * - TONE_INTERVAL_RANGES:
 *   相邻两字音程区间配置，key 为“前字声调+后字声调”，value 为 [min, max]。
 * - DEVIATION_HIGHLIGHT:
 *   前端渲染偏差高亮配置（zero / lowMax / colors）。
 * - SINGLE_CHAR_INTERVAL_RANGES:
 *   单字校验区间配置，key 为声调，value 为 [min, max]，用于最后音-第一音校验。
 * - SINGLE_CHAR_UNDERLINE_COLOR:
 *   单字校验不通过时的下划线颜色。
 */
(function attachIntervalConfig(global) {
  "use strict";

  /**
   * 键格式：前字声调 + 后字声调（例如 "23"）
   * 值格式：[最小音程, 最大音程]
   */
  const TONE_INTERVAL_RANGES = {
    "00": [-30, 30],
    "01": [-30, 30],
    "02": [-30, 30],
    "03": [-30, 30],
    "04": [-30, 30],
    "10": [-30, 30],
    "11": [-2, 2],
    "12": [-7, 0],
    "13": [-30, -2],
    "14": [-2, 8],
    "20": [-30, 2],
    "21": [-3, 8],
    "22": [-2, 2],
    "23": [-30, 2],
    "24": [0, 8],
    "30": [0, 30],
    "31": [1, 30],
    "32": [2, 30],
    "33": [-30, 2],
    "34": [2, 30],
    "40": [0, -30],
    "41": [-8, 1],
    "42": [-8, -1],
    "43": [-30, -2],
    "44": [-30, 30]
  };

  /**
   * demo 页面高亮阈值配置
   * - zero: 0 偏差
   * - lowMax: 1~lowMax 为轻微偏差
   */
  const DEVIATION_HIGHLIGHT = {
    zero: 0,
    lowMax: 2,
    colors: {
      zero: "#8fd19e",
      low: "#ffc0cb",
      high: "#ff6b6b",
    },
  };

  /**
   * 单字校验配置：
   * key: 声调，value: [最小音程, 最大音程]
   * 音程定义：最后一个音 - 第一个音
   */
  const SINGLE_CHAR_INTERVAL_RANGES = {
    "2": [0, 30],
    "4": [0, -30],
  };

  const SINGLE_CHAR_UNDERLINE_COLOR = "#5b21b6";

  global.IntervalConfig = {
    TONE_INTERVAL_RANGES,
    DEVIATION_HIGHLIGHT,
    SINGLE_CHAR_INTERVAL_RANGES,
    SINGLE_CHAR_UNDERLINE_COLOR,
  };
})(window);

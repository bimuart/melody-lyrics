export {};

declare global {
  interface Window {
    Midi?: unknown;
    pinyinPro?: { pinyin: (ch: string, opts?: { toneType?: string }) => string };
    LyricsParser?: Record<string, unknown>;
    LyricParser?: Record<string, unknown>;
    MelodyParser?: Record<string, unknown>;
    Integrator?: Record<string, unknown>;
    IntervalConfig?: {
      DEVIATION_HIGHLIGHT?: { lowMax?: number; colors: { low: string; high: string; zero: string } };
      SINGLE_CHAR_UNDERLINE_COLOR?: string;
      TONE_INTERVAL_RANGES?: Record<string, number[]>;
    };
    Compute?: {
      buildSingleCharIntervalArrayFromText: (lyrics: string, melody: string) => unknown[][];
      buildSingleCharIntervalArrayFromRenderText: (lyrics: string, melody: string) => unknown[][];
    };
    Json2Window?: {
      singleCharToRenderLyrics: (arr: unknown[][]) => string;
      singleCharToRenderMelody: (arr: unknown[][]) => string;
      singleCharToParsedLyrics: (arr: unknown[][]) => string;
      singleCharToParsedMelody: (arr: unknown[][]) => string;
    };
    MidiParser?: {
      parseMidiArrayBuffer: (buf: ArrayBuffer) => unknown;
      flattenNotes: (m: unknown) => unknown[];
      getTimingInfo: (m: unknown) => { bpm: number; beatsPerBar: number; numerator: number; denominator: number };
      notesToSentenceText: (notes: unknown[], o: Record<string, unknown>) => string;
    };
  }
}

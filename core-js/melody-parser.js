/* global Tone */
/**
 * MelodyParser 对外方法说明（挂载在 window.MelodyParser / window.MidiParser）：
 * - sentenceTextTo3DArray(text): 将音名文本解析为三维数组。
 * - parseMidiArrayBuffer(arrayBuffer): 解析 MIDI 二进制为结构化对象。
 * - flattenNotes(parsed): 将多轨音符展平并按时间排序。
 * - getTimingInfo(parsed): 提取 bpm、拍号与每小节拍数。
 * - notesToSentenceText(notes, options): 按小节与偏移将音名按句输出为文本。
 * - sentenceTextToNotes(text, templateNotes): 将音名句子文本反解为音符对象（保留模板时值）。
 * - buildMidiFromNotes(noteRows, options): 从音符对象构建可导出 MIDI。
 * - playNotes(noteRows) / stopPlayback(): 浏览器内播放与停止。
 * - midiToNoteName(midi) / noteNameToMidi(name): MIDI 编号与音名互转。
 */
(function attachMelodyParser(global) {
  "use strict";

  function getMidiClass() {
    if (global.Midi && global.Midi.Midi) return global.Midi.Midi;
    if (typeof global.Midi === "function") return global.Midi;
    throw new Error("Midi library not found. Please load @tonejs/midi first.");
  }

  function midiToNoteName(midi) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const pc = ((midi % 12) + 12) % 12;
    const oct = Math.floor(midi / 12) - 1;
    return names[pc] + String(oct);
  }

  function noteNameToMidi(name) {
    const text = String(name || "").trim().toUpperCase();
    const matched = text.match(/^([A-G])(#|B)?(-?\d+)$/);
    if (!matched) return null;
    const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let semitone = baseMap[matched[1]];
    if ((matched[2] || "") === "#") semitone += 1;
    if ((matched[2] || "") === "B") semitone -= 1;
    const midi = (Number(matched[3]) + 1) * 12 + semitone;
    if (midi < 0 || midi > 127) return null;
    return midi;
  }

  function parseMidiArrayBuffer(arrayBuffer) {
    const MidiClass = getMidiClass();
    const midi = new MidiClass(arrayBuffer);
    const tracks = midi.tracks.map((track, trackIndex) => ({
      trackIndex,
      name: track.name || `Track ${trackIndex + 1}`,
      notes: track.notes.map((n) => ({
        trackIndex,
        time: Number(n.time.toFixed(6)),
        duration: Number(n.duration.toFixed(6)),
        midi: n.midi,
        noteName: midiToNoteName(n.midi),
        velocity: Number((n.velocity || 0).toFixed(4)),
      })),
    }));
    return {
      sourceMidi: midi,
      header: {
        name: midi.header.name || "",
        ppq: midi.header.ppq || 480,
        tempos: (midi.header.tempos || []).map((t) => ({ bpm: t.bpm, ticks: t.ticks })),
      },
      tracks,
    };
  }

  function flattenNotes(parsed) {
    const rows = [];
    parsed.tracks.forEach((track) => track.notes.forEach((note) => rows.push(note)));
    rows.sort((a, b) => a.time - b.time || a.trackIndex - b.trackIndex);
    return rows;
  }

  function getTimingInfo(parsed) {
    const tempos = (parsed && parsed.header && parsed.header.tempos) || [];
    const bpm = tempos.length > 0 && tempos[0].bpm ? Number(tempos[0].bpm) : 120;
    const signatures =
      parsed && parsed.sourceMidi && parsed.sourceMidi.header && parsed.sourceMidi.header.timeSignatures
        ? parsed.sourceMidi.header.timeSignatures
        : [];
    const sig = signatures.length > 0 && signatures[0].timeSignature ? signatures[0].timeSignature : [4, 4];
    const numerator = Number(sig[0]) || 4;
    const denominator = Number(sig[1]) || 4;
    const beatsPerBar = numerator * (4 / denominator);
    return { bpm, numerator, denominator, beatsPerBar };
  }

  function noteToBeat(note, bpm) {
    return (note.time * bpm) / 60;
  }

  function notesToSentenceText(notes, options) {
    const bpm = options && options.bpm ? Number(options.bpm) : 120;
    const beatsPerBar = options && options.beatsPerBar ? Number(options.beatsPerBar) : 4;
    const barsPerSentence = options && options.barsPerSentence ? Number(options.barsPerSentence) : 1;
    const sentenceBeatLen = beatsPerBar * barsPerSentence;
    const offsetFraction = options && options.offsetFraction !== undefined ? Number(options.offsetFraction) : 0;
    const offsetBeats = beatsPerBar * offsetFraction;

    const lines = [];
    notes.forEach((n) => {
      const beat = noteToBeat(n, bpm);
      const delta = beat - offsetBeats;
      const sentenceIndex = delta >= 0 ? Math.floor(delta / sentenceBeatLen) : 0;
      while (lines.length <= sentenceIndex) lines.push([]);
      lines[sentenceIndex].push(n.noteName);
    });
    return lines.map((arr) => arr.join(" ")).join("\n");
  }

  function extractNoteTokens(text) {
    const tokenRegex = /[A-Ga-g](?:#|b)?-?\d+/g;
    const tokens = [];
    let matched;
    while ((matched = tokenRegex.exec(String(text || ""))) !== null) tokens.push(matched[0]);
    return tokens;
  }

  function sentenceTextToNotes(text, templateNotes) {
    const rows = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const tokens = extractNoteTokens(rows.join(" "));
    const errors = [];
    if (!Array.isArray(templateNotes) || templateNotes.length === 0) {
      errors.push("No template notes found. Parse a MIDI file first.");
      return { notes: [], errors };
    }
    if (tokens.length !== templateNotes.length) {
      errors.push(`Note count mismatch: editor=${tokens.length}, original=${templateNotes.length}`);
      return { notes: [], errors };
    }

    const notes = templateNotes.map((src, idx) => {
      const midi = noteNameToMidi(tokens[idx]);
      if (midi === null) {
        errors.push(`Token ${idx + 1}: invalid note name "${tokens[idx]}"`);
        return null;
      }
      return {
        trackIndex: src.trackIndex,
        time: src.time,
        duration: src.duration,
        velocity: src.velocity,
        midi,
        noteName: midiToNoteName(midi),
      };
    });
    return { notes: notes.filter(Boolean), errors };
  }

  function sentenceTextTo3DArray(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const punctuationRegex = /[，。！？；：、,.!?;:"'“”‘’（）()《》【】\[\]{}<>/\\|]+/;

    function groupSegmentNotes(segment) {
      const tokenRegex = /[A-Ga-g](?:#|b)?-?\d+/g;
      const located = [];
      let m;
      while ((m = tokenRegex.exec(segment)) !== null) {
        located.push({ raw: m[0], start: m.index, end: m.index + m[0].length });
      }
      const groups = [];
      located.forEach((item, idx) => {
        const midi = noteNameToMidi(item.raw);
        const normalized = midi === null ? item.raw : midiToNoteName(midi);
        if (idx === 0) {
          groups.push([normalized]);
          return;
        }
        const prev = located[idx - 1];
        const bridge = segment.slice(prev.end, item.start);
        const compact = bridge.replace(/\s+/g, "");
        const sameInner = bridge === "" || compact === "-" || compact === "_";
        if (sameInner) groups[groups.length - 1].push(normalized);
        else groups.push([normalized]);
      });
      return groups;
    }

    return lines.map((line) =>
      line
        .split(punctuationRegex)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((segment) => groupSegmentNotes(segment))
    );
  }

  function buildMidiFromNotes(noteRows, options) {
    const MidiClass = getMidiClass();
    const midi = new MidiClass();
    const bpm = options && options.bpm ? Number(options.bpm) : 120;
    midi.header.setTempo(bpm);
    const trackMap = new Map();
    noteRows.forEach((row) => {
      if (!trackMap.has(row.trackIndex)) trackMap.set(row.trackIndex, midi.addTrack());
      trackMap.get(row.trackIndex).addNote({
        midi: row.midi,
        time: row.time,
        duration: row.duration,
        velocity: row.velocity,
      });
    });
    return midi;
  }

  async function playNotes(noteRows) {
    if (!global.Tone) throw new Error("Tone.js not found.");
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    noteRows.forEach((n) => {
      Tone.Transport.schedule((t) => {
        synth.triggerAttackRelease(midiToNoteName(n.midi), n.duration, t, n.velocity);
      }, n.time);
    });
    Tone.Transport.start("+0.05");
    return synth;
  }

  function stopPlayback() {
    if (!global.Tone) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }

  const api = {
    parseMidiArrayBuffer,
    flattenNotes,
    getTimingInfo,
    notesToSentenceText,
    sentenceTextToNotes,
    sentenceTextTo3DArray,
    buildMidiFromNotes,
    playNotes,
    stopPlayback,
    midiToNoteName,
    noteNameToMidi,
  };

  global.MelodyParser = api;
  // Backward compatibility for existing pages
  global.MidiParser = api;
})(window);

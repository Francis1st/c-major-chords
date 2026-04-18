import { EDITOR_MIDI_MIN, EDITOR_MIDI_MAX } from "./constants.js";

export const CUSTOM_LS_KEY = "c-major-chords-custom-v1";

export function loadCustomChordsFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.name === "string" && Array.isArray(x.midis) && x.midis.length >= 3)
      .map((x, i) => ({
        id: String(x.id || `cid-${i}`),
        name: String(x.name).trim().slice(0, 16),
        midis: [...new Set(x.midis.map(Number))]
          .filter((n) => n >= EDITOR_MIDI_MIN && n <= EDITOR_MIDI_MAX)
          .sort((a, b) => a - b),
      }))
      .filter((x) => x.midis.length >= 3);
  } catch (_) {
    return [];
  }
}

export function persistCustomChords(list) {
  try {
    localStorage.setItem(CUSTOM_LS_KEY, JSON.stringify(list));
  } catch (_) {}
}

/** 音高、大调表、就近三和弦排声（与 UI / 音频采样解耦） */

export function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteLabel(m) {
  return NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
}

export const ROMAN = [
  "I — 大三",
  "ii — 小三",
  "iii — 小三",
  "IV — 大三",
  "V — 大三",
  "vi — 小三",
  "vii° — 减三",
];

/** 十二个大调：主音 MIDI（中央 C 附近）与顺阶三和弦标记 */
export const MAJOR_KEYS = [
  { id: "C", tonicMidi: 60, labels: ["C", "Dm", "Em", "F", "G", "Am", "B°"] },
  { id: "Db", tonicMidi: 61, labels: ["Db", "Ebm", "Fm", "Gb", "Ab", "Bbm", "C°"] },
  { id: "D", tonicMidi: 62, labels: ["D", "Em", "F#m", "G", "A", "Bm", "C#°"] },
  { id: "Eb", tonicMidi: 63, labels: ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "D°"] },
  { id: "E", tonicMidi: 64, labels: ["E", "F#m", "G#m", "A", "B", "C#m", "D#°"] },
  { id: "F", tonicMidi: 65, labels: ["F", "Gm", "Am", "Bb", "C", "Dm", "E°"] },
  { id: "F#", tonicMidi: 66, labels: ["F#", "G#m", "A#m", "B", "C#", "D#m", "E#°"] },
  { id: "G", tonicMidi: 67, labels: ["G", "Am", "Bm", "C", "D", "Em", "F#°"] },
  { id: "Ab", tonicMidi: 68, labels: ["Ab", "Bbm", "Cm", "Db", "Eb", "Fm", "G°"] },
  { id: "A", tonicMidi: 69, labels: ["A", "Bm", "C#m", "D", "E", "F#m", "G#°"] },
  { id: "Bb", tonicMidi: 70, labels: ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "A°"] },
  { id: "B", tonicMidi: 71, labels: ["B", "C#m", "D#m", "E", "F#", "G#m", "A#°"] },
];

/**
 * C 大调「就近」固定排声（小字组～小字一组一带，和弦之间少跳、好弹）：
 * C4E4G4、A3D4F4、B3E4G4、A3C4F4、B3D4G4、A3C4E4、B3D4F4（I … vii°）。
 * 其它调：先按主音做半音平移（与 C 模板同一声部间距），再整体移八度，
 * 使三音重心靠近中央 C（MIDI 60 / C4），并限制在合理音区，避免整表移调后过高或过低。
 */
export const VOICING_C_TEMPLATE = [
  [60, 64, 67],
  [57, 62, 65],
  [59, 64, 67],
  [57, 60, 65],
  [59, 62, 67],
  [57, 60, 64],
  [59, 62, 65],
];

export const VOICING_REF_MIDI = 60;
export const VOICING_LO_CAP = 48;
export const VOICING_HI_CAP = 84;

/** 保持声部顺序，仅整体 ±八度，使和弦落在 C4 附近且不越界 */
export function shiftTriadNearRef(transposedTriad, refMidi) {
  const a = transposedTriad[0];
  const b = transposedTriad[1];
  const c = transposedTriad[2];
  const sum = a + b + c;
  let k = Math.round((refMidi * 3 - sum) / 36);
  const apply = (kk) => [a, b, c].map((n) => n + 12 * kk);
  let out = apply(k);
  for (let guard = 0; guard < 14; guard++) {
    const lo = Math.min(out[0], out[1], out[2]);
    const hi = Math.max(out[0], out[1], out[2]);
    if (lo >= VOICING_LO_CAP && hi <= VOICING_HI_CAP) break;
    if (lo < VOICING_LO_CAP) k++;
    else if (hi > VOICING_HI_CAP) k--;
    else break;
    out = apply(k);
  }
  return out;
}

export function voicedTriadsForKey(tonicMidi) {
  const d = tonicMidi - 60;
  return VOICING_C_TEMPLATE.map((ch) => {
    const trans = ch.map((n) => n + d);
    return shiftTriadNearRef(trans, VOICING_REF_MIDI);
  });
}

export function findMajorKeyById(id) {
  return MAJOR_KEYS.find((k) => k.id === id) || MAJOR_KEYS[0];
}

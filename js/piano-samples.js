/** Salamander（tambien/Piano）：每小三度一轨，文件名 A / C / Ds / Fs + 八度 + v力度 */

const PIANO_BASE = "https://cdn.jsdelivr.net/gh/tambien/Piano@master/audio/";
const PIANO_VELOCITY = 5;

const pianoBufferCache = new Map();
const pianoLoadPromises = new Map();

export function nearestPianoSampleMidi(midi) {
  const k = Math.round((midi - 21) / 3);
  const clamped = Math.max(0, Math.min(29, k));
  return 21 + 3 * clamped;
}

export function pianoSampleFilename(baseMidi) {
  const pc = baseMidi % 12;
  const oct = Math.floor(baseMidi / 12) - 1;
  const stem = { 0: "C", 3: "Ds", 6: "Fs", 9: "A" }[pc];
  return `${stem}${oct}v${PIANO_VELOCITY}.mp3`;
}

export function getPianoBuffer(baseMidi) {
  return pianoBufferCache.get(baseMidi);
}

export function loadPianoBuffer(ctx, baseMidi) {
  if (pianoBufferCache.has(baseMidi)) {
    return Promise.resolve(pianoBufferCache.get(baseMidi));
  }
  if (pianoLoadPromises.has(baseMidi)) {
    return pianoLoadPromises.get(baseMidi);
  }
  const url = PIANO_BASE + pianoSampleFilename(baseMidi);
  const p = fetch(url, {
    mode: "cors",
    cache: "force-cache",
    priority: "high",
  })
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.arrayBuffer();
    })
    .then((ab) => ctx.decodeAudioData(ab.slice(0)))
    .then((buf) => {
      pianoBufferCache.set(baseMidi, buf);
      pianoLoadPromises.delete(baseMidi);
      return buf;
    })
    .catch((err) => {
      pianoLoadPromises.delete(baseMidi);
      throw err;
    });
  pianoLoadPromises.set(baseMidi, p);
  return p;
}

export function chordSampleBases(midiNotes) {
  return [...new Set(midiNotes.map(nearestPianoSampleMidi))];
}

/** 并行拉取并解码上述 MIDI 所需的全部采样轨 */
export function preloadPianoBasesForMidis(ctx, midis) {
  const bases = chordSampleBases(midis);
  if (bases.length === 0) return Promise.resolve();
  return Promise.all(bases.map((b) => loadPianoBuffer(ctx, b)));
}

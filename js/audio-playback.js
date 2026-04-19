import { midiToHz, voicedTriadsForKey, diatonicChordRootMidi } from "./music-theory.js";
import {
  loadPianoBuffer,
  nearestPianoSampleMidi,
  getPianoBuffer,
  preloadPianoBasesForMidis,
} from "./piano-samples.js";
import { CHORD_TAP_DURATION_SEC } from "./constants.js";

/** 钢琴输出总增益（易偏小，与合成器分开调） */
export const PIANO_LEVEL = 1.48;
export const SYNTH_LEVEL = 1.28;

let audioCtx = null;

export function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/** iOS 等：须 await resume 后再调度节点，否则易偶发无声 */
export function whenContextReady(ctx) {
  if (!ctx || ctx.state === "closed" || ctx.state === "running") return Promise.resolve();
  return ctx.resume().catch(() => {});
}

/** 顺阶三和弦 + 各级根音低八度叠奏可能用到的轨，减少首点等待 */
export function preloadPianoForTonic(tonicMidi) {
  const ctx = getCtx();
  const midis = voicedTriadsForKey(tonicMidi).flat();
  for (let i = 0; i < 7; i++) {
    const r = diatonicChordRootMidi(tonicMidi, i);
    midis.push(r - 24, r - 12);
  }
  return preloadPianoBasesForMidis(ctx, midis).catch(() => {});
}

function whenReadyAndSamples(ctx, midiNotes) {
  return Promise.all([whenContextReady(ctx), preloadPianoBasesForMidis(ctx, midiNotes)]);
}

function playbackRateSemi(midi, baseMidi) {
  return Math.pow(2, (midi - baseMidi) / 12);
}

/** 单声部：采样轨 + 播放速率（无 buffer 时返回 null） */
function createPianoSource(ctx, midi) {
  const base = nearestPianoSampleMidi(midi);
  const buf = getPianoBuffer(base);
  if (!buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = playbackRateSemi(midi, base);
  return { src, buf };
}

function disconnectGainLater(master, ms) {
  setTimeout(() => {
    try {
      master.disconnect();
    } catch (_) {}
  }, ms);
}

function fadeMasterOut(master, ctx, fadeSec) {
  const t = ctx.currentTime;
  try {
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(1e-4, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.001, t + fadeSec);
  } catch (_) {}
}

export function playChordSynth(midiNotes, opts = {}) {
  const durationSec = opts.durationSec ?? 1.35;
  const destination = opts.destination;
  const gainScale = opts.gainScale ?? 1;
  const ctx = getCtx();
  whenContextReady(ctx).then(() => {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(destination || ctx.destination);

    const now = ctx.currentTime + 0.002;
    const attack = 0.018;
    const peak = 0.22 * gainScale * SYNTH_LEVEL;

    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(peak, now + attack);
    master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    midiNotes.forEach((midi, i) => {
      const detuneCents = (i - 1) * 3;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midiToHz(midi);
      osc.detune.value = detuneCents;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.42 * gainScale * SYNTH_LEVEL;

      osc.connect(voiceGain);
      voiceGain.connect(master);
      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    });

    disconnectGainLater(master, (durationSec + 0.2) * 1000);
  });
}

/** 钢琴键点选试听：与和弦短按同一套增益（首声部 0.62 系数），单音时长默认同短按 */
export function playPianoKeyPreview(midi, opts = {}) {
  const durationSec = opts.durationSec ?? CHORD_TAP_DURATION_SEC;
  const gainScale = opts.gainScale ?? 1;
  const ctx = getCtx();
  const destination = opts.destination || ctx.destination;
  const synthFallback = () =>
    playChordSynth([midi], {
      durationSec,
      destination,
      gainScale,
    });

  whenReadyAndSamples(ctx, [midi])
    .then(() => {
      const ps = createPianoSource(ctx, midi);
      if (!ps) {
        synthFallback();
        return;
      }
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(destination);
      const now = ctx.currentTime + 0.003;
      const attack = 0.008;
      const peak = 0.62 * gainScale * PIANO_LEVEL;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(peak, now + attack);
      master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
      const { src, buf } = ps;
      const vg = ctx.createGain();
      /* 与 playChord 第一声部 (i=0) 一致：0.62 - i * 0.045 */
      vg.gain.value = 0.62 * gainScale * PIANO_LEVEL;
      src.connect(vg);
      vg.connect(master);
      const bufSec = buf.duration / src.playbackRate.value;
      src.start(now);
      src.stop(now + Math.min(bufSec, durationSec + 0.25));
      disconnectGainLater(master, (durationSec + 0.45) * 1000);
    })
    .catch(synthFallback);
}

export function playChord(midiNotes, opts = {}) {
  const durationSec = opts.durationSec ?? 2.45;
  const destination = opts.destination;
  const gainScale = opts.gainScale ?? 1;
  const ctx = getCtx();
  const synthFallback = () =>
    playChordSynth(midiNotes, { durationSec, destination, gainScale });

  whenReadyAndSamples(ctx, midiNotes)
    .then(() => {
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(destination || ctx.destination);

      const now = ctx.currentTime + 0.003;
      const attack = 0.008;
      const peak = 0.62 * gainScale * PIANO_LEVEL;

      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(peak, now + attack);
      master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      let started = 0;
      midiNotes.forEach((midi, i) => {
        const ps = createPianoSource(ctx, midi);
        if (!ps) return;
        const { src, buf } = ps;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = (0.62 - i * 0.045) * gainScale * PIANO_LEVEL;
        src.connect(voiceGain);
        voiceGain.connect(master);
        const bufSec = buf.duration / src.playbackRate.value;
        const stopAt = now + Math.min(bufSec, durationSec + 0.25);
        src.start(now);
        src.stop(stopAt);
        started += 1;
      });

      if (started === 0) {
        try {
          master.disconnect();
        } catch (_) {}
        synthFallback();
        return;
      }

      disconnectGainLater(master, (durationSec + 0.45) * 1000);
    })
    .catch(synthFallback);
}

export function playChordSynthHold(midiNotes, opts = {}) {
  const ctx = getCtx();
  const destination = opts.destination || ctx.destination;
  const gainScale = opts.gainScale ?? 1;
  return whenContextReady(ctx).then(() => {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(destination);
    const now = ctx.currentTime + 0.004;
    master.gain.linearRampToValueAtTime(0.17 * gainScale * SYNTH_LEVEL, now + 0.014);
    const oscs = [];
    midiNotes.forEach((midi) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = midiToHz(midi);
      const g = ctx.createGain();
      g.gain.value = 0.38 * gainScale * SYNTH_LEVEL;
      o.connect(g);
      g.connect(master);
      o.start(now);
      oscs.push(o);
    });
    return {
      stop() {
        const t = ctx.currentTime;
        fadeMasterOut(master, ctx, 0.12);
        oscs.forEach((o) => {
          try {
            o.stop(t + 0.14);
          } catch (_) {}
        });
        disconnectGainLater(master, 220);
      },
    };
  });
}

/** 长按：每声部单轨 loop，无叠奏；松手调用 stop() */
export function playChordHold(midiNotes, opts = {}) {
  const ctx = getCtx();
  const destination = opts.destination || ctx.destination;
  const gainScale = opts.gainScale ?? 1;
  const synthHoldFallback = () => playChordSynthHold(midiNotes, opts);

  return whenReadyAndSamples(ctx, midiNotes)
    .then(() => {
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(destination);
      const now = ctx.currentTime + 0.002;
      const peak = 0.55 * gainScale * PIANO_LEVEL;
      /* 长按要「跟手」起声，包络比短按更陡，避免像慢半拍 */
      master.gain.linearRampToValueAtTime(peak, now + 0.006);
      const sources = [];
      midiNotes.forEach((midi, i) => {
        const ps = createPianoSource(ctx, midi);
        if (!ps) return;
        const { src, buf } = ps;
        const bufLen = buf.duration;
        if (bufLen > 0.55) {
          src.loop = true;
          src.loopStart = Math.min(bufLen * 0.28, bufLen * 0.38);
          src.loopEnd = Math.max(bufLen * 0.84, src.loopStart + 0.1);
          if (src.loopEnd - src.loopStart < 0.09) {
            src.loop = false;
          }
        }
        const vg = ctx.createGain();
        vg.gain.value = (0.56 - i * 0.04) * gainScale * PIANO_LEVEL;
        src.connect(vg);
        vg.connect(master);
        src.start(now);
        sources.push(src);
      });
      if (sources.length === 0) {
        try {
          master.disconnect();
        } catch (_) {}
        return synthHoldFallback();
      }
      return {
        stop() {
          const t = ctx.currentTime;
          fadeMasterOut(master, ctx, 0.13);
          sources.forEach((s) => {
            try {
              s.stop(t + 0.16);
            } catch (_) {}
          });
          disconnectGainLater(master, 280);
        },
      };
    })
    .catch(synthHoldFallback);
}

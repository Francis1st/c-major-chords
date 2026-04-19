import {
  ROMAN,
  ROMAN_DEGREE_LABELS,
  romanChordKind,
  MAJOR_KEYS,
  voicedTriadsForKey,
  diatonicChordRootMidi,
  findMajorKeyById,
  midiToNoteLabel,
} from "./music-theory.js";
import { preloadPianoBasesForMidis } from "./piano-samples.js";
import {
  getCtx,
  whenContextReady,
  preloadPianoForTonic,
  playChord,
  playChordHold,
  playPianoKeyPreview,
} from "./audio-playback.js";
import { buildPianoRow, syncPianoPickUi } from "./piano-keyboard.js";
import { NOTATION_LS_KEY, ROOT_BOOST_LS_KEY } from "./constants.js";
import { loadCustomChordsFromStorage, persistCustomChords } from "./custom-chords.js";
import { createChordPointerBinder } from "./chord-pointer.js";

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

const CHORD_ACCENTS = [
  { stripe: "#e05252", glow: "rgba(224, 82, 82, 0.55)" },
  { stripe: "#e1883d", glow: "rgba(225, 136, 61, 0.5)" },
  { stripe: "#c9a43a", glow: "rgba(201, 164, 58, 0.48)" },
  { stripe: "#4fb884", glow: "rgba(79, 184, 132, 0.48)" },
  { stripe: "#45a8c9", glow: "rgba(69, 168, 201, 0.5)" },
  { stripe: "#6b8ae8", glow: "rgba(107, 138, 232, 0.52)" },
  { stripe: "#9b72d4", glow: "rgba(155, 114, 212, 0.52)" },
];

function formatRomanLineHtml(romanEntry) {
  const rom = romanEntry.split(/\s*[—–-]\s*/);
  if (rom.length >= 2) {
    return `<span class="roman-h">${escHtml(rom[0])}</span> · ${escHtml(rom[1])}`;
  }
  return escHtml(romanEntry);
}

function paintChordKey(btn, stripeIndex, animIndex) {
  const col = CHORD_ACCENTS[stripeIndex % CHORD_ACCENTS.length];
  btn.style.setProperty("--i", String(animIndex));
  btn.style.setProperty("--stripe", col.stripe);
  btn.style.setProperty("--stripe-glow", col.glow);
}

const grid = document.getElementById("grid");
const keySelect = document.getElementById("keySelect");
const notationSelect = document.getElementById("notationSelect");
const rootBoost = document.getElementById("rootBoost");
const keyTitle = document.getElementById("keyTitle");
const viewHome = document.getElementById("viewHome");
const viewCustom = document.getElementById("viewCustom");
const btnAddChord = document.getElementById("btnAddChord");
const customGrid = document.getElementById("customGrid");
const btnCustomBack = document.getElementById("btnCustomBack");
const pianoRow = document.getElementById("pianoRow");
const customNameInput = document.getElementById("customNameInput");
const btnSaveCustom = document.getElementById("btnSaveCustom");
const customSaveErr = document.getElementById("customSaveErr");

let customChords = loadCustomChordsFromStorage();
const editorSelectedMidis = new Set();

function selectedKey() {
  return findMajorKeyById(keySelect.value);
}

function stripChordPointerOpts(opts) {
  if (!opts?.chordRootMidi) return opts || {};
  const rest = { ...opts };
  delete rest.chordRootMidi;
  return rest;
}

/** 根音开启时：根音低两个八度 + 原和弦 MIDI，去重、低音在前 */
function chordPlaybackMidis(triadMidis, chordRootMidi) {
  if (!rootBoost.checked) return triadMidis;
  const t = chordRootMidi ?? Math.min(...triadMidis);
  return [...new Set([t - 24, t - 12, ...triadMidis])];
}

function warmupChordSamples(midiNotes, chordRootMidi) {
  const midis = chordPlaybackMidis(midiNotes, chordRootMidi);
  const ctx = getCtx();
  void whenContextReady(ctx);
  void preloadPianoBasesForMidis(ctx, midis);
}

const withRootBoost = (fn) => (midis, opts) =>
  fn(chordPlaybackMidis(midis, opts?.chordRootMidi), stripChordPointerOpts(opts));

const bindChordPointer = createChordPointerBinder({
  playChord: withRootBoost(playChord),
  playChordHold: withRootBoost(playChordHold),
  warmupChord: warmupChordSamples,
});

function setViews(isEditor) {
  viewHome.classList.toggle("is-hidden", isEditor);
  viewCustom.classList.toggle("is-hidden", !isEditor);
  viewCustom.setAttribute("aria-hidden", isEditor ? "false" : "true");
}

function onPianoMidiToggle(midi) {
  if (editorSelectedMidis.has(midi)) {
    editorSelectedMidis.delete(midi);
  } else {
    editorSelectedMidis.add(midi);
    void playPianoKeyPreview(midi);
  }
  syncPianoPickUi(pianoRow, editorSelectedMidis);
  updateCustomSaveUi();
}

function updateCustomSaveUi() {
  const n = editorSelectedMidis.size;
  const nameOk = customNameInput.value.trim().length > 0;
  btnSaveCustom.disabled = n < 3 || !nameOk;
}

function resetCustomEditor() {
  editorSelectedMidis.clear();
  customNameInput.value = "";
  customSaveErr.hidden = true;
  customSaveErr.textContent = "";
  syncPianoPickUi(pianoRow, editorSelectedMidis);
  updateCustomSaveUi();
}

function openCustomEditor() {
  buildPianoRow(pianoRow, { onToggle: onPianoMidiToggle });
  resetCustomEditor();
  setViews(true);
  customNameInput.focus();
}

function closeCustomEditor() {
  setViews(false);
}

function saveCustomFromEditor() {
  customSaveErr.hidden = true;
  const midis = Array.from(editorSelectedMidis).sort((a, b) => a - b);
  if (midis.length < 3) {
    customSaveErr.textContent = "请至少选择 3 个琴键。";
    customSaveErr.hidden = false;
    return;
  }
  const name = customNameInput.value.trim().slice(0, 16);
  if (!name) {
    customSaveErr.textContent = "请填写和弦名称。";
    customSaveErr.hidden = false;
    return;
  }
  customChords.push({
    id: crypto.randomUUID?.() || String(Date.now()),
    name,
    midis,
  });
  persistCustomChords(customChords);
  closeCustomEditor();
  renderCustomStrip();
}

function renderCustomStrip() {
  customGrid.replaceChildren();
  customChords.forEach((item, i) => {
    const slot = document.createElement("div");
    slot.className = "custom-chord-slot";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chord-key chord-key--custom";
    paintChordKey(btn, 7 + i, i);
    const sub = item.midis.map(midiToNoteLabel).join(" ");
    btn.innerHTML = `
          <span class="chord-key__label">${escHtml(item.name)}</span>
          <div class="chord-key__roman"><span class="roman-h">${item.midis.length}</span> 音 · ${escHtml(sub)}</div>
        `;
    bindChordPointer(btn, item.midis, { chordRootMidi: Math.min(...item.midis) });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "chord-key-del";
    del.setAttribute("aria-label", `删除 ${item.name}`);
    del.textContent = "×";
    del.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      customChords = customChords.filter((c) => c.id !== item.id);
      persistCustomChords(customChords);
      renderCustomStrip();
    });
    slot.appendChild(btn);
    slot.appendChild(del);
    customGrid.appendChild(slot);
  });
}

function isMovableNotation() {
  return notationSelect.value === "movable";
}

function chordCardLines(label, i) {
  if (!isMovableNotation()) {
    return {
      primary: label,
      romanHtml: formatRomanLineHtml(ROMAN[i]),
      aria: `${label}，${ROMAN[i]}`,
    };
  }
  const deg = ROMAN_DEGREE_LABELS[i];
  const kind = romanChordKind(ROMAN[i]);
  const romanHtml = kind
    ? `<span class="roman-h">${escHtml(label)}</span> · ${escHtml(kind)}`
    : escHtml(label);
  return {
    primary: deg,
    romanHtml,
    aria: `${deg}（${label}），${ROMAN[i]}`,
  };
}

function renderChords() {
  const key = selectedKey();
  keyTitle.textContent = key.id;
  keyTitle.classList.remove("is-bump");
  void keyTitle.offsetWidth;
  keyTitle.classList.add("is-bump");
  const triads = voicedTriadsForKey(key.tonicMidi);
  grid.replaceChildren();
  grid.setAttribute("aria-label", isMovableNotation() ? "大调顺阶三和弦（首调显示）" : "大调顺阶三和弦（固定调显示）");
  key.labels.forEach((label, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chord-key";
    paintChordKey(btn, i, i);
    const { primary, romanHtml, aria } = chordCardLines(label, i);
    btn.setAttribute("aria-label", aria);
    btn.innerHTML = `
          <span class="chord-key__label">${escHtml(primary)}</span>
          <div class="chord-key__roman">${romanHtml}</div>
        `;
    bindChordPointer(btn, triads[i], { chordRootMidi: diatonicChordRootMidi(key.tonicMidi, i) });
    grid.appendChild(btn);
  });
  preloadPianoForTonic(key.tonicMidi).catch(() => {});
}

function preloadIdle() {
  void preloadPianoForTonic(selectedKey().tonicMidi);
  const ctx = getCtx();
  const midis = [];
  customChords.forEach((c) => {
    c.midis.forEach((m) => midis.push(m));
    const r = Math.min(...c.midis);
    midis.push(r - 24, r - 12);
  });
  void preloadPianoBasesForMidis(ctx, midis).catch(() => {});
}

MAJOR_KEYS.forEach((k) => {
  const opt = document.createElement("option");
  opt.value = k.id;
  opt.textContent = `${k.id} 大调`;
  keySelect.appendChild(opt);
});

try {
  const saved = localStorage.getItem(NOTATION_LS_KEY);
  if (saved === "movable" || saved === "fixed") notationSelect.value = saved;
} catch (_) {}

try {
  rootBoost.checked = localStorage.getItem(ROOT_BOOST_LS_KEY) === "1";
} catch (_) {}

keySelect.addEventListener("change", renderChords);
notationSelect.addEventListener("change", () => {
  try {
    localStorage.setItem(NOTATION_LS_KEY, notationSelect.value);
  } catch (_) {}
  renderChords();
});
rootBoost.addEventListener("change", () => {
  try {
    localStorage.setItem(ROOT_BOOST_LS_KEY, rootBoost.checked ? "1" : "0");
  } catch (_) {}
});
renderChords();
renderCustomStrip();

btnAddChord.addEventListener("click", openCustomEditor);
btnCustomBack.addEventListener("click", closeCustomEditor);
btnSaveCustom.addEventListener("click", saveCustomFromEditor);
customNameInput.addEventListener("input", updateCustomSaveUi);

document.querySelector(".shell")?.addEventListener(
  "pointerdown",
  () => {
    void whenContextReady(getCtx());
  },
  { once: true, passive: true }
);

if (typeof requestIdleCallback !== "undefined") requestIdleCallback(preloadIdle);
else setTimeout(preloadIdle, 400);

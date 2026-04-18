import { midiToNoteLabel } from "./music-theory.js";
import { EDITOR_MIDI_MIN, EDITOR_MIDI_MAX, PIANO_UI_REV } from "./constants.js";

/** 钢琴键盘布局（不含 MIDI 范围常量，见 constants.js） */
export const PIANO_LAYOUT = {
  BLACK_SLOT: { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 },
  OCTAVE_BASES: [48, 60, 72],
  NATURAL_OFFSETS: [0, 2, 4, 5, 7, 9, 11],
  BLACK_OFFSETS: [1, 3, 6, 8, 10],
};

export function buildPianoRow(rootEl, { onToggle }) {
  const { BLACK_SLOT, OCTAVE_BASES, NATURAL_OFFSETS, BLACK_OFFSETS } = PIANO_LAYOUT;

  const totalKeys = EDITOR_MIDI_MAX - EDITOR_MIDI_MIN + 1;
  if (
    rootEl.dataset.pkUi === PIANO_UI_REV &&
    rootEl.classList.contains("piano-keybed") &&
    rootEl.querySelectorAll(".piano-key").length === totalKeys &&
    rootEl.querySelectorAll(".piano-octave").length === OCTAVE_BASES.length
  ) {
    return;
  }

  rootEl.replaceChildren();
  rootEl.className = "piano-keybed";
  rootEl.dataset.pkUi = PIANO_UI_REV;

  for (const baseMidi of OCTAVE_BASES) {
    const oct = document.createElement("div");
    oct.className = "piano-octave";

    const whites = document.createElement("div");
    whites.className = "piano-octave-whites";
    for (const off of NATURAL_OFFSETS) {
      const m = baseMidi + off;
      if (m < EDITOR_MIDI_MIN || m > EDITOR_MIDI_MAX) continue;
      const lab = midiToNoteLabel(m);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "piano-key piano-key--white";
      btn.dataset.midi = String(m);
      btn.textContent = lab;
      btn.setAttribute("aria-label", lab);
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => onToggle(m));
      whites.appendChild(btn);
    }
    oct.appendChild(whites);

    const blacks = document.createElement("div");
    blacks.className = "piano-octave-blacks";
    for (const off of BLACK_OFFSETS) {
      const m = baseMidi + off;
      if (m < EDITOR_MIDI_MIN || m > EDITOR_MIDI_MAX) continue;
      const slot = BLACK_SLOT[off];
      const lab = midiToNoteLabel(m);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "piano-key piano-key--black";
      btn.dataset.midi = String(m);
      btn.textContent = lab;
      btn.setAttribute("aria-label", lab);
      btn.setAttribute("aria-pressed", "false");
      btn.style.left = `calc(3px + var(--pk-white-w) * ${slot + 1} + var(--pk-key-gap) * ${slot + 0.5} - var(--pk-black-w) / 2)`;
      btn.addEventListener("click", () => onToggle(m));
      blacks.appendChild(btn);
    }
    oct.appendChild(blacks);
    rootEl.appendChild(oct);
  }
}

export function syncPianoPickUi(rootEl, selectedMidis) {
  rootEl.querySelectorAll(".piano-key").forEach((el) => {
    const m = Number(el.dataset.midi);
    const on = selectedMidis.has(m);
    el.classList.toggle("is-picked", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

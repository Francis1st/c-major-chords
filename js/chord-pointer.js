import { CHORD_TAP_DURATION_SEC } from "./constants.js";

/** 和弦按钮：短按一次 / 长按持续 */
export function createChordPointerBinder({ playChord, playChordHold, warmupChord }) {
  /** 略短于常见「长按」阈值，减少按住后等待起声的时间 */
  const HOLD_ARM_MS = 185;
  const safeStopHold = (ctl) => {
    if (ctl && typeof ctl.stop === "function") ctl.stop();
  };

  return function bindChordPointer(btn, midiNotes, { chordRootMidi } = {}) {
    let holdTimer = null;
    let tapPending = false;
    let holdCtl = null;
    let holdPromise = null;
    let down = false;
    let capId = null;

    const clearHoldTimer = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    const prewarm = () => warmupChord(midiNotes, chordRootMidi);

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (down) return;
      down = true;
      tapPending = true;
      holdCtl = null;
      holdPromise = null;
      capId = e.pointerId;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (_) {}
      btn.classList.add("is-pressing");
      clearHoldTimer();
      prewarm();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        tapPending = false;
        /* rAF 再建图，减轻与 timer/指针同帧抢主线程的顿挫；用 Promise 接住「尚未起声」窗口，避免提前松手无 stop */
        holdPromise = new Promise((resolveArm) => {
          requestAnimationFrame(() => {
            playChordHold(midiNotes, { gainScale: 1, chordRootMidi }).then(resolveArm);
          });
        }).then((ctl) => {
          holdPromise = null;
          holdCtl = ctl;
          if (!down) safeStopHold(ctl);
          return ctl;
        });
      }, HOLD_ARM_MS);
    };

    const onUp = () => {
      if (!down) return;
      down = false;
      btn.classList.remove("is-pressing");
      clearHoldTimer();
      if (tapPending) {
        playChord(midiNotes, { durationSec: CHORD_TAP_DURATION_SEC, chordRootMidi });
      } else if (holdCtl) {
        safeStopHold(holdCtl);
        holdCtl = null;
      } else if (holdPromise) {
        holdPromise.then(safeStopHold);
      }
      tapPending = false;
      holdCtl = null;
      holdPromise = null;
      if (capId != null) {
        try {
          btn.releasePointerCapture(capId);
        } catch (_) {}
        capId = null;
      }
    };

    btn.addEventListener("pointerenter", prewarm, { passive: true });
    btn.addEventListener("pointerdown", onDown);
    btn.addEventListener("pointerup", onUp);
    btn.addEventListener("pointercancel", onUp);
    btn.addEventListener("lostpointercapture", onUp);
    btn.addEventListener("selectstart", (e) => e.preventDefault());
  };
}

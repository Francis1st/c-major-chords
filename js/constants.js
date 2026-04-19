/** 编辑器 MIDI 范围与钢琴 DOM 版本（单一来源，避免模块间互相引用） */

export const EDITOR_MIDI_MIN = 48;
export const EDITOR_MIDI_MAX = 83;
export const PIANO_UI_REV = "7";

/** 顺阶和弦：固定调 / 首调 显示偏好 */
export const NOTATION_LS_KEY = "c-major-chords-notation-v1";

/** 和弦块短按、钢琴键选中等「点一下」的默认播放时长（秒） */
export const CHORD_TAP_DURATION_SEC = 2.65;

/** 根音增强开关（localStorage 键名沿用 v1，勿改以免丢用户偏好） */
export const ROOT_BOOST_LS_KEY = "c-major-chords-tonic-boost-v1";

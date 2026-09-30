/**
 * @xromdev/pianoroll — notes falling onto a keyboard.
 *
 * `PianoRollView` is the whole view, in any DOM element, no framework needed;
 * `@xromdev/pianoroll/react` wraps it as a component. Import
 * `@xromdev/pianoroll/pianoroll.css` once for the keys.
 *
 * The pieces are exported too: the keyboard's geometry (`keyboardLayout`, keys
 * in a real piano's proportions), `paintRoll` for the falling area on a canvas
 * of your own, and the sparks.
 */

export {
  PianoRollView,
  DEFAULT_TRACKS,
  resolveTracks,
  type PianoRollOptions,
  type RollNote,
  type TrackStyle,
} from './view.js';
export {
  FULL_PIANO,
  MAX_WHITE_KEY_WIDTH,
  MIN_WHITE_KEY_WIDTH,
  WHITE_KEY_ASPECT,
  chooseRange,
  isBlackKey,
  keyboardDepth,
  keyboardLayout,
  noteName,
  noteRange,
  snapRange,
  whiteKeyCount,
  type KeyGeometry,
  type KeyboardLayout,
} from './keyboard.js';
export { SHADOW_REFERENCE_WIDTH, keyStyle } from './keys.js';
export {
  frameOf,
  paintRoll,
  visibleNotes,
  type Guide,
  type LaneColumn,
  type LitLane,
  type PaintInput,
  type PaintedNote,
  type PitchCurve,
} from './paint.js';
export { MAX_SPARKS, burst, stepSparks, type Spark } from './sparks.js';

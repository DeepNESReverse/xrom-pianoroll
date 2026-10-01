/**
 * @xromdev/pianoroll — notes falling onto a keyboard.
 *
 * `PianoRollView` is the whole view, in any DOM element, no framework needed;
 * `@xromdev/pianoroll/react` wraps it as a component. Import
 * `@xromdev/pianoroll/pianoroll.css` once for the keys.
 *
 * The falling area and the frame loop are `@xromdev/roll`'s, re-exported here;
 * this package is the keyboard: its geometry (`keyboardLayout`, keys in a real
 * piano's proportions), the keys' faces, and the view.
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
// The core, for anyone who drew with these before they had a package of their own.
export {
  RollView,
  frameOf,
  paintRoll,
  visibleNotes,
  MAX_SPARKS,
  burst,
  stepSparks,
  type Guide,
  type LaneColumn,
  type LitLane,
  type PaintInput,
  type PaintedNote,
  type PitchCurve,
  type RollSurface,
  type Spark,
} from '@xromdev/roll';

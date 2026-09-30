/**
 * Where every key sits, and which of them are black.
 *
 * The arithmetic lives here rather than in the component for the reason
 * `gutterNav.ts` lives apart from `HexViewer`: "which column does this note
 * belong to" is checkable without a browser, and a block that does not line up
 * with the key it lights is the one bug this view cannot hide — the picture
 * still looks like a piano roll while saying the wrong note.
 */

/** Is this semitone a black key? Index 0 is C. */
const BLACK_IN_OCTAVE = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * A piano keyboard, in millimetres.
 *
 * These are the real instrument's, and they are written down rather than
 * guessed at because every proportion below comes out of them:
 *
 * - An octave spans 164mm over 7 white keys, so a white key is 23.4mm wide.
 * - A white key shows about 150mm of length in front of the fallboard.
 * - A black key is about 9.5mm wide and 95mm long.
 *
 * The width of a keyboard is set by how much room there is; its depth is NOT a
 * separate decision, it follows from the width. Left free, a panel that got
 * wider turned the keys into macaroni and a narrow one made them stubby, and
 * neither looks like the instrument at any size.
 */
const WHITE_WIDTH_MM = 164 / 7;
const WHITE_LENGTH_MM = 150;
const BLACK_WIDTH_MM = 9.5;
const BLACK_LENGTH_MM = 95;

/** A black key's width and length, as fractions of a white key's. */
export const BLACK_WIDTH_RATIO = BLACK_WIDTH_MM / WHITE_WIDTH_MM;
export const BLACK_HEIGHT_RATIO = BLACK_LENGTH_MM / WHITE_LENGTH_MM;

/**
 * How many times longer a white key is than it is wide: 6.4.
 *
 * The one number that keeps a drawn keyboard looking like a keyboard. A layout
 * picks a white-key width from the room it has, and the depth is then this
 * times that — never the other way round, and never both independently.
 */
export const WHITE_KEY_ASPECT = WHITE_LENGTH_MM / WHITE_WIDTH_MM;

/** The depth a keyboard of this key width must have. */
export const keyboardDepth = (whiteWidth: number) => whiteWidth * WHITE_KEY_ASPECT;

/** The widest key that fits a keyboard this deep. The inverse of the above. */
export const keyWidthForDepth = (depth: number) => depth / WHITE_KEY_ASPECT;

/**
 * The key slip: the strip of wood in front of the keys, about 18mm of it in
 * view.
 *
 * It is a real part of the instrument — the piece the keys disappear into at
 * the near end — and the reason to draw it is the same as the reason to draw
 * the keys in proportion: a keyboard that simply stops at its front edge reads
 * as a picture of keys rather than as a keyboard in a case.
 */
const SLIP_DEPTH_MM = 18;
export const SLIP_RATIO = SLIP_DEPTH_MM / WHITE_WIDTH_MM;
export const slipDepth = (whiteWidth: number) => whiteWidth * SLIP_RATIO;

/**
 * The widest key that fits a strip holding the keys AND the slip.
 *
 * Both depths follow from the key width, so a strip of a given height admits
 * one width and it has to be solved for rather than guessed: keys and slip
 * together are `WHITE_KEY_ASPECT + SLIP_RATIO` times the width.
 */
export const keyWidthForStrip = (strip: number) => strip / (WHITE_KEY_ASPECT + SLIP_RATIO);

/**
 * Height the slip is given when it carries the sounding notes' names.
 *
 * A floor, not a size: at 9px keys the slip comes out at 7px and the names
 * vanish, which is how they were lost from the music page. Lives here rather
 * than with the roll because it is part of the geometry every caller has to
 * solve against — see `stripForKeyWidth`.
 */
export const NAME_PLATE = 15;

/**
 * The strip a keyboard of this key width needs — keys, plus the slip under
 * them, or the name plate where the slip alone is shallower than names need.
 *
 * The inverse of the caps `keyboardLayout` is given, and the thing a caller
 * sizing a panel has to solve rather than guess: hand a keyboard a strip that
 * admits narrower keys than its width could afford and it draws the narrower
 * ones, centred, with the room it was not allowed to use left empty either
 * side.
 */
export const stripForKeyWidth = (whiteWidth: number, withNames = false) =>
  keyboardDepth(whiteWidth) + Math.max(slipDepth(whiteWidth), withNames ? NAME_PLATE : 0);

/** How many white keys a range holds — what a keyboard divides its width by. */
export function whiteKeyCount(from: number, to: number): number {
  let count = 0;
  for (let midi = from; midi <= to; midi++) if (!isBlackKey(midi)) count++;
  return count;
}

export const MIDI_MIN = 0;
export const MIDI_MAX = 127;

/** A0..C8 — the 88 keys of a real piano. */
export const FULL_PIANO = { from: 21, to: 108 } as const;
/** 52 white keys in those 88. */
export const FULL_PIANO_WHITE_KEYS = 52;

/**
 * Widest a white key may be drawn.
 *
 * A keyboard divides the panel between however many white keys it has, so a
 * track spanning two octaves gets keys three times the size of a real one —
 * which reads as a cartoon, not an instrument, and makes the falling blocks
 * enormous with it. Past this the keyboard stops growing and is centred.
 */
export const MAX_WHITE_KEY_WIDTH = 30;
/** Narrower than this and the black keys stop being separable. */
export const MIN_WHITE_KEY_WIDTH = 9;

const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;

export const isBlackKey = (midi: number) => BLACK_IN_OCTAVE[pitchClass(midi)];

/** `60` → `C4` — middle C is C4, the convention every DAW prints. */
export const noteName = (midi: number) =>
  `${NOTE_NAMES[pitchClass(midi)]}${Math.floor(midi / 12) - 1}`;

export interface KeyGeometry {
  midi: number;
  black: boolean;
  /** Left edge, px from the keyboard's left edge. */
  x: number;
  width: number;
  /** Length down the keyboard, as a fraction of its height. */
  height: number;
  /** Position among the white keys; `-1` for a black key. */
  whiteIndex: number;
}

export interface KeyboardLayout {
  from: number;
  to: number;
  /** Width the keys were laid out in — the panel, or less when capped. */
  width: number;
  /** Left edge of the keyboard inside the panel; non-zero when centred. */
  left: number;
  whiteCount: number;
  whiteWidth: number;
  /** Depth the keys must be drawn at to stay in proportion. See `WHITE_KEY_ASPECT`. */
  depth: number;
  /** White keys first, then black — draw order, so the blacks sit on top. */
  keys: KeyGeometry[];
  byMidi: Map<number, KeyGeometry>;
}

/**
 * Widen a range to whole octaves, C..B.
 *
 * A keyboard that begins on a black key has no white key under it to sit on,
 * and one that begins mid-octave reads as a cropped photograph of a piano
 * rather than as an instrument.
 */
export function snapRange(from: number, to: number): { from: number; to: number } {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return {
    from: Math.max(MIDI_MIN, Math.floor(lo / 12) * 12),
    to: Math.min(MIDI_MAX, Math.floor(hi / 12) * 12 + 11),
  };
}

/** The snapped range that covers every note, or `fallback` for no notes at all. */
export function noteRange(
  notes: readonly { midi: number }[],
  fallback: { from: number; to: number } = { from: 48, to: 83 }
): { from: number; to: number } {
  if (notes.length === 0) return snapRange(fallback.from, fallback.to);
  let lo = Infinity;
  let hi = -Infinity;
  for (const note of notes) {
    if (note.midi < lo) lo = note.midi;
    if (note.midi > hi) hi = note.midi;
  }
  return snapRange(lo, hi);
}

/**
 * Lay the keys out across `width`.
 *
 * White keys divide the width evenly; a black key is centred on the seam
 * between its neighbours. A real piano offsets them slightly (C# sits nearer C
 * than D# sits to D) — centring is the simplification every falling-notes view
 * makes, and it keeps a note block centred over the key it lights.
 */
export function keyboardLayout(
  from: number,
  to: number,
  width: number,
  maxWhiteWidth = MAX_WHITE_KEY_WIDTH
): KeyboardLayout {
  const whites: number[] = [];
  for (let midi = from; midi <= to; midi++) if (!isBlackKey(midi)) whites.push(midi);

  const whiteCount = whites.length;
  const whiteWidth = whiteCount > 0 ? Math.min(width / whiteCount, maxWhiteWidth) : 0;
  const blackWidth = whiteWidth * BLACK_WIDTH_RATIO;
  // Capped keys leave slack, and a keyboard hugging the left edge of a wide
  // panel looks like a mistake; centre it and the falling area lines up with it.
  const left = Math.max(0, (width - whiteWidth * whiteCount) / 2);

  const keys: KeyGeometry[] = whites.map((midi, i) => ({
    midi,
    black: false,
    x: left + i * whiteWidth,
    width: whiteWidth,
    height: 1,
    whiteIndex: i,
  }));
  const byMidi = new Map<number, KeyGeometry>(keys.map((key) => [key.midi, key]));

  for (let midi = from; midi <= to; midi++) {
    if (!isBlackKey(midi)) continue;
    // Every black key's lower neighbour is white, so this is never a miss
    // inside the range — except for a range that opens on a black key.
    const below = byMidi.get(midi - 1);
    if (!below) continue;
    const key: KeyGeometry = {
      midi,
      black: true,
      x: below.x + whiteWidth - blackWidth / 2,
      width: blackWidth,
      height: BLACK_HEIGHT_RATIO,
      whiteIndex: -1,
    };
    keys.push(key);
    byMidi.set(midi, key);
  }

  return {
    from,
    to,
    width,
    left,
    whiteCount,
    whiteWidth,
    depth: keyboardDepth(whiteWidth),
    keys,
    byMidi,
  };
}

/**
 * Which keyboard to draw: the notes' own range, or the whole piano.
 *
 * Showing all 88 keys is the nicer picture — the music sits in a real
 * instrument rather than in a window cropped to it — but only while the keys
 * stay a believable size. So the full piano is used whenever the panel can
 * afford it, and otherwise the range narrows to what the piece actually plays,
 * padded out to whole octaves.
 *
 * Pure, so the decision is checkable: at 1200px it is the full piano, at 500px
 * it is not, and the boundary is a number rather than a guess.
 */
export function chooseRange(
  notes: readonly { midi: number }[],
  width: number,
  options: { minWhiteWidth?: number; fallback?: { from: number; to: number } } = {}
): { from: number; to: number; full: boolean } {
  const minWhite = options.minWhiteWidth ?? MIN_WHITE_KEY_WIDTH;
  if (width >= FULL_PIANO_WHITE_KEYS * minWhite) {
    return { ...FULL_PIANO, full: true };
  }
  return { ...noteRange(notes, options.fallback), full: false };
}

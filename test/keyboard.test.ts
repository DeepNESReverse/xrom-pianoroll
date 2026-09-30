import { describe, expect, it } from 'vitest';
import {
  BLACK_HEIGHT_RATIO,
  BLACK_WIDTH_RATIO,
  FULL_PIANO,
  MAX_WHITE_KEY_WIDTH,
  WHITE_KEY_ASPECT,
  chooseRange,
  isBlackKey,
  NAME_PLATE,
  keyWidthForDepth,
  keyWidthForStrip,
  keyboardDepth,
  keyboardLayout,
  stripForKeyWidth,
  whiteKeyCount,
  noteName,
  noteRange,
  snapRange,
} from '../src/keyboard.js';

describe('isBlackKey', () => {
  it('marks the five black keys of an octave', () => {
    const octave = Array.from({ length: 12 }, (_, i) => isBlackKey(60 + i));
    expect(octave).toEqual([
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
    ]);
  });

  it('holds in every octave, including below zero', () => {
    for (let midi = -24; midi <= 127; midi++) {
      expect(isBlackKey(midi)).toBe(isBlackKey(midi + 12));
    }
  });
});

describe('noteName', () => {
  it('calls middle C C4', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(21)).toBe('A0');
  });
});

describe('snapRange', () => {
  it('opens on a C and closes on a B', () => {
    expect(snapRange(40, 79)).toEqual({ from: 36, to: 83 });
  });

  it('leaves a range that is already whole octaves alone', () => {
    expect(snapRange(36, 83)).toEqual({ from: 36, to: 83 });
  });

  it('clamps to the MIDI range', () => {
    expect(snapRange(-5, 200).from).toBe(0);
    expect(snapRange(-5, 200).to).toBe(127);
  });
});

describe('noteRange', () => {
  it('covers every note', () => {
    expect(noteRange([{ midi: 60 }, { midi: 40 }, { midi: 79 }])).toEqual({ from: 36, to: 83 });
  });

  it('falls back when there are no notes', () => {
    expect(noteRange([])).toEqual({ from: 48, to: 83 });
  });
});

describe('keyboardLayout', () => {
  const layout = keyboardLayout(36, 83, 700);

  it('divides the width between the white keys only', () => {
    expect(layout.whiteCount).toBe(28); // four octaves
    expect(layout.whiteWidth).toBeCloseTo(700 / 28);
    const last = layout.keys.filter((k) => !k.black).at(-1)!;
    expect(last.x + last.width).toBeCloseTo(700);
  });

  it('lays the white keys edge to edge with no gaps or overlaps', () => {
    const whites = layout.keys.filter((k) => !k.black).sort((a, b) => a.midi - b.midi);
    for (let i = 1; i < whites.length; i++) {
      expect(whites[i].x).toBeCloseTo(whites[i - 1].x + whites[i - 1].width);
    }
  });

  it('centres a black key on the seam between its neighbours', () => {
    const cSharp = layout.byMidi.get(61)!;
    const c = layout.byMidi.get(60)!;
    expect(cSharp.black).toBe(true);
    expect(cSharp.x + cSharp.width / 2).toBeCloseTo(c.x + c.width);
    expect(cSharp.width).toBeCloseTo(layout.whiteWidth * BLACK_WIDTH_RATIO);
  });

  it('gives every key in the range a geometry', () => {
    for (let midi = 36; midi <= 83; midi++) expect(layout.byMidi.has(midi)).toBe(true);
    expect(layout.keys).toHaveLength(83 - 36 + 1);
  });

  it('draws the white keys before the black ones, so the blacks sit on top', () => {
    const firstBlack = layout.keys.findIndex((k) => k.black);
    const lastWhite = layout.keys.map((k) => k.black).lastIndexOf(false);
    expect(lastWhite).toBeLessThan(firstBlack);
  });

  it('stops growing the keys and centres them instead', () => {
    // A two-octave track across a wide panel would otherwise get keys three
    // times the size of a real one, which reads as a cartoon rather than an
    // instrument — and makes the falling blocks enormous with it.
    const narrowRange = keyboardLayout(60, 83, 1200);
    expect(narrowRange.whiteWidth).toBe(MAX_WHITE_KEY_WIDTH);
    expect(narrowRange.left).toBeGreaterThan(0);

    const drawn = narrowRange.whiteWidth * narrowRange.whiteCount;
    expect(narrowRange.left).toBeCloseTo((1200 - drawn) / 2);

    const first = narrowRange.keys.find((key) => !key.black)!;
    expect(first.x).toBeCloseTo(narrowRange.left);
  });

  it('still fills the width when the keys would be small enough', () => {
    const wide = keyboardLayout(21, 108, 700);
    expect(wide.whiteWidth).toBeLessThan(MAX_WHITE_KEY_WIDTH);
    expect(wide.left).toBe(0);
  });

  it("keeps a real piano's proportions at every width", () => {
    // The whole point: a panel that gets wider must not turn the keys into
    // macaroni, and a narrow one must not make them stubby. Width is chosen
    // from the room available, depth follows from width, and the ratio between
    // them is the same number every time.
    for (const width of [320, 700, 1200, 2400]) {
      const layout = keyboardLayout(FULL_PIANO.from, FULL_PIANO.to, width);
      expect(layout.depth / layout.whiteWidth).toBeCloseTo(WHITE_KEY_ASPECT);
      const black = layout.byMidi.get(61)!;
      expect(black.width / layout.whiteWidth).toBeCloseTo(BLACK_WIDTH_RATIO);
      expect(black.height).toBeCloseTo(BLACK_HEIGHT_RATIO);
    }
  });

  it('measures a real keyboard: 6.4 long to 1 wide, black keys 0.41 by 0.63', () => {
    // 164mm to the octave over 7 white keys, 150mm of visible length, a black
    // key 9.5mm by 95mm. Pinned so a later tweak by eye has to argue with the
    // instrument rather than with a magic number.
    expect(WHITE_KEY_ASPECT).toBeCloseTo(6.4, 1);
    expect(BLACK_WIDTH_RATIO).toBeCloseTo(0.41, 2);
    expect(BLACK_HEIGHT_RATIO).toBeCloseTo(0.63, 2);
  });

  it('turns a depth back into the width that fits it', () => {
    expect(keyWidthForDepth(keyboardDepth(17))).toBeCloseTo(17);
    // A shallow strip is what caps the keys on a wide panel.
    expect(keyWidthForDepth(104)).toBeLessThan(MAX_WHITE_KEY_WIDTH);
  });

  it('survives a zero width', () => {
    const empty = keyboardLayout(60, 71, 0);
    expect(empty.whiteWidth).toBe(0);
    expect(empty.byMidi.get(61)!.x).toBe(0);
  });
});

describe('chooseRange', () => {
  const notes = [{ midi: 60 }, { midi: 72 }];

  it('shows the whole piano when the panel can afford it', () => {
    const wide = chooseRange(notes, 1200);
    expect(wide.full).toBe(true);
    expect(wide.from).toBe(FULL_PIANO.from);
    expect(wide.to).toBe(FULL_PIANO.to);
  });

  it('narrows to what the piece plays when it cannot', () => {
    const narrow = chooseRange(notes, 400);
    expect(narrow.full).toBe(false);
    // Whole octaves around C4..C5.
    expect(narrow.from).toBe(60);
    expect(narrow.to).toBe(83);
  });

  it('has a boundary that is a number, not a guess', () => {
    // 52 white keys at the 9px floor.
    expect(chooseRange(notes, 52 * 9).full).toBe(true);
    expect(chooseRange(notes, 52 * 9 - 1).full).toBe(false);
  });

  it('falls back to a sensible keyboard with no notes at all', () => {
    expect(chooseRange([], 300).from).toBe(48);
  });
});

/**
 * `stripForKeyWidth` has to be the exact inverse of the caps the roll puts on
 * the layout, or a caller sizing a panel gets keys narrower than it asked for.
 *
 * That is not hypothetical: the music page held the strip at a constant 104px,
 * which admitted 13.9px keys, and on a wide screen drew those instead of the
 * 18px the panel could afford — a small keyboard centred in empty space. These
 * pin the round trip, so the two ends cannot drift apart again.
 */
describe('stripForKeyWidth', () => {
  /** The caps `PianoRoll` hands `keyboardLayout`, given a strip of this height. */
  const maxWidthFor = (strip: number) =>
    Math.min(MAX_WHITE_KEY_WIDTH, keyWidthForStrip(strip), keyWidthForDepth(strip - NAME_PLATE));

  it('asks for a strip that admits exactly the key width it was given', () => {
    for (const wanted of [10, 13.9, 16, 20, 25]) {
      const strip = stripForKeyWidth(wanted, true);
      expect(maxWidthFor(strip)).toBeCloseTo(wanted, 6);
    }
  });

  it('draws keys the panel can afford once the strip follows the width', () => {
    // A cell 956px wide — a 1920px screen in two columns — holding 88 keys.
    const cell = 956;
    const whites = whiteKeyCount(FULL_PIANO.from, FULL_PIANO.to);
    const afford = cell / whites;
    const layout = keyboardLayout(
      FULL_PIANO.from,
      FULL_PIANO.to,
      cell,
      maxWidthFor(stripForKeyWidth(afford, true))
    );
    expect(layout.whiteWidth).toBeCloseTo(afford, 4);
    // And what the constant used to give, for the size of the difference.
    const fixed = keyboardLayout(FULL_PIANO.from, FULL_PIANO.to, cell, maxWidthFor(104));
    expect(layout.whiteWidth).toBeGreaterThan(fixed.whiteWidth * 1.3);
  });

  it('never asks for less room than the keys alone need', () => {
    for (const width of [9, 15, 30]) {
      expect(stripForKeyWidth(width, true)).toBeGreaterThan(keyboardDepth(width));
    }
  });
});

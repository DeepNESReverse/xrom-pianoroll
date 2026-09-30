# @xromdev/pianoroll

Notes falling onto a piano keyboard, the way a Synthesia video shows a piece —
**canvas blocks, CSS keys, and no framework in the frame loop.**

- A block's bottom edge touches its key at the instant the note sounds; its
  length is the duration, its colour the voice, its weight the velocity.
- Keys drawn in a real piano's proportions (a white key is 6.4× longer than it
  is wide), all 88 when there is room, narrowed to the music when there is not.
- Keys go down and take the voice's colour; a repeated note re-strikes; the
  sounding notes are named under their keys; landing blocks throw sparks;
  vibrato and slides are drawn as the curve itself.
- Fast by construction: every frame is one canvas paint plus DOM writes only
  for keys that changed — about half a millisecond of main thread a frame on a
  laptop, and **nothing at
  all** while the clock is paused or the roll is scrolled out of view.
- ~6 KB gzipped. Works in any page; React component included.

**Try it: [xrom.dev/utils/pianoroll](https://xrom.dev/utils/pianoroll)** — drop an NSF and watch its music.

## Install

```sh
npm install @xromdev/pianoroll
```

## Use

```ts
import { PianoRollView } from '@xromdev/pianoroll';
import '@xromdev/pianoroll/pianoroll.css';

const roll = new PianoRollView(document.querySelector('#roll')!, { lookAhead: 2.5 });
roll.setNotes([
  // seconds from the start; the track picks the colour
  { midi: 60, start: 0, duration: 0.5, track: 'lead' },
  { midi: 64, start: 0.5, duration: 0.5, track: 'lead', velocity: 0.6 },
  { midi: 43, start: 0, duration: 1, track: 'bass' },
]);
roll.play(() => audioContext.currentTime - startedAt); // follow your clock
// or: roll.render(seconds) whenever you like
```

The element must have a height; the view fills it.

### React

```tsx
import { PianoRoll } from '@xromdev/pianoroll/react';
import '@xromdev/pianoroll/pianoroll.css';

// With `clock`, the roll animates on its own frames — React never re-renders for it.
<PianoRoll notes={notes} clock={() => audio.currentTime} height={420} />

// Or drive it yourself — a scrubber, a paused picture:
<PianoRoll notes={notes} time={position} />
```

## Notes

```ts
interface RollNote {
  midi: number;        // 60 = middle C
  start: number;       // seconds
  duration: number;    // seconds
  track?: string;      // which voice; picks the colour
  velocity?: number;   // 0..1, default 1
  dimmed?: boolean;    // shown faded, lights no key (a muted voice)
  bend?: [number, number][]; // [0..1 through the note, semitones] — vibrato, slides
}
```

## Options

| option | default | |
|---|---|---|
| `lookAhead` | 2.5 | Seconds of music above the keyboard — the fall speed. |
| `range` | chosen | `{ from, to }` in MIDI; left out, all 88 keys if they fit, else the notes' octaves. |
| `tracks` | NES channels | `{ [track]: { color, label?, hatch? } }` over the defaults. |
| `keyboardHeight` | proportional | Fix the strip for keys + name slip, to line two rolls up. |
| `releaseMs` | 320 | How long a key's colour takes to fade. |
| `labelOctaves` | true | Name the C keys. |
| `keyFlash` | true | Colour keys while they sound (they go down either way). |
| `showSounding` | true | Name the sounding notes under their keys. |
| `sparks` | true | Landing blocks break into sparks. |
| `onSoundingChange` | — | Called when the set of sounding notes changes, not every frame. |

`resolveTracks(notes)` gives each track's colour and label for a legend.
The pieces are exported too: `keyboardLayout` (key geometry), `paintRoll`
(the falling area on your own canvas), `frameOf`, `burst` / `stepSparks`.

## Development

```sh
npm install
npm test   # geometry, painting, sparks, and the view in jsdom
```

## License

MIT © Oleksandr Maksymov

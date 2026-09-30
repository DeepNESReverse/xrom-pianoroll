/**
 * A piano roll in a DOM element: notes falling onto a keyboard, the way a
 * Synthesia video shows a piece.
 *
 *   const roll = new PianoRollView(element, { lookAhead: 2.5 });
 *   roll.setNotes(notes);
 *   roll.play(() => audio.currentTime);   // or roll.render(t) yourself
 *
 * The whole view is one reading of time: the keyboard's edge is NOW and the top
 * of the falling area is `now + lookAhead`, so a block's bottom edge touches its
 * key at the instant the note sounds and its length IS the duration.
 *
 * Two surfaces, on purpose. The blocks are canvas — hundreds of them, moving
 * every frame. The keys are DOM, because a key going down and its colour easing
 * out is three CSS declarations (`pianoroll.css`) and nothing per frame. A frame
 * never goes through a framework: `render` paints the canvas and writes to a
 * key's element only where that key changed.
 */

import {
  MAX_WHITE_KEY_WIDTH,
  NAME_PLATE,
  chooseRange,
  keyWidthForDepth,
  keyWidthForStrip,
  keyboardLayout,
  noteName,
  slipDepth,
  type KeyboardLayout,
} from './keyboard.js';
import { SHADOW_REFERENCE_WIDTH, keyStyle } from './keys.js';
import { frameOf, paintRoll, type Guide, type LitLane, type PaintedNote, type PitchCurve } from './paint.js';
import { burst, stepSparks, type Spark } from './sparks.js';

export interface RollNote {
  /** MIDI note number; 60 is middle C. */
  midi: number;
  /** When it sounds, in seconds from the start of the piece. */
  start: number;
  /** How long it sounds, in seconds. */
  duration: number;
  /** Which voice it belongs to — this is what picks the colour. */
  track?: string;
  /** 0..1. Sets the block's weight and the flash's strength. Default 1. */
  velocity?: number;
  /** Shown but not heard — muted. Faded, and it lights no key. */
  dimmed?: boolean;
  /**
   * Vibrato, a bend or a slide, as `[position 0..1 through the note, semitones]`
   * points — drawn along the block as the curve itself.
   */
  bend?: PitchCurve;
}

export interface TrackStyle {
  /** Any CSS colour. */
  color: string;
  /** Name for a legend. Defaults to the track's key. */
  label?: string;
  /** Hatch the blocks as well as colouring them — identity without hue. */
  hatch?: boolean;
}

export interface PianoRollOptions {
  /** Seconds of music visible above the keyboard — the fall speed. Default 2.5. */
  lookAhead?: number;
  /**
   * Keyboard span in MIDI numbers. Left out, it is chosen: all 88 keys when the
   * element is wide enough for believable keys, otherwise what the notes play.
   */
  range?: { from: number; to: number } | null;
  /** Colour, label and texture per track, over `DEFAULT_TRACKS`. */
  tracks?: Record<string, TrackStyle>;
  /**
   * Exactly this many px for keys and slip together. Left out, the keyboard
   * takes the depth its width entitles it to, up to 40% of the height.
   */
  keyboardHeight?: number;
  /** How long a key keeps glowing after its note ends, in ms. Default 320. */
  releaseMs?: number;
  /** Name the C keys. Default true. */
  labelOctaves?: boolean;
  /** Colour a key while its note sounds (it goes down either way). Default true. */
  keyFlash?: boolean;
  /** Name each sounding note on the strip under its key. Default true. */
  showSounding?: boolean;
  /** Break a landing block into sparks. Default true. */
  sparks?: boolean;
  /** Called when the SET of sounding notes changes — not every frame. */
  onSoundingChange?: (midis: readonly number[]) => void;
}

/**
 * Colours for the NES's four tone channels, from a palette checked for
 * colour-blind separation on a dark background; `noise` is hatched as well,
 * since under protanopia it comes closest to its neighbours.
 */
export const DEFAULT_TRACKS: Record<string, TrackStyle> = {
  pulse1: { color: '#3987e5', label: 'pulse 1' },
  pulse2: { color: '#c98500', label: 'pulse 2' },
  triangle: { color: '#d55181', label: 'triangle' },
  noise: { color: '#008300', label: 'noise', hatch: true },
};

/** Handed in this order to tracks nothing names. */
const PALETTE_SLOTS = ['#3987e5', '#c98500', '#d55181', '#008300'];
/** Past the four checked slots a new hue would be a guess, so the rest share one. */
const OTHER = '#8a8a99';
/** Most of the height the keyboard may take when free to choose. */
const KEYBOARD_SHARE = 0.4;

/**
 * Every track in the notes with its resolved style — named tracks first, in
 * the order declared, then the rest as they appear. For drawing a legend.
 */
export function resolveTracks(
  notes: readonly RollNote[],
  overrides?: Record<string, TrackStyle>
): Map<string, TrackStyle> {
  const resolved = new Map<string, TrackStyle>();
  const used = new Set<string>();
  const claim = (name: string, style: TrackStyle) => {
    resolved.set(name, { label: name, ...style });
    used.add(style.color);
  };
  const present = new Set<string>();
  for (const note of notes) present.add(note.track ?? 'default');
  const declared = [...Object.keys(overrides ?? {}), ...Object.keys(DEFAULT_TRACKS)];
  const seen = [
    ...declared.filter((name, i) => present.has(name) && declared.indexOf(name) === i),
    ...[...present].filter((name) => !declared.includes(name)),
  ];
  for (const name of seen) {
    const preset = overrides?.[name] ?? DEFAULT_TRACKS[name];
    if (preset) claim(name, preset);
  }
  for (const name of seen) {
    if (resolved.has(name)) continue;
    claim(name, { color: PALETTE_SLOTS.find((c) => !used.has(c)) ?? OTHER });
  }
  return resolved;
}

/** What the view last wrote to one key, so a frame writes only what changed. */
interface KeyState {
  node: HTMLElement;
  lit: boolean;
  color: string;
  /** Start of the note that lit it: a new start is a new strike. */
  start: number;
}

export class PianoRollView {
  /** The view's own element, inside the host it was given. */
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly keysEl: HTMLDivElement;
  private readonly slipEl: HTMLDivElement;
  private options: PianoRollOptions;
  private notes: readonly RollNote[] = [];
  private painted: PaintedNote[] = [];
  private maxDuration = 0;
  private styles = new Map<string, TrackStyle>();

  private width = 0;
  private height = 0;
  private fallHeight = 0;
  private layout: KeyboardLayout | null = null;
  private guides: Guide[] = [];
  private semitonePx = 0;
  private keys = new Map<number, KeyState>();

  private time = 0;
  private sparkPool: Spark[] = [];
  private sparkTime: number | null = null;
  private sounding: number[] = [];
  private readonly observer: ResizeObserver | null;
  private readonly visibility: IntersectionObserver | null;
  /** Off screen: nothing is drawn until it scrolls back. */
  private visible = true;
  /** Something other than the time changed since the last frame drawn. */
  private dirty = true;
  /** The time the canvas last showed; NaN before the first frame. */
  private drawnTime = NaN;
  private raf = 0;

  constructor(host: HTMLElement, options: PianoRollOptions = {}) {
    this.options = options;
    const doc = host.ownerDocument;
    this.element = doc.createElement('div');
    this.element.className = 'xpr-roll';
    this.element.style.height = '100%';
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'xpr-canvas';
    this.keysEl = doc.createElement('div');
    this.keysEl.className = 'xpr-keys';
    this.slipEl = doc.createElement('div');
    this.slipEl.className = 'xpr-slip';
    this.element.append(this.canvas, this.keysEl, this.slipEl);
    host.append(this.element);

    this.applyOptions();
    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(([entry]) => this.resize(entry.contentRect.width, entry.contentRect.height));
    this.observer?.observe(this.element);
    this.visibility =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
            if (this.visible) this.redraw();
          });
    this.visibility?.observe(this.element);
    this.resize(this.element.clientWidth, this.element.clientHeight);
  }

  /** Draw the current moment again, whatever it is — after anything but time changed. */
  private redraw() {
    this.dirty = true;
    this.render(this.time);
  }

  /** The notes of the piece, in any order. */
  setNotes(notes: readonly RollNote[]) {
    this.notes = notes;
    this.styles = resolveTracks(notes, this.options.tracks);
    const painted: PaintedNote[] = notes.map((note) => {
      const style = this.styles.get(note.track ?? 'default');
      return {
        lane: note.midi,
        start: note.start,
        duration: note.duration,
        velocity: note.velocity ?? 1,
        color: style?.color ?? OTHER,
        hatch: style?.hatch ?? false,
        dimmed: note.dimmed,
        bend: note.bend,
      };
    });
    painted.sort((a, b) => a.start - b.start);
    this.painted = painted;
    let longest = 0;
    for (const note of painted) if (note.duration > longest) longest = note.duration;
    this.maxDuration = longest;
    this.sparkPool = [];
    if (!this.options.range) this.relayout();
    this.redraw();
  }

  /** Change any options; the rest keep their values. */
  setOptions(options: PianoRollOptions) {
    const tracksChanged = options.tracks !== undefined && options.tracks !== this.options.tracks;
    this.options = { ...this.options, ...options };
    this.applyOptions();
    if (tracksChanged) this.setNotes(this.notes);
    else {
      this.relayout();
      this.redraw();
    }
  }

  /** Each track's resolved colour and label — for a legend. */
  get trackStyles(): ReadonlyMap<string, TrackStyle> {
    return this.styles;
  }

  /** Where every key is, for anything drawn in line with them. */
  get keyboard(): KeyboardLayout | null {
    return this.layout;
  }

  /** Follow a clock: render `clock()` on every animation frame until `stop()`. */
  play(clock: () => number) {
    this.stop();
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.render(clock());
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.observer?.disconnect();
    this.visibility?.disconnect();
    this.element.remove();
  }

  private applyOptions() {
    this.element.style.setProperty('--flash-release', `${this.options.releaseMs ?? 320}ms`);
    this.keysEl.dataset.keyFlash = this.options.keyFlash === false ? '0' : '1';
  }

  private resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.relayout();
    this.redraw();
  }

  /** Keys, slip and falling area from the element's size — the keyboard's proportions decide. */
  private relayout() {
    const o = this.options;
    const width = this.width;
    const showSounding = o.showSounding !== false;
    const maxDepth = o.keyboardHeight ?? this.height * KEYBOARD_SHARE;
    const range = o.range ?? chooseRange(this.notes, width);
    const layout = keyboardLayout(
      range.from,
      range.to,
      width,
      Math.min(
        MAX_WHITE_KEY_WIDTH,
        keyWidthForStrip(maxDepth),
        showSounding ? keyWidthForDepth(maxDepth - NAME_PLATE) : Infinity
      )
    );
    const semitones = range.to - range.from + 1;
    this.semitonePx = semitones > 0 ? (layout.whiteWidth * layout.whiteCount) / semitones : 0;
    const slipHeight = Math.max(slipDepth(layout.whiteWidth), showSounding ? NAME_PLATE : 0);
    const keysHeight = Math.max(0, Math.min(maxDepth - slipHeight, layout.depth));
    this.fallHeight = Math.max(0, this.height - (o.keyboardHeight ?? keysHeight + slipHeight));
    this.guides = layout.keys
      .filter((key) => !key.black && (key.midi % 12 === 0 || key.midi % 12 === 5))
      .map((key) => ({ x: key.x, strong: key.midi % 12 === 0 }));

    this.canvas.style.height = `${this.fallHeight}px`;
    this.keysEl.style.height = `${keysHeight}px`;
    this.slipEl.style.height = `${slipHeight}px`;

    // The keys are rebuilt only when the layout they depend on changes.
    const previous = this.layout;
    const labels = o.labelOctaves !== false;
    const same =
      previous !== null &&
      previous.from === layout.from &&
      previous.to === layout.to &&
      previous.whiteWidth === layout.whiteWidth &&
      previous.left === layout.left &&
      this.builtLabels === labels &&
      this.builtHeight === keysHeight;
    this.layout = layout;
    if (!same) this.buildKeys(layout, keysHeight);
    this.writeNames();
  }

  private builtLabels = true;
  private builtHeight = -1;

  private buildKeys(layout: KeyboardLayout, height: number) {
    const doc = this.element.ownerDocument;
    const labels = this.options.labelOctaves !== false;
    const scale = layout.whiteWidth / SHADOW_REFERENCE_WIDTH;
    const keys = new Map<number, KeyState>();
    const nodes: HTMLElement[] = [];
    for (const key of layout.keys) {
      const node = doc.createElement('div');
      node.className = 'xpr-key';
      node.dataset.black = key.black ? '1' : '0';
      node.dataset.lit = '0';
      const style = keyStyle(key, height, scale);
      for (const name in style) node.style.setProperty(name, style[name]);
      if (labels && !key.black && key.midi % 12 === 0 && key.width >= 12) {
        const label = doc.createElement('span');
        label.className = 'xpr-label';
        label.textContent = noteName(key.midi);
        node.append(label);
      }
      nodes.push(node);
      keys.set(key.midi, { node, lit: false, color: '', start: NaN });
    }
    this.keysEl.replaceChildren(...nodes);
    this.keys = keys;
    this.builtLabels = labels;
    this.builtHeight = height;
    this.sounding = [];
  }

  /** The sounding notes' names on the slip, each under its key. */
  private writeNames() {
    const layout = this.layout;
    if (!layout || this.options.showSounding === false) {
      if (this.slipEl.childElementCount) this.slipEl.replaceChildren();
      return;
    }
    const doc = this.element.ownerDocument;
    const spans: HTMLElement[] = [];
    for (const midi of this.sounding) {
      const key = layout.byMidi.get(midi);
      if (!key) continue;
      const span = doc.createElement('span');
      span.className = 'xpr-name';
      span.textContent = noteName(midi);
      span.style.left = `${key.x + key.width / 2}px`;
      span.style.color = this.keys.get(midi)?.color || '#cfd3e2';
      spans.push(span);
    }
    this.slipEl.replaceChildren(...spans);
  }

  /** Draw the moment `time`, in seconds from the start of the piece. */
  render(time: number) {
    this.time = time;
    // Nothing to do: the same moment as the canvas already shows (a paused
    // clock — the sparks age on the piece's clock too, so they are still) and
    // nothing else changed, or no one can see it. Paused or scrolled away, a
    // roll costs nothing.
    if (!this.visible) return;
    if (time === this.drawnTime && !this.dirty) return;
    const layout = this.layout;
    const width = this.width;
    const height = this.fallHeight;
    if (!layout || width <= 0 || height <= 0) return;

    const canvas = this.canvas;
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawnTime = time;
    this.dirty = false;
    const lookAhead = this.options.lookAhead ?? 2.5;
    const { notes, lit } = frameOf(this.painted, time, lookAhead, this.maxDuration);

    const sparks = this.options.sparks !== false;
    if (sparks) {
      const previous = this.sparkTime;
      const dt = previous === null ? 0 : time - previous;
      this.sparkTime = time;
      // A seek or a loop is not elapsed time: clear rather than age by it.
      this.sparkPool = dt < 0 || dt > 0.5 ? [] : stepSparks(this.sparkPool, dt);
    } else if (this.sparkPool.length) this.sparkPool = [];

    paintRoll({
      ctx,
      width,
      height,
      columns: layout.byMidi,
      guides: this.guides,
      notes,
      time,
      lookAhead,
      lit,
      sparks: this.sparkPool,
      semitonePx: this.semitonePx,
    });

    // Then the keys, written only where they changed. A new strike's sparks
    // join the pool here and are drawn from the next frame, as they rise.
    let soundingChanged = false;
    for (const [midi, key] of this.keys) {
      const note = lit.get(midi);
      if (!note) {
        if (key.lit) {
          key.node.dataset.lit = '0';
          key.lit = false;
          key.start = NaN;
          soundingChanged = true;
        }
        continue;
      }
      const repeat = key.lit;
      const struck = key.start !== note.start;
      if (key.color !== note.color) {
        key.node.style.setProperty('--flash', note.color);
        key.color = note.color;
      }
      if (!key.lit) {
        key.node.dataset.lit = '1';
        key.lit = true;
        soundingChanged = true;
      }
      if (!struck) continue;
      key.start = note.start;
      // Same key, lit before and after: the press cannot show it, so replay the strike.
      if (repeat) key.node.dataset.restrike = key.node.dataset.restrike === 'a' ? 'b' : 'a';
      if (sparks) {
        const column = layout.byMidi.get(midi);
        if (column) {
          const pieces = burst({
            x: column.x + column.width / 2,
            width: column.width,
            color: note.color,
            velocity: note.velocity,
            seed: midi * 1000 + note.start,
          });
          for (const piece of pieces) this.sparkPool.push(piece);
        }
      }
    }


    if (soundingChanged) {
      const now: number[] = [];
      for (const [midi, key] of this.keys) if (key.lit) now.push(midi);
      now.sort((a, b) => a - b);
      this.sounding = now;
      this.writeNames();
      this.options.onSoundingChange?.(now);
    }
  }
}

export type { LitLane };

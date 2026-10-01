/**
 * A piano roll in a DOM element: notes falling onto a keyboard, the way a
 * Synthesia video shows a piece.
 *
 *   const roll = new PianoRollView(element, { lookAhead: 2.5 });
 *   roll.setNotes(notes);
 *   roll.play(() => audio.currentTime);   // or roll.render(t) yourself
 *
 * The falling area, the frame loop and the sparks are `@xromdev/roll`'s; this
 * is the keyboard under them — keys in a real piano's proportions, going down
 * and taking the voice's colour as their notes land (`pianoroll.css`), a
 * repeated note struck again, and the sounding notes named on the slip.
 */

import {
  RollView,
  type LitLane,
  type PitchCurve,
  type RollNote as LaneNote,
  type RollOptions,
  type RollSurface,
  type SurfaceLayout,
  type TrackStyle,
} from '@xromdev/roll';
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

export interface PianoRollOptions extends RollOptions {
  /**
   * Keyboard span in MIDI numbers. Left out, it is chosen: all 88 keys when the
   * element is wide enough for believable keys, otherwise what the notes play.
   */
  range?: { from: number; to: number } | null;
  /**
   * Exactly this many px for keys and slip together. Left out, the keyboard
   * takes the depth its width entitles it to, up to 40% of the height.
   */
  keyboardHeight?: number;
  /** Name the C keys. Default true. */
  labelOctaves?: boolean;
  /** Colour a key while its note sounds (it goes down either way). Default true. */
  keyFlash?: boolean;
  /** Name each sounding note on the strip under its key. Default true. */
  showSounding?: boolean;
}

export type { TrackStyle };
export { DEFAULT_TRACKS, resolveTracks } from '@xromdev/roll';

/** Most of the height the keyboard may take when free to choose. */
const KEYBOARD_SHARE = 0.4;

/** The keyboard and the slip under it, as a roll's surface. */
class Keyboard implements RollSurface<PianoRollOptions> {
  readonly element: HTMLDivElement;
  readonly rootClass = 'xpr-roll';
  private readonly keysEl: HTMLDivElement;
  private readonly slipEl: HTMLDivElement;
  layoutNow: KeyboardLayout | null = null;
  private nodes = new Map<number, HTMLElement>();
  private colors = new Map<number, string>();
  private soundingNow: readonly number[] = [];
  private built = { labels: true, height: -1 };
  private showNames = true;

  constructor(doc: Document) {
    this.element = doc.createElement('div');
    this.keysEl = doc.createElement('div');
    this.keysEl.className = 'xpr-keys';
    this.slipEl = doc.createElement('div');
    this.slipEl.className = 'xpr-slip';
    this.element.append(this.keysEl, this.slipEl);
  }

  /** Keys, slip and falling area from the element's size — the keyboard's proportions decide. */
  layout(width: number, height: number, notes: readonly LaneNote[], o: PianoRollOptions): SurfaceLayout {
    const showSounding = o.showSounding !== false;
    this.showNames = showSounding;
    this.keysEl.dataset.keyFlash = o.keyFlash === false ? '0' : '1';
    const maxDepth = o.keyboardHeight ?? height * KEYBOARD_SHARE;
    const range = o.range ?? chooseRange(notes.map((n) => ({ midi: n.lane })), width);
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
    const slipHeight = Math.max(slipDepth(layout.whiteWidth), showSounding ? NAME_PLATE : 0);
    const keysHeight = Math.max(0, Math.min(maxDepth - slipHeight, layout.depth));
    this.keysEl.style.height = `${keysHeight}px`;
    this.slipEl.style.height = `${slipHeight}px`;

    // The keys are rebuilt only when the layout they depend on changes.
    const previous = this.layoutNow;
    const labels = o.labelOctaves !== false;
    const same =
      previous !== null &&
      previous.from === layout.from &&
      previous.to === layout.to &&
      previous.whiteWidth === layout.whiteWidth &&
      previous.left === layout.left &&
      this.built.labels === labels &&
      this.built.height === keysHeight;
    this.layoutNow = layout;
    if (!same) this.build(layout, keysHeight, labels);
    this.writeNames();

    return {
      fallHeight: Math.max(0, height - (o.keyboardHeight ?? keysHeight + slipHeight)),
      columns: layout.byMidi,
      nodes: this.nodes,
      semitonePx: semitones > 0 ? (layout.whiteWidth * layout.whiteCount) / semitones : 0,
      // A line at every C, a fainter one at F: where an octave's black keys start.
      guides: layout.keys
        .filter((key) => !key.black && (key.midi % 12 === 0 || key.midi % 12 === 5))
        .map((key) => ({ x: key.x, strong: key.midi % 12 === 0 })),
    };
  }

  private build(layout: KeyboardLayout, height: number, labels: boolean) {
    const doc = this.element.ownerDocument;
    const scale = layout.whiteWidth / SHADOW_REFERENCE_WIDTH;
    const nodes = new Map<number, HTMLElement>();
    const elements: HTMLElement[] = [];
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
      elements.push(node);
      nodes.set(key.midi, node);
    }
    this.keysEl.replaceChildren(...elements);
    this.nodes = nodes;
    this.built = { labels, height };
    this.soundingNow = [];
  }

  /** Same key, lit before and after: the press cannot show it, so replay the strike. */
  strike(_lane: number, node: HTMLElement, _note: LitLane, repeat: boolean) {
    if (repeat) node.dataset.restrike = node.dataset.restrike === 'a' ? 'b' : 'a';
  }

  sounding(lanes: readonly number[], lit: ReadonlyMap<number, LitLane>) {
    this.soundingNow = lanes;
    for (const lane of lanes) this.colors.set(lane, lit.get(lane)?.color ?? '');
    this.writeNames();
  }

  /** The sounding notes' names on the slip, each under its key. */
  private writeNames() {
    const layout = this.layoutNow;
    if (!layout || !this.showNames) {
      if (this.slipEl.childElementCount) this.slipEl.replaceChildren();
      return;
    }
    const doc = this.element.ownerDocument;
    const spans: HTMLElement[] = [];
    for (const midi of this.soundingNow) {
      const key = layout.byMidi.get(midi);
      if (!key) continue;
      const span = doc.createElement('span');
      span.className = 'xpr-name';
      span.textContent = noteName(midi);
      span.style.left = `${key.x + key.width / 2}px`;
      span.style.color = this.colors.get(midi) || '#cfd3e2';
      spans.push(span);
    }
    this.slipEl.replaceChildren(...spans);
  }
}

export class PianoRollView extends RollView<PianoRollOptions> {
  constructor(host: HTMLElement, options: PianoRollOptions = {}) {
    super(host, new Keyboard(host.ownerDocument), options);
  }

  /** The notes of the piece, in any order — by `midi`. */
  override setNotes(notes: readonly (RollNote | LaneNote)[]) {
    super.setNotes(notes.map((note) => ('midi' in note ? { ...note, lane: note.midi } : note)));
  }

  /** Where every key is, for anything drawn in line with them. */
  get keyboard(): KeyboardLayout | null {
    return (this.surface as Keyboard).layoutNow;
  }
}

export type { LitLane };

// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PianoRollView, type RollNote } from '../src/view.js';

/** A 2D context that records how often a frame was cleared, and otherwise does nothing. */
let clears = 0;
beforeAll(() => {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: (target: Record<string | symbol, unknown>, key) => {
        if (key in target) return target[key];
        if (key === 'clearRect') return () => clears++;
        if (key === 'createLinearGradient' || key === 'createPattern') return () => gradient;
        return noop;
      },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    }
  );
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function roll(notes: RollNote[], onSoundingChange?: (m: readonly number[]) => void) {
  const host = document.createElement('div');
  document.body.append(host);
  const view = new PianoRollView(host, { range: { from: 48, to: 72 }, sparks: false, onSoundingChange });
  // jsdom lays nothing out; give the view the size a browser would.
  (view as unknown as { resize(w: number, h: number): void }).resize(800, 400);
  view.setNotes(notes);
  const key = (midi: number) => view.element.querySelectorAll<HTMLElement>('.xpr-key')[view.keyboard!.keys.findIndex((k) => k.midi === midi)];
  return { view, key };
}

describe('PianoRollView', () => {
  it('lights the keys whose notes are sounding, in their track colour', () => {
    const { view, key } = roll([
      { midi: 60, start: 0, duration: 1, track: 'pulse1' },
      { midi: 64, start: 0.5, duration: 0.5, track: 'triangle' },
    ]);
    view.render(0.25);
    expect(key(60).dataset.lit).toBe('1');
    expect(key(64).dataset.lit).toBe('0');
    expect(key(60).style.getPropertyValue('--flash')).toBe('#3987e5');
    view.render(0.75);
    expect(key(64).dataset.lit).toBe('1');
    view.render(1.5);
    expect(key(60).dataset.lit).toBe('0');
    expect(key(64).dataset.lit).toBe('0');
  });

  it('replays the strike for a note repeated with no gap', () => {
    const { view, key } = roll([
      { midi: 60, start: 0, duration: 0.5 },
      { midi: 60, start: 0.5, duration: 0.5 },
    ]);
    view.render(0.25);
    expect(key(60).dataset.restrike).toBeUndefined();
    view.render(0.75);
    expect(key(60).dataset.lit).toBe('1');
    expect(key(60).dataset.restrike).toBe('a');
  });

  it('reports the sounding set only when it changes, and names it on the slip', () => {
    const changes = vi.fn();
    const { view } = roll(
      [
        { midi: 60, start: 0, duration: 1 },
        { midi: 67, start: 0, duration: 1 },
      ],
      changes
    );
    view.render(0.1);
    view.render(0.2);
    view.render(0.3);
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenLastCalledWith([60, 67]);
    const names = [...view.element.querySelectorAll('.xpr-name')].map((n) => n.textContent);
    expect(names).toEqual(['C4', 'G4']);
    view.render(2);
    expect(changes).toHaveBeenLastCalledWith([]);
  });

  it('draws nothing while the clock stands still', () => {
    const { view } = roll([{ midi: 60, start: 0, duration: 1 }]);
    view.render(0.5);
    const before = clears;
    view.render(0.5);
    view.render(0.5);
    expect(clears).toBe(before);
    view.render(0.51);
    expect(clears).toBe(before + 1);
  });

  it('builds 25 keys for two octaves and a C, blacks after whites', () => {
    const { view } = roll([]);
    const keys = view.element.querySelectorAll<HTMLElement>('.xpr-key');
    expect(keys).toHaveLength(25);
    expect([...keys].filter((k) => k.dataset.black === '1')).toHaveLength(10);
  });
});

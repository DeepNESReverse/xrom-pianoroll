'use client';

/**
 * `@xromdev/pianoroll/react` — the view as a component.
 *
 *   <PianoRoll notes={notes} clock={() => audio.currentTime} height={420} />
 *
 * Give it `clock` and it follows that clock on its own animation frames — no
 * React render per frame at all. Give it `time` instead to drive it yourself
 * (a scrubber, a paused picture); each change of `time` draws one frame.
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { PianoRollView, type PianoRollOptions, type RollNote } from './view.js';

export interface PianoRollProps extends Omit<PianoRollOptions, 'onSoundingChange'> {
  notes: readonly RollNote[];
  /** Draw this moment, in seconds. Ignored while `clock` is given. */
  time?: number;
  /** Follow this clock, in seconds, on every animation frame. */
  clock?: () => number;
  /** Height in px, or any CSS length. Default 420. */
  height?: number | string;
  onSoundingChange?: (midis: readonly number[]) => void;
  /** The view itself, for anything the props do not cover. */
  onView?: (view: PianoRollView | null) => void;
  className?: string;
  style?: CSSProperties;
}

export function PianoRoll({
  notes,
  time,
  clock,
  height = 420,
  onSoundingChange,
  onView,
  className,
  style,
  lookAhead,
  range,
  tracks,
  keyboardHeight,
  releaseMs,
  labelOctaves,
  keyFlash,
  showSounding,
  sparks,
}: PianoRollProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<PianoRollView | null>(null);
  // The latest callbacks, so a new function each render does not rebuild anything.
  const sounding = useRef(onSoundingChange);
  sounding.current = onSoundingChange;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    const v = new PianoRollView(host.current!, { onSoundingChange: (m) => sounding.current?.(m) });
    view.current = v;
    onViewRef.current?.(v);
    return () => {
      v.destroy();
      view.current = null;
      onViewRef.current?.(null);
    };
  }, []);

  useEffect(() => {
    view.current?.setOptions({ lookAhead, range, tracks, keyboardHeight, releaseMs, labelOctaves, keyFlash, showSounding, sparks });
  }, [lookAhead, range, tracks, keyboardHeight, releaseMs, labelOctaves, keyFlash, showSounding, sparks]);

  useEffect(() => {
    view.current?.setNotes(notes);
  }, [notes]);

  useEffect(() => {
    if (!clock && time !== undefined) view.current?.render(time);
  }, [time, clock]);

  useEffect(() => {
    const v = view.current;
    if (!clock || !v) return;
    v.play(clock);
    return () => v.stop();
  }, [clock]);

  return <div ref={host} className={className} style={{ height, ...style }} />;
}

export { PianoRollView, type PianoRollOptions, type RollNote } from './view.js';

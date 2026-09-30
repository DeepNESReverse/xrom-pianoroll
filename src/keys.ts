/**
 * How a key looks: its faces up and down, its shadows, and how far it tilts.
 *
 * Plain strings, for any renderer: `keyStyle` hands them to the key as CSS
 * custom properties, and `pianoroll.css` decides WHEN each one applies — the
 * swap from up to down happens in CSS, so pressing a key never costs a render.
 */

import type { KeyGeometry } from './keyboard.js';

/**
 * The two faces of a key, up and down.
 *
 * What says a key is standing UP is the bright lip along its front edge; what
 * says it has gone down is that lip turning into shade cast from above. The
 * pressed state is therefore not the same face dimmed — it is a different
 * gradient, and it is worth the four constants.
 *
 * Both variants of a pair carry the same number of colour stops, and the two
 * shadow lists the same number of shadows, so the browser interpolates them
 * instead of snapping. The press is 25ms and would survive a snap; the release
 * is a tenth of a second and would not.
 *
 * The light ACROSS a white key, over the gradient that runs along it.
 *
 * Same source as everything else — high and to the left — so the left edge
 * catches it and the right edge, where the next key's shadow starts, gives it
 * up. Two layers rather than one gradient because along and across are two
 * different facts about the key, and a single gradient that did both would be
 * unreadable to edit.
 */
export const WHITE_SIDE = (strength: number) =>
  `linear-gradient(90deg, rgba(255,255,255,${0.5 * strength}) 0%, rgba(255,255,255,0) 22%, rgba(0,0,0,0) 72%, rgba(0,0,0,${0.09 * strength}) 100%)`;

export const WHITE_FACE = `${WHITE_SIDE(1)}, linear-gradient(180deg, #dcdce4 0%, #edeef3 18%, #fbfbfe 100%)`;
// Pressed, the key is down in its slot and takes less of the light across it.
export const WHITE_FACE_DOWN = `${WHITE_SIDE(0.4)}, linear-gradient(180deg, #c2c2ce 0%, #dcdce6 26%, #e2e2ea 100%)`;
/**
 * A black key is a BAR, not a black rectangle, and three planes of it are in
 * view at once.
 *
 * Along the top runs the face itself. Down the left is the edge the light
 * catches — one bright line, and it is most of what makes the key look solid.
 * Down the right is the side wall, turned away from the light and darker than
 * the face. And at the near end is the front facet, the cut end of the bar,
 * which is the lightest thing on the whole key because it faces up and out.
 *
 * All of it is background layers on one div. The alternative is child elements
 * per plane, which is three more nodes on every one of 36 keys for something
 * that never moves independently.
 */
export const BLACK_SIDE = (strength: number) =>
  `linear-gradient(90deg, rgba(255,255,255,${0.5 * strength}) 0%, rgba(255,255,255,${0.13 * strength}) 9%, rgba(255,255,255,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,${0.5 * strength}) 100%)`;

export const BLACK_FACE = `${BLACK_SIDE(1)}, linear-gradient(180deg, #14141c 0%, #1a1a24 64%, #22222f 86%, #3e3e4d 95%, #4c4c5c 100%)`;
// Down in the slot the whole bar is in shade: the bright edge and the front
// facet both give most of it up, which is what a key looks like once the light
// is passing over it rather than onto it.
export const BLACK_FACE_DOWN = `${BLACK_SIDE(0.35)}, linear-gradient(180deg, #09090f 0%, #131320 64%, #191926 86%, #232331 95%, #2a2a38 100%)`;

/**
 * Every shadow here is a LENGTH, and a length has to know how big the key is.
 *
 * They were tuned on the roll's own keyboard, white keys 22px across, and a
 * 7px shadow band beside a 14px black key is half its width. Left at 7px on the
 * workbench, where a key is four times that, the same band is a hairline; left
 * at 7px on a keyboard squeezed to 9px keys it swallows the key. So the numbers
 * are written at the reference size and scaled to the real one, which is also
 * what lets the workbench show what the roll will do.
 */
export const SHADOW_REFERENCE_WIDTH = 22;

const px = (n: number, scale: number) => `${Math.round(n * scale * 10) / 10}px`;

/** Front lip, and no slot walls — the two transparent shadows hold their place. */
export const whiteShade = (scale: number) =>
  `inset ${px(4, scale)} 0 ${px(5, scale)} ${px(-4, scale)} rgba(0,0,0,0), inset ${px(-4, scale)} 0 ${px(5, scale)} ${px(-4, scale)} rgba(0,0,0,0), inset 0 ${px(-6, scale)} ${px(8, scale)} ${px(-6, scale)} rgba(0,0,0,0.45)`;
/** The walls of the slot it has gone down into, and shade from above. */
export const whiteShadeDown = (scale: number) =>
  `inset ${px(4, scale)} 0 ${px(5, scale)} ${px(-2, scale)} rgba(0,0,0,0.38), inset ${px(-4, scale)} 0 ${px(5, scale)} ${px(-2, scale)} rgba(0,0,0,0.38), inset 0 ${px(7, scale)} ${px(8, scale)} ${px(-6, scale)} rgba(0,0,0,0.55)`;
/**
 * A black key STANDS ON the whites, so its shadow is a readout of how far up it
 * is — and it collapsing is what reads as the key descending, at any size.
 *
 * The light is high and to the left, so the shadow goes SIDEWAYS: a soft band
 * lying on the white key to the right, running the black key's whole length and
 * giving out with distance from it. Look at a photograph of a keyboard and that
 * band is most of what you see.
 *
 * It was a drop shadow offset down and to the right first, which is what a card
 * floating over a page does. A black key is not floating over anything — it is
 * resting on the white keys — so the downward offset put the shadow out past
 * the key's own end, where nothing was casting it. No vertical offset, a wide
 * blur and a negative spread instead: the band is the width of the gap between
 * the keys plus the blur, and it has no edge of its own.
 */
export const blackShade = (scale: number) =>
  `${px(7, scale)} 0 ${px(8, scale)} ${px(-1, scale)} rgba(0,0,0,0.5), inset 0 ${px(-4, scale)} ${px(6, scale)} ${px(-4, scale)} rgba(0,0,0,0.5), inset 0 0 0 0 rgba(0,0,0,0)`;
// Down in the slot, the key is nearly level with the whites and the band closes
// up to almost nothing — which is the shadow doing the same work as the tilt.
export const blackShadeDown = (scale: number) =>
  `${px(2, scale)} 0 ${px(3, scale)} ${px(-1, scale)} rgba(0,0,0,0.45), inset 0 ${px(-4, scale)} ${px(6, scale)} ${px(-4, scale)} rgba(0,0,0,0), inset 0 ${px(5, scale)} ${px(6, scale)} ${px(-5, scale)} rgba(0,0,0,0.9)`;

/**
 * How far the front of a key swings down, as an angle.
 *
 * A key is a lever: the far end is pinned under the falling area and only the
 * end nearest the reader moves. An angle rather than a distance because it is
 * the one form of this that survives being resized — the same 3.4° looks right
 * on a 78px keyboard and on a 340px one.
 *
 * A real white key drops ~10mm at the front over the ~145mm you can see. A
 * black key drops the same distance over a much shorter lever, so its angle is
 * bigger, and that difference is visible on a keyboard where both are moving.
 */
export const DIP_WHITE = '3.4deg';
export const DIP_BLACK = '5.4deg';

/**
 * How far away the eye is, as a multiple of the keyboard's depth.
 *
 * The angle is scale-free but the projection is not: an eye 1500px away barely
 * bends a key 78px long. Tying the distance to the keyboard's own depth is what
 * makes the press look the same on every size of roll.
 */
export const EYE_DISTANCE = 4.4;

/**
 * Every style a key's element needs, as CSS property → value.
 *
 * Positions in px, faces and shadows as the custom properties `pianoroll.css`
 * reads. `height` is the keyboard's depth; `scale` is the white key's width
 * over `SHADOW_REFERENCE_WIDTH`.
 */
export function keyStyle(key: KeyGeometry, height: number, scale: number): Record<string, string> {
  return {
    position: 'absolute',
    left: `${key.x}px`,
    width: `${Math.max(1, key.width - (key.black ? 0 : 1))}px`,
    top: '0px',
    height: `${height * key.height}px`,
    border: key.black ? '1px solid #000' : '1px solid #9a9aa8',
    'border-top': 'none',
    'border-radius': '0 0 4px 4px',
    'z-index': key.black ? '2' : '1',
    '--key-face': key.black ? BLACK_FACE : WHITE_FACE,
    '--key-face-down': key.black ? BLACK_FACE_DOWN : WHITE_FACE_DOWN,
    '--key-shade': key.black ? blackShade(scale) : whiteShade(scale),
    '--key-shade-down': key.black ? blackShadeDown(scale) : whiteShadeDown(scale),
    '--key-dip': key.black ? DIP_BLACK : DIP_WHITE,
    '--key-eye': `${Math.round(height * EYE_DISTANCE)}px`,
  };
}

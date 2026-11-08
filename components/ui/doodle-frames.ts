// The four frames of each animated doodle. Every doodle is a single filled outline, so a frame moves
// the whole drawing (shift, turn, scale, or bend it from its base) and may add a few small marks
// drawn at the doodle's own line weight. Coordinates are in the doodle's 100×100 box.
import type { DoodleName } from "./doodle";

export interface Painter {
  g: CanvasRenderingContext2D;
  /** Paints the doodle under the current transform. */
  fill: () => void;
  /** Strokes a small mark (SVG path data) at the doodle's line weight. */
  mark: (d: string) => void;
  /** A filled dot. */
  dot: (x: number, y: number, r: number) => void;
  /** Paints the doodle with every point of its outline moved by `to`. */
  warp: (to: (x: number, y: number) => [number, number]) => void;
  /**
   * Paints the doodle bent sideways from a rooted base: each row shifts by `amount` scaled by how
   * far above `base` it sits, eased so the top swings most, like a stem in the wind.
   */
  bend: (amount: number, base?: number, top?: number) => void;
}

type Frame = (p: Painter) => void;

interface Move {
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  /** The point the turn and scale happen around; the box centre unless given. */
  ox?: number;
  oy?: number;
}

/** Runs `body` with the drawing moved. */
function move(p: Painter, m: Move, body: () => void) {
  const { x = 0, y = 0, rotate = 0, scale = 1, sx = 1, sy = 1, ox = 50, oy = 50 } = m;
  p.g.save();
  p.g.translate(ox + x, oy + y);
  p.g.rotate((rotate * Math.PI) / 180);
  p.g.scale(sx * scale, sy * scale);
  p.g.translate(-ox, -oy);
  body();
  p.g.restore();
}

/** How far a row at `y` shifts when the doodle bends by `amount`. */
export const bendShift = (y: number, amount: number, base = 94, top = 6) =>
  amount * Math.min(1, Math.max(0, (base - y) / (base - top))) ** 1.6;

const still = (m: Move): Frame => (p) => move(p, m, p.fill);
const bent = (amount: number, base?: number, extra?: (p: Painter) => void): Frame => (p) => {
  p.bend(amount, base);
  extra?.(p);
};
const drop = (x: number, y: number, r: number) =>
  `M ${x} ${y - 1.8 * r} C ${x + 0.4 * r} ${y - r} ${x + r} ${y - 0.5 * r} ${x + r} ${y} A ${r} ${r} 0 0 1 ${x - r} ${y} C ${x - r} ${y - 0.5 * r} ${x - 0.4 * r} ${y - r} ${x} ${y - 1.8 * r} Z`;

/**
 * Pushes points away from (cx, cy) most in the `facing` direction (degrees) and least opposite it.
 * Points within the centre ring are left where they are.
 */
function swell(cx: number, cy: number, facing: number) {
  const f = (facing * Math.PI) / 180;
  return (x: number, y: number): [number, number] => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const ring = Math.min(1, Math.max(0, (r - 12) / 10));
    const toward = ((1 + Math.cos(Math.atan2(dy, dx) - f)) / 2) ** 1.5;
    const k = 1 + ring * (0.28 * toward - 0.22);
    return [cx + dx * k, cy + dy * k];
  };
}

export const DOODLE_FRAMES: Record<DoodleName, Frame[]> = {
  // Follows the sun across the sky, then bows its head for the night.
  clover: [bent(-12), bent(0), bent(12), bent(22)],

  // The head spins a quarter turn each frame around its hub while the stem stays put. The stem below
  // the hub is cut out of the turning head and drawn on its own, unmoved.
  pinwheel: [0, 90, 180, 270].map((rotate): Frame => (p) => {
    move(p, { rotate, ox: 50, oy: 36 }, () => {
      p.g.save();
      p.g.beginPath();
      p.g.rect(-20, -20, 140, 140);
      p.g.moveTo(48.8, 47);
      p.g.lineTo(57.5, 47);
      p.g.lineTo(57.5, 110);
      p.g.lineTo(48.8, 110);
      p.g.closePath();
      p.g.clip("evenodd");
      p.fill();
      p.g.restore();
    });
    p.g.save();
    p.g.beginPath();
    p.g.rect(48.8, 47, 8.7, 53);
    p.g.clip();
    p.fill();
    p.g.restore();
  }),

  // A raindrop lands on the frond's tip; the frond dips under it, flicks it off, and springs back.
  fern: [
    bent(0, undefined, (p) => p.mark(drop(50, 3, 2.4))),
    bent(9, undefined, (p) => p.mark(drop(58, 8, 2.4))),
    bent(-5, undefined, (p) => p.mark(drop(86, 22, 2.4))),
    bent(1, undefined, (p) => p.mark("M 84 92 l -3 -3 M 88 92 l 3 -3")),
  ],

  // Shakes the snow off its branches.
  pine: [
    (p) => {
      p.fill();
      [[33, 50], [67, 50], [38, 30], [62, 30], [50, 10]].forEach(([x, y]) => p.dot(x!, y! - 4, 2.6));
    },
    (p) => {
      move(p, { rotate: -5, ox: 50, oy: 94 }, p.fill);
      [[28, 48], [64, 44], [35, 24], [60, 22]].forEach(([x, y]) => p.dot(x!, y!, 2.4));
    },
    (p) => {
      move(p, { rotate: 5, ox: 50, oy: 94 }, p.fill);
      [[20, 70], [80, 64], [16, 46], [84, 40]].forEach(([x, y]) => p.dot(x!, y!, 2.2));
    },
    (p) => {
      p.fill();
      [[14, 92], [86, 92]].forEach(([x, y]) => p.dot(x!, y!, 2));
    },
  ],

  // Twinkles as its light passes through moving air.
  star: [
    still({}),
    still({ scale: 0.86, rotate: 10 }),
    (p) => {
      move(p, { scale: 1.04 }, p.fill);
      p.mark("M 50 1 L 50 5 M 97 46 L 93 47 M 4 46 L 8 47 M 84 96 L 81 92 M 16 96 L 19 92");
    },
    still({ scale: 0.95, rotate: -4 }),
  ],

  // Lub-dub: a big beat, a smaller one, then rest.
  heart: [still({ scale: 0.9 }), still({ scale: 1.05 }), still({ scale: 0.96 }), still({ scale: 0.9 })],

  // Opens petal by petal: a swell travels round the flower, so each petal grows to full size and
  // eases back in turn, while the centre stays put.
  blossom: [-90, 0, 90, 180].map((facing): Frame => (p) => p.warp(swell(51, 48, facing))),

  // "Day's eye": closes its petals as the light goes, then opens.
  daisy: [still({}), still({ scale: 0.8 }), still({ scale: 0.62 }), still({ scale: 0.82 })],

  // Bends with a gust so it does not snap, then springs back.
  grass: [bent(0, 86), bent(10, 86), bent(17, 86), bent(-5, 86)],

  // Swirls like water running down a drain.
  spiral: [0, 90, 180, 270].map((rotate, i) => still({ rotate, scale: [1, 0.97, 0.94, 0.97][i] })),
};

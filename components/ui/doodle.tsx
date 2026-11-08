// Hand-drawn doodles painted onto a square canvas. Each doodle is a filled outline in a 100×100 box
// (see doodle-paths.ts), so they all read at one size and `size` only scales the box.
import { useEffect, useRef } from "react";
import { bendShift, DOODLE_FRAMES, type Painter } from "./doodle-frames";
import { DOODLE_PATHS } from "./doodle-paths";

export type DoodleName = keyof typeof DOODLE_PATHS;
export const DOODLE_NAMES = Object.keys(DOODLE_PATHS) as DoodleName[];

/** The line weight of the drawings themselves, in box units; added marks match it. */
const LINE = 2.8;

interface DoodleProps {
  name: DoodleName;
  /** Width and height in CSS pixels; the canvas is always square. */
  size?: number;
  color?: string;
  /**
   * Extra line weight in CSS pixels. The lines are drawn into the outlines, so they can only be
   * thickened: an outline of this width in the same colour is traced around them.
   */
  weight?: number;
}

/** Sizes the canvas for the screen and returns a painter working in the 100×100 box. */
function painter(canvas: HTMLCanvasElement, { name, size = 24, color = "#000000", weight = 0 }: DoodleProps) {
  const g = canvas.getContext("2d");
  if (!g) return undefined;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const extra = (weight * 100) / size;
  const scale = (size / 100) * dpr;
  const path = new Path2D(DOODLE_PATHS[name]);
  const fillOn = (target: CanvasRenderingContext2D, shape = path) => {
    target.fill(shape);
    if (extra > 0) target.stroke(shape);
  };
  // Bending paints the doodle once on a spare canvas, then copies it across one device-pixel row
  // at a time, each row shifted, so the bend has no seams.
  const spare = document.createElement("canvas");
  spare.width = canvas.width;
  spare.height = canvas.height;
  const s = spare.getContext("2d");
  const p: Painter = {
    g,
    fill: () => fillOn(g),
    bend: (amount, base, top) => {
      if (!s) return fillOn(g);
      s.setTransform(scale, 0, 0, scale, 0, 0);
      s.clearRect(0, 0, 100, 100);
      s.fillStyle = g.fillStyle;
      s.strokeStyle = g.strokeStyle;
      s.lineWidth = extra;
      s.lineJoin = "round";
      fillOn(s);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (let row = 0; row < spare.height; row++) {
        const dx = bendShift((row + 0.5) / scale, amount, base, top) * scale;
        g.drawImage(spare, 0, row, spare.width, 1, dx, row, spare.width, 1);
      }
      g.restore();
    },
    mark: (d) => {
      g.save();
      g.lineWidth = LINE + extra;
      g.stroke(new Path2D(d));
      g.restore();
    },
    warp: (to) => {
      // The outlines use only absolute M, C, L and Z commands, so every number pair is a point.
      const moved = DOODLE_PATHS[name].replace(/[MCL][^MCLZ]*/g, (part) => {
        const nums = part.slice(1).trim().split(/\s+/).map(Number);
        const out: number[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) out.push(...to(nums[i]!, nums[i + 1]!));
        return part[0] + out.map((v) => Math.round(v * 100) / 100).join(" ");
      });
      fillOn(g, new Path2D(moved));
    },
    dot: (x, y, r) => {
      g.beginPath();
      g.arc(x, y, r + extra / 2, 0, 2 * Math.PI);
      g.fill();
    },
  };
  /** Clears the canvas and paints with `draw`. */
  return (draw: (p: Painter) => void) => {
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, 100, 100);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = extra;
    g.lineJoin = "round";
    g.lineCap = "round";
    draw(p);
  };
}

export function Doodle(props: DoodleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { name, size, color, weight } = props;

  useEffect(() => {
    if (canvasRef.current) painter(canvasRef.current, { name, size, color, weight })?.((p) => p.fill());
  }, [name, size, color, weight]);

  return <canvas ref={canvasRef} role="img" aria-label={name} />;
}

const FPS = 4;

/**
 * The doodle acting out its four-frame story at four frames a second. With reduced motion asked
 * for, it holds its first frame.
 */
export function AnimatedDoodle(props: DoodleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { name, size, color, weight } = props;

  useEffect(() => {
    const paint = canvasRef.current && painter(canvasRef.current, { name, size, color, weight });
    if (!paint) return;
    const frames = DOODLE_FRAMES[name];
    let frame = 0;
    const tick = () => {
      paint(frames[frame]!);
      frame = (frame + 1) % frames.length;
    };
    tick();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(tick, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [name, size, color, weight]);

  return <canvas ref={canvasRef} role="img" aria-label={name} />;
}

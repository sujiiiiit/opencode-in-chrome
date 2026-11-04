// Ported from sujiiiiit/openscreen-studio (src/components/ui/squiggle-loader.tsx).
// Draws a scribbled squiggle on a canvas; has no external dependencies.
import React, { useRef, useEffect } from "react";

// Define the component's props with TypeScript
interface SquiggleLoaderProps {
  // Visual Customization
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  tempo?: number;
  acceleration?: number;
  tailLength?: number;
  style?: React.CSSProperties;
}

// Default animation parameters from the original script
const defaultParams = {
  width: 24,
  height: 16,
  tempo: 18,
  minLoopSize: 24,
  maxLoopSize: 32,
  acceleration: 0.3,
  tailLength: 72,
  strokeWidth: 1.5,
  loopSpacing: 1.3,
  modulationSpeed: 0.4,
  modulationPhaseOffset: 2,
  tempoModulation: 10,
  accelerationModulation: 0.12,
};

const SquiggleLoader: React.FC<SquiggleLoaderProps> = ({
  width = defaultParams.width,
  height = defaultParams.height,
  strokeColor = "#000000",
  strokeWidth = defaultParams.strokeWidth,
  tempo = defaultParams.tempo,
  acceleration = defaultParams.acceleration,
  tailLength = defaultParams.tailLength,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(2, 2);

    let animationFrameId: number;
    let isVisible = true;

    const {
      minLoopSize,
      maxLoopSize,
      loopSpacing,
      modulationSpeed,
      modulationPhaseOffset,
      tempoModulation,
      accelerationModulation,
    } = defaultParams;

    const derivedParams = (() => {
      const e = width,
        t = height,
        i = t / 2,
        n = tempo;
      const r = (e / 200) * 8 * loopSpacing,
        a = acceleration;
      const l = Math.min((minLoopSize / 100) * t, 0.45 * t);
      const m = Math.min((maxLoopSize / 100) * t, 0.45 * t);
      return {
        W: e,
        H: t,
        BASE_Y: i,
        FRAMES_PER_RAD: n,
        SUB_STEPS: 3,
        DX_PER_RAD: r,
        ACC_FACTOR: a,
        MIN_R: l,
        MAX_R: m,
        R_BASE: (l + m) / 2,
        R_VAR: (m - l) / 2,
        R_FREQ1: 0.2,
        R_FREQ2: 0.1,
        TAIL_RADS: Math.max(3, tailLength * Math.min(1, e / 200)),
        PURGE_PAD_R: 5,
        START_OFFSET: 0.95 * e - m,
      };
    })();

    const modulationParams = {
      modulationSpeed,
      modulationPhaseOffset,
      tempoModulation,
      accelerationModulation,
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    let I = 0,
      x = performance.now();
    const P = performance.now(),
      b = 1000;
    const R: ({ x: number; y: number; t: number } | undefined)[] = new Array(b);
    let O = 0,
      F = 0,
      U = 0,
      E = 0,
      L = 0;
    L = L;

    const N = (e: number) => {
      const t = (n: number) => {
        const val =
          0.6 * Math.sin(derivedParams.R_FREQ1 * n) +
          0.4 * Math.sin(derivedParams.R_FREQ2 * n + 1.1);
        return Math.max(
          derivedParams.MIN_R,
          derivedParams.R_BASE + derivedParams.R_VAR * val,
        );
      };
      const radius = t(e);
      return {
        x: e * derivedParams.DX_PER_RAD + radius * Math.cos(e),
        y: derivedParams.BASE_Y - radius * Math.sin(e),
        t: e,
      };
    };

    const animate = () => {
      const t_now = performance.now();
      const o_delta = Math.min((t_now - x) / 1000, 0.1);
      x = t_now;

      const r_time = (t_now - P) / 1000;
      const s_mod = Math.sin(
        2 * Math.PI * modulationParams.modulationSpeed * r_time +
          modulationParams.modulationPhaseOffset,
      );
      const u_tempo = tempo + modulationParams.tempoModulation * s_mod;
      const p_accel =
        derivedParams.ACC_FACTOR +
        modulationParams.accelerationModulation * s_mod;
      const f_theta_rate = (Math.PI / Math.max(1, u_tempo)) * 60;
      const m_substeps =
        E > 5
          ? Math.max(1, Math.floor(derivedParams.SUB_STEPS / 2))
          : derivedParams.SUB_STEPS;
      const g_d_theta =
        (f_theta_rate * o_delta * (1 + p_accel * -Math.sin(I))) / m_substeps;

      for (let i = 0; i < m_substeps; i++) {
        I += g_d_theta;
        R[F] = N(I);
        F = (F + 1) % b;
        U < b ? U++ : (O = (O + 1) % b);
      }

      const A = I - derivedParams.TAIL_RADS;

      // --- FIX STARTS HERE ---
      // Safely purge old points from the start of the buffer.
      // This loop was the source of the crash.
      while (U > 0) {
        const point = R[O];
        // Stop if the point doesn't exist or is new enough to be visible
        if (!point || point.t >= A - derivedParams.PURGE_PAD_R) {
          break;
        }
        // Otherwise, this point is too old, so "remove" it
        O = (O + 1) % b;
        U--;
      }
      // --- FIX ENDS HERE ---

      const y = I * derivedParams.DX_PER_RAD - derivedParams.START_OFFSET;
      L = y;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(-y, 0);

      // Robust drawing logic
      if (U > 0) {
        let startIndex = O;
        let pointsBeforeVisible = 0;

        // Find the first point that should be visible on screen
        while (pointsBeforeVisible < U) {
          const point = R[startIndex];
          if (!point || point.t >= A) break;
          startIndex = (startIndex + 1) % b;
          pointsBeforeVisible++;
        }

        if (pointsBeforeVisible < U) {
          const firstVisiblePoint = R[startIndex];
          let startPoint = firstVisiblePoint;

          // Interpolate to find the exact start if it's between two points
          if (pointsBeforeVisible > 0) {
            const prevPoint = R[(startIndex - 1 + b) % b];
            if (prevPoint && firstVisiblePoint) {
              const ratio =
                (A - prevPoint.t) / (firstVisiblePoint.t - prevPoint.t);
              startPoint = {
                x: prevPoint.x + (firstVisiblePoint.x - prevPoint.x) * ratio,
                y: prevPoint.y + (firstVisiblePoint.y - prevPoint.y) * ratio,
                t: A,
              };
            }
          }

          if (startPoint) {
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            let currentIndex = startIndex;
            for (let i = pointsBeforeVisible; i < U; i++) {
              const point = R[currentIndex];
              if (point) ctx.lineTo(point.x, point.y);
              currentIndex = (currentIndex + 1) % b;
            }
            ctx.stroke();
          }
        }
      }

      ctx.restore();
      E = performance.now() - t_now > 16 ? E + 1 : Math.max(0, E - 0.1);

      if (isVisible) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        x = performance.now();
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    width,
    height,
    strokeColor,
    strokeWidth,
    tempo,
    acceleration,
    tailLength,
  ]);

  return <canvas ref={canvasRef} />;
};

export default SquiggleLoader;

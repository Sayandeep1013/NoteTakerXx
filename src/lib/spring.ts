// Damped-spring easing for the Web Animations API.
//
// We simulate x'' = -k(x - 1) - c·x' from x=0 at rest and sample it into a CSS
// `linear()` easing, so an ordinary animation follows real spring physics:
// fast start, overshoot, a few decaying wobbles, then settle. Browsers without
// `linear()` get a fixed overshooting cubic-bezier instead.

export interface Spring {
  /** Spring stiffness (higher = faster). */
  stiffness: number;
  /** Damping ratio: < 1 bounces (lower = more wobble), 1 = no overshoot. */
  bounce: number;
}

export interface SpringTiming {
  duration: number;
  easing: string;
}

const cache = new Map<string, SpringTiming>();
let linearSupported: boolean | null = null;

function supportsLinear() {
  if (linearSupported === null) {
    linearSupported = typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 0.5, 1)");
  }
  return linearSupported;
}

export function spring({ stiffness, bounce }: Spring): SpringTiming {
  const key = `${stiffness}|${bounce}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let timing: SpringTiming;
  if (!supportsLinear()) {
    timing = { duration: 520, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" };
  } else {
    const damping = 2 * bounce * Math.sqrt(stiffness);
    const dt = 1 / 240;
    let x = 0, v = 0, t = 0;
    const samples: number[] = [0];
    // Integrate until it has visibly settled (or 2s, whichever first).
    while (t < 2) {
      const a = -stiffness * (x - 1) - damping * v;
      v += a * dt;
      x += v * dt;
      t += dt;
      samples.push(x);
      if (Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.02) break;
    }
    samples[samples.length - 1] = 1;
    // ~60 points is plenty for a smooth curve.
    const step = Math.max(1, Math.floor(samples.length / 60));
    const points: string[] = [];
    for (let i = 0; i < samples.length; i += step) points.push(samples[i].toFixed(4));
    if (points[points.length - 1] !== "1.0000") points.push("1");
    timing = { duration: Math.round(t * 1000), easing: `linear(${points.join(", ")})` };
  }
  cache.set(key, timing);
  return timing;
}

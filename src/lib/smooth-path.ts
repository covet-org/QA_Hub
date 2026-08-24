export interface Point {
  x: number;
  y: number;
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson tangents) as an SVG path.
 *
 * Monotone specifically, not a plain Catmull-Rom or cardinal spline: the
 * bug-trend lines are cumulative counts, and an overshooting spline would
 * draw the curve dipping below a total the release had already reached.
 * That is not a cosmetic issue — it is the chart lying about the data.
 *
 * Pure, so the geometry can be tested without a browser.
 */
export function smoothPath(points: Point[]): string {
  if (points.length < 2) {
    return points.length ? `M${points[0].x},${points[0].y}` : "";
  }

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1].x - points[i].x || 1e-6;
    dx.push(h);
    slope.push((points[i + 1].y - points[i].y) / h);
  }

  const tangents: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      // Local extremum, or a flat run: zero tangent, never overshoot.
      tangents.push(0);
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangents.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  tangents.push(slope[n - 2]);

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    d += ` C${points[i].x + h / 3},${points[i].y + (tangents[i] * h) / 3} ${
      points[i + 1].x - h / 3
    },${points[i + 1].y - (tangents[i + 1] * h) / 3} ${points[i + 1].x},${
      points[i + 1].y
    }`;
  }
  return d;
}

/** Control points of each cubic segment — used by the geometry test. */
export function smoothSegments(points: Point[]): Point[][] {
  const path = smoothPath(points);
  const nums = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const segments: Point[][] = [];
  // M x y, then each C consumes six numbers.
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const start = i === 2 ? { x: nums[0], y: nums[1] } : segments[segments.length - 1][3];
    segments.push([
      start,
      { x: nums[i], y: nums[i + 1] },
      { x: nums[i + 2], y: nums[i + 3] },
      { x: nums[i + 4], y: nums[i + 5] },
    ]);
  }
  return segments;
}

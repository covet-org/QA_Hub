"use client";

import { useMemo, useState } from "react";
import type { ReleaseTrend, TrendPoint } from "@/lib/bug-trend";

/**
 * Bugs found per release, as cumulative discovery curves.
 *
 * Categorical palette, validated for colour-vision deficiency against a
 * light surface (worst adjacent pair ΔE 9.1 protan / 19.6 normal).
 * Assigned by release identity in fixed order and never cycled, so
 * toggling a series off never repaints the others.
 *
 * Three of the seven fail 3:1 contrast against white, which obliges the
 * relief this chart already carries: a legend, direct end labels, and a
 * tooltip listing every visible series.
 */
const SERIES_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
];

/** Shown without pressing "+ More". */
const DEFAULT_VISIBLE = 3;

/**
 * Days of the x-axis by default.
 *
 * Bugs get filed against a release for months after its testing ends, and
 * one such tail sets the scale for every other line: with the full range
 * the axis ran to day 93 and the two current releases — which do all
 * their work inside ten days — were squeezed into the left sixth of the
 * plot. Thirty days covers the window where discovery actually happens;
 * "Full range" brings the tail back.
 */
const DEFAULT_WINDOW_DAYS = 30;

const PAD = { top: 16, right: 68, bottom: 28, left: 38 };
const W = 900;
const H = 300;

interface Hover {
  day: number;
  x: number;
  values: { release: string; color: string; count: number }[];
}

/** Cumulative count of a release at a given day offset (step-wise). */
function countAtDay(trend: ReleaseTrend, day: number): number {
  let count = 0;
  for (const point of trend.points) {
    if (point.day > day) break;
    count = point.count;
  }
  return count;
}

export function BugTrendChart({ trends }: { trends: ReleaseTrend[] }) {
  const [expanded, setExpanded] = useState(false);
  const [fullRange, setFullRange] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Hover | null>(null);

  // Colour follows the release, not its position in the visible list.
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    trends.forEach((t, i) => map.set(t.release, SERIES_COLORS[i] ?? "#64748b"));
    return map;
  }, [trends]);

  const offered = expanded ? trends : trends.slice(0, DEFAULT_VISIBLE);
  const shown = offered.filter((t) => !hidden.has(t.release));

  const fullDay = Math.max(
    1,
    ...shown.flatMap((t) => t.points.map((p) => p.day)),
  );
  const maxDay = fullRange ? fullDay : Math.min(fullDay, DEFAULT_WINDOW_DAYS);
  // A clipped line is drawn only to the edge, so the y-axis reflects what
  // is actually on screen rather than counts the reader cannot see.
  const maxCount = Math.max(1, ...shown.map((t) => countAtDay(t, maxDay)));
  const clipped = shown.filter((t) => t.points[t.points.length - 1].day > maxDay);

  const x = (day: number) =>
    PAD.left + (day / maxDay) * (W - PAD.left - PAD.right);
  const y = (count: number) =>
    H - PAD.bottom - (count / maxCount) * (H - PAD.top - PAD.bottom);

  /** Points inside the window, plus the edge value when the line is cut. */
  const visiblePoints = (trend: ReleaseTrend): TrendPoint[] => {
    const inside = trend.points.filter((p) => p.day <= maxDay);
    const last = trend.points[trend.points.length - 1];
    if (last.day > maxDay) inside.push({ day: maxDay, count: countAtDay(trend, maxDay) });
    return inside;
  };

  const path = (trend: ReleaseTrend) => {
    const pts = [{ day: 0, count: 0 }, ...visiblePoints(trend)];
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.count)}`).join(" ");
  };

  // Recessive gridlines: four horizontal steps, labelled at the axis.
  const ticks = Array.from({ length: 5 }, (_, i) =>
    Math.round((maxCount / 4) * i),
  );

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    if (shown.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const day = Math.max(
      0,
      Math.min(
        maxDay,
        Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * maxDay),
      ),
    );
    setHover({
      day,
      x: x(day),
      values: shown.map((t) => ({
        release: t.release,
        color: colorOf.get(t.release)!,
        count: countAtDay(t, day),
      })),
    });
  }

  function toggle(release: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(release)) next.delete(release);
      else next.add(release);
      return next;
    });
  }

  if (trends.length === 0) {
    return (
      <p className="text-[13px] text-slate-500">
        No bugs with a release yet — nothing to chart.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {offered.map((trend) => {
          const color = colorOf.get(trend.release)!;
          const on = !hidden.has(trend.release);
          return (
            <button
              key={trend.release}
              type="button"
              onClick={() => toggle(trend.release)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] transition-opacity ${
                on ? "text-slate-700" : "text-slate-400 opacity-60"
              }`}
            >
              <span
                aria-hidden
                className="h-[3px] w-4 rounded-full"
                style={{ background: on ? color : "#cbd5e1" }}
              />
              {trend.release}
              <span className="nums text-slate-400">{trend.total}</span>
            </button>
          );
        })}
        {trends.length > DEFAULT_VISIBLE && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-medium text-brand-700 hover:underline"
          >
            {expanded ? "Show fewer" : `+ More (${trends.length - DEFAULT_VISIBLE})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setFullRange((f) => !f)}
          className="ml-auto text-[11px] font-medium text-brand-700 hover:underline"
        >
          {fullRange ? `First ${DEFAULT_WINDOW_DAYS} days` : "Full range"}
        </button>
      </div>

      {!fullRange && clipped.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-400">
          {clipped.map((t) => t.release).join(", ")} continued past day{" "}
          {DEFAULT_WINDOW_DAYS} — arrows show each release&apos;s final total.
        </p>
      )}

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Cumulative bugs found per release, by day since the first bug"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#e3e9ee"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="nums"
                fontSize={11}
                fill="#94a3b8"
              >
                {tick}
              </text>
            </g>
          ))}

          <text
            x={PAD.left}
            y={H - 8}
            fontSize={11}
            fill="#94a3b8"
          >
            day 0
          </text>
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            fontSize={11}
            fill="#94a3b8"
          >
            day {maxDay}
          </text>

          {hover && (
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {shown.map((trend) => {
            const color = colorOf.get(trend.release)!;
            const inWindow = visiblePoints(trend);
            const last = inWindow[inWindow.length - 1] ?? { day: 0, count: 0 };
            const cut = trend.points[trend.points.length - 1].day > maxDay;
            return (
              <g key={trend.release}>
                <path
                  d={path(trend)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Direct labels up to four series; beyond that they can
                    collide when two releases end on similar totals, and
                    the legend plus tooltip already carry identity. */}
                {shown.length <= 4 && (
                  <text
                    x={x(last.day) + 8}
                    y={y(last.count) + 4}
                    fontSize={11}
                    fill={color}
                    className="nums"
                  >
                    {trend.release} · {last.count}
                    {cut ? ` → ${trend.total}` : ""}
                  </text>
                )}
                {hover && (
                  <circle
                    cx={hover.x}
                    cy={y(countAtDay(trend, hover.day))}
                    r={4}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {hover && hover.values.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg bg-surface-card px-2.5 py-2 shadow-card ring-1 ring-hairline"
            style={{
              left: `${(hover.x / W) * 100}%`,
              transform:
                hover.x > W / 2 ? "translateX(-108%)" : "translateX(8%)",
            }}
          >
            <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              Day {hover.day}
            </p>
            <ul className="mt-1 space-y-0.5">
              {hover.values.map((v) => (
                <li key={v.release} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-[3px] w-3 rounded-full"
                    style={{ background: v.color }}
                  />
                  <span className="nums text-[13px] font-semibold text-slate-800">
                    {v.count}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {v.release}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {shown.length === 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          Every release is hidden — pick one above.
        </p>
      )}
    </div>
  );
}

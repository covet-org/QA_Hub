"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_RELEASES_SHOWN,
  RevealMoreButton,
  useRevealMore,
} from "@/components/ui";
import type { ReleaseTrend, TrendPoint } from "@/lib/bug-trend";
import { smoothPath } from "@/lib/smooth-path";

/**
 * Bugs found per release, as cumulative discovery curves.
 *
 * Categorical palette, validated for colour-vision deficiency against a
 * light surface (worst adjacent pair ΔE 9.1 protan / 19.6 normal).
 * Assigned by release identity in fixed order and never cycled, so
 * toggling a series off never repaints the others.
 *
 * Three of the seven fail 3:1 contrast against white, which obliges the
 * relief this chart carries: a legend, direct end labels, and a tooltip
 * listing every visible series.
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

const PAD = { top: 18, right: 78, bottom: 30, left: 42 };
const W = 900;
const H = 300;

interface Hover {
  day: number;
  x: number;
  /** The series the pointer is closest to — emphasised, listed first. */
  nearest: string | null;
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
  const [fullRange, setFullRange] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Hover | null>(null);
  /** Click freezes the readout so a value can be read, or copied, calmly. */
  const [pinned, setPinned] = useState(false);
  /** Legend hover previews a series without committing to a click. */
  const [legendFocus, setLegendFocus] = useState<string | null>(null);

  // Colour follows the release, not its position in the visible list.
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    trends.forEach((t, i) => map.set(t.release, SERIES_COLORS[i] ?? "#64748b"));
    return map;
  }, [trends]);

  // Last two releases up front, the rest behind "+ More" — the same
  // convention the feature breakdown below this chart uses.
  const {
    visible: offered,
    expanded,
    hiddenCount: moreCount,
    toggle: toggleMore,
  } = useRevealMore(trends, DEFAULT_RELEASES_SHOWN);
  const shown = offered.filter((t) => !hidden.has(t.release));

  const fullDay = Math.max(
    1,
    ...shown.flatMap((t) => t.points.map((p) => p.day)),
  );
  const maxDay = fullRange ? fullDay : Math.min(fullDay, DEFAULT_WINDOW_DAYS);
  const maxCount = Math.max(1, ...shown.map((t) => countAtDay(t, maxDay)));
  const clipped = shown.filter(
    (t) => t.points[t.points.length - 1].day > maxDay,
  );

  const x = (day: number) =>
    PAD.left + (day / maxDay) * (W - PAD.left - PAD.right);
  const y = (count: number) =>
    H - PAD.bottom - (count / maxCount) * (H - PAD.top - PAD.bottom);

  /** Points inside the window, plus the edge value when the line is cut. */
  const visiblePoints = (trend: ReleaseTrend): TrendPoint[] => {
    const inside = trend.points.filter((p) => p.day <= maxDay);
    const last = trend.points[trend.points.length - 1];
    if (last.day > maxDay) {
      inside.push({ day: maxDay, count: countAtDay(trend, maxDay) });
    }
    return inside;
  };

  const coords = (trend: ReleaseTrend) =>
    [{ day: 0, count: 0 }, ...visiblePoints(trend)].map((p) => ({
      x: x(p.day),
      y: y(p.count),
    }));

  // Headline: the current release, and whether it is running hotter than
  // the one before it — the question the chart is asked most often.
  const current = trends[0];
  const previous = trends[1];
  const delta = current && previous ? current.total - previous.total : null;

  // Three gridlines, not five: the reader needs a floor, a middle and a
  // ceiling, and every extra line competes with the data.
  const ticks = [0, Math.round(maxCount / 2), maxCount];
  const dayStep = maxDay <= 10 ? 2 : maxDay <= 30 ? 5 : Math.ceil(maxDay / 6);
  const dayTicks = Array.from(
    { length: Math.floor(maxDay / dayStep) + 1 },
    (_, i) => i * dayStep,
  );

  /** Which series is emphasised: legend hover wins, else the nearest line. */
  const focused = legendFocus ?? hover?.nearest ?? null;

  function readAt(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    const day = Math.max(
      0,
      Math.min(
        maxDay,
        Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * maxDay),
      ),
    );
    return day;
  }

  function showDay(day: number, pointerY?: number) {
    const values = shown
      .map((t) => ({
        release: t.release,
        color: colorOf.get(t.release)!,
        count: countAtDay(t, day),
      }))
      // Highest line first: the tooltip reads in the order the eye sees.
      .sort((a, b) => b.count - a.count);

    // Nearest series by vertical distance, so hovering "near a line"
    // emphasises that line rather than requiring a 2px hit.
    let nearest: string | null = null;
    if (pointerY !== undefined) {
      let best = Infinity;
      for (const v of values) {
        const d = Math.abs(y(v.count) - pointerY);
        if (d < best) {
          best = d;
          nearest = v.release;
        }
      }
      if (best > 48) nearest = null; // too far from anything to claim focus
    }

    setHover({ day, x: x(day), nearest, values });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (pinned || shown.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerY = ((event.clientY - rect.top) / rect.height) * H;
    showDay(readAt(event.clientX, rect), pointerY);
  }

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (shown.length === 0) return;
    const day = hover?.day ?? 0;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = Math.max(
        0,
        Math.min(maxDay, day + (event.key === "ArrowRight" ? 1 : -1)),
      );
      showDay(next);
    } else if (event.key === "Escape") {
      setPinned(false);
      setHover(null);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPinned((p) => !p);
    }
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
      {/* Hero figure: the number people came for, with its comparison. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-2.5">
          <span
            className="font-display nums text-3xl leading-none font-semibold"
            style={{ color: colorOf.get(current.release) }}
          >
            {current.total}
          </span>
          <span className="text-[13px] text-slate-600">
            {/* Singular matters here: the CS chart routinely sits at one. */}
            bug{current.total === 1 ? "" : "s"} in {current.release}
          </span>
          {delta !== null && (
            <span
              className={`nums rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                delta > 0
                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : delta < 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200"
              }`}
              title={`${current.release} versus ${previous.release}`}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)} vs{" "}
              {previous.release}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFullRange((f) => !f)}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-hairline ring-inset transition-colors hover:bg-surface-sunken"
        >
          {fullRange ? `First ${DEFAULT_WINDOW_DAYS} days` : "Full range"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {offered.map((trend) => {
          const color = colorOf.get(trend.release)!;
          const on = !hidden.has(trend.release);
          const dim = focused !== null && focused !== trend.release;
          return (
            <button
              key={trend.release}
              type="button"
              onClick={() => toggle(trend.release)}
              onPointerEnter={() => setLegendFocus(trend.release)}
              onPointerLeave={() => setLegendFocus(null)}
              onFocus={() => setLegendFocus(trend.release)}
              onBlur={() => setLegendFocus(null)}
              aria-pressed={on}
              title={
                on ? `Hide ${trend.release}` : `Show ${trend.release}`
              }
              className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1.5 text-[11px] font-medium ring-1 ring-inset transition-all ${
                on
                  ? "bg-surface-card text-slate-700 ring-hairline"
                  : "text-slate-400 ring-transparent hover:bg-surface-sunken"
              } ${dim ? "opacity-45" : "opacity-100"}`}
            >
              <span
                aria-hidden
                className="size-2 rounded-full transition-transform"
                style={{
                  background: on ? color : "#cbd5e1",
                  transform: focused === trend.release ? "scale(1.4)" : "none",
                }}
              />
              {trend.release}
              {/* Parenthesised so the count cannot read as a patch
                  version — see the end-label note below. */}
              <span className="nums text-slate-400">({trend.total})</span>
            </button>
          );
        })}
        <RevealMoreButton
          expanded={expanded}
          hiddenCount={moreCount}
          onToggle={toggleMore}
          className="ml-1"
        />
        <span className="ml-auto hidden text-[10px] text-slate-400 sm:block">
          {pinned ? "Pinned — click to release" : "Click to pin · ← → to step"}
        </span>
      </div>

      {!fullRange && clipped.length > 0 && (
        <p className="mt-1.5 text-[10px] text-slate-400">
          {clipped.map((t) => t.release).join(", ")} continued past day{" "}
          {DEFAULT_WINDOW_DAYS} — arrows show each release&apos;s final total.
        </p>
      )}

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair rounded-lg focus:ring-2 focus:ring-brand-600/40 focus:outline-none"
          role="img"
          tabIndex={0}
          aria-label="Cumulative bugs found per release, by day since the first bug. Arrow keys step through days."
          onPointerMove={onPointerMove}
          onPointerLeave={() => !pinned && setHover(null)}
          onClick={() => setPinned((p) => !p)}
          onKeyDown={onKeyDown}
        >
          <defs>
            {shown.map((trend) => {
              const color = colorOf.get(trend.release)!;
              return (
                <linearGradient
                  key={trend.release}
                  id={`trend-fill-${trend.release.replace(".", "-")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#e3e9ee"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "2 5"}
              />
              <text
                x={PAD.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="nums"
                fontSize={10}
                fill="#94a3b8"
              >
                {tick}
              </text>
            </g>
          ))}

          {dayTicks.map((day) => (
            <text
              key={day}
              x={x(day)}
              y={H - 10}
              textAnchor="middle"
              className="nums"
              fontSize={10}
              fill="#94a3b8"
            >
              {day === 0 ? "day 0" : day}
            </text>
          ))}

          {hover && (
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke={pinned ? "#0f5a74" : "#94a3b8"}
              strokeWidth={1}
              strokeDasharray={pinned ? undefined : "3 3"}
            />
          )}

          {/* Fill only under the emphasised release: more than one wash
              turns to mud and hides the lines beneath. */}
          {shown
            .filter((t) => t.release === (focused ?? current.release))
            .map((trend) => {
              const pts = coords(trend);
              const area =
                smoothPath(pts) +
                ` L${pts[pts.length - 1].x},${y(0)} L${pts[0].x},${y(0)} Z`;
              return (
                <path
                  key={`area-${trend.release}`}
                  className="trend-area"
                  d={area}
                  fill={`url(#trend-fill-${trend.release.replace(".", "-")})`}
                />
              );
            })}

          {shown.map((trend) => {
            const color = colorOf.get(trend.release)!;
            const pts = coords(trend);
            const inWindow = visiblePoints(trend);
            const last = inWindow[inWindow.length - 1] ?? { day: 0, count: 0 };
            const cut = trend.points[trend.points.length - 1].day > maxDay;
            const isFocused = focused === trend.release;
            const dim = focused !== null && !isFocused;
            const d = smoothPath(pts);
            return (
              <g
                key={trend.release}
                opacity={dim ? 0.22 : 1}
                style={{ transition: "opacity 140ms ease-out" }}
              >
                {/* Halo: a surface-coloured stroke under the line keeps
                    crossings readable without thickening the data mark. */}
                <path
                  d={d}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={dim ? 0 : 0.9}
                />
                <path
                  className="trend-line"
                  pathLength={1}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isFocused ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={x(last.day)}
                  cy={y(last.count)}
                  r={isFocused ? 5 : 4}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {shown.length <= 4 && (
                  /* Release and count are separate tspans, not "3.34 · 1":
                     a middle dot between a dotted version and a number
                     reads as a patch release — someone asked what the
                     "3.34.1 release line" was. The label now says what the
                     number is. */
                  <text
                    x={x(last.day) + 10}
                    y={y(last.count) + 4}
                    fontSize={11}
                    fontWeight={isFocused ? 700 : 500}
                    fill={color}
                    className="nums"
                  >
                    {trend.release}
                    <tspan dx={6} fill="#64748b" fontWeight={500}>
                      {cut
                        ? `${last.count} of ${trend.total} bugs`
                        : `${last.count} bug${last.count === 1 ? "" : "s"}`}
                    </tspan>
                  </text>
                )}
                {hover && (
                  <circle
                    cx={hover.x}
                    cy={y(countAtDay(trend, hover.day))}
                    r={isFocused ? 5 : 3.5}
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
            className="pointer-events-none absolute top-1 rounded-lg bg-surface-card px-2.5 py-2 shadow-panel ring-1 ring-hairline"
            style={{
              left: `${(hover.x / W) * 100}%`,
              transform:
                hover.x > W / 2 ? "translateX(-108%)" : "translateX(8%)",
            }}
          >
            <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              Day {hover.day}
              {pinned && <span className="ml-1 text-brand-700">· pinned</span>}
            </p>
            <ul className="mt-1 space-y-0.5">
              {hover.values.map((v) => {
                const isFocused = focused === v.release;
                return (
                  <li
                    key={v.release}
                    className={`flex items-center gap-1.5 rounded px-1 ${
                      isFocused ? "bg-surface-sunken" : ""
                    }`}
                  >
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
                );
              })}
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

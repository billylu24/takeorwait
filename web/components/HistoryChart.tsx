"use client";

import { useState } from "react";

import { QUARTER_NAME, displayName, num, pct, range } from "@/lib/format";
import type { Course, HistoryRow } from "@/lib/types";

const W = 960;
const H = 300;
const M = { l: 44, r: 16, t: 14, b: 30 };
const ERA_SPAN: Record<string, [number, number]> = {
  "09-14": [2009, 2015],
  "15-19": [2015, 2020],
  "20-21": [2020, 2022],
  "22-26": [2022, 2027],
};
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export default function HistoryChart({ course, colored }: { course: Course; colored: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = course.history;
  const t0 = Math.floor(Math.min(...rows.map((r) => r[0])));
  const t1 = Math.max(...rows.map((r) => r[0])) + 0.75;
  const x = (t: number) => M.l + ((t - t0) / Math.max(t1 - t0, 1)) * (W - M.l - M.r);
  const y = (p: number) => M.t + (1 - p) * (H - M.t - M.b);
  const color = (ins: string) => {
    const i = colored.indexOf(ins);
    return i >= 0 ? SERIES[i] : "var(--series-other)";
  };
  const radius = (n: number) => Math.max(4, Math.min(9, 2 + Math.sqrt(n) / 3));

  const years: number[] = [];
  const step = t1 - t0 > 10 ? 2 : 1;
  for (let yr = Math.ceil(t0); yr <= t1; yr += step) years.push(yr);

  // draw the coloured instructors last so they sit on top
  const order = rows.map((_, i) => i).sort((a, b) => colored.indexOf(rows[a][3]) - colored.indexOf(rows[b][3]));
  const h: HistoryRow | null = hover == null ? null : rows[hover];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A-rate of each ${course.code} offering over time`}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={M.l} x2={W - M.r} y1={y(p)} y2={y(p)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.l - 8} y={y(p) + 4} textAnchor="end">
              {p * 100}%
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle">
            {yr}
          </text>
        ))}

        {course.eras.map((e) => {
          const [a, b] = ERA_SPAN[e.era];
          const xa = x(Math.max(a, t0));
          const xb = x(Math.min(b, t1));
          if (xb <= xa) return null;
          return (
            <g key={e.era}>
              <rect x={xa} width={xb - xa} y={y(e.hi)} height={y(e.lo) - y(e.hi)} fill="var(--band)" />
              <line x1={xa} x2={xb} y1={y(e.level)} y2={y(e.level)} stroke="var(--series-other)" strokeWidth={2} strokeLinecap="round" />
            </g>
          );
        })}

        {order.map((i) => {
          const r = rows[i];
          const cx = x(r[0]);
          const c = color(r[3]);
          const summer = r[2] === "M";
          return (
            <g key={i} opacity={hover == null || hover === i ? 1 : 0.55}>
              <line x1={cx} x2={cx} y1={y(r[7])} y2={y(r[6])} stroke={c} strokeWidth={1} opacity={0.5} />
              <circle
                cx={cx}
                cy={y(r[5] / r[4])}
                r={radius(r[4])}
                fill={summer ? "var(--surface)" : c}
                stroke={summer ? c : "var(--surface)"}
                strokeWidth={2}
              />
              <circle
                cx={cx}
                cy={y(r[5] / r[4])}
                r={radius(r[4]) + 6}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${QUARTER_NAME[r[2]]} ${r[1]}, ${displayName(r[3])}: ${pct(r[5] / r[4])} A of ${r[4]}`}
              />
            </g>
          );
        })}
      </svg>

      {h && (
        <div
          className="tooltip"
          style={{
            left: `${(x(h[0]) / W) * 100}%`,
            top: `${(y(h[5] / h[4]) / H) * 100}%`,
            transform: `translate(${x(h[0]) > W * 0.65 ? "calc(-100% - 14px)" : "14px"}, -50%)`,
          }}
        >
          <div className="t">
            {QUARTER_NAME[h[2]]} {h[1]} · {displayName(h[3])}
          </div>
          <div className="r">
            {pct(h[5] / h[4])} A <span style={{ color: "var(--muted)" }}>(95% CI {range(h[6], h[7])})</span>
          </div>
          <div className="r">
            D/F {pct(h[8] / h[4])} · avg GPA {h[9]?.toFixed(2) ?? "–"}
          </div>
          <div className="r">{num(h[4])} letter-graded students{h[2] === "M" ? " · summer, not modelled" : ""}</div>
        </div>
      )}

      <div className="legend">
        {colored.map((n, i) => (
          <span key={n}>
            <i style={{ background: SERIES[i] }} />
            {displayName(n)}
          </span>
        ))}
        {course.summary.instructors > colored.length && (
          <span>
            <i style={{ background: "var(--series-other)" }} />
            Other instructors
          </span>
        )}
        {course.summary.summer_offerings > 0 && (
          <span>
            <i style={{ border: "2px solid var(--series-other)", background: "transparent" }} />
            Summer
          </span>
        )}
        <span>
          <i className="band-key" style={{ borderRadius: 2 }} />
          Era level (90% interval)
        </span>
      </div>
    </div>
  );
}

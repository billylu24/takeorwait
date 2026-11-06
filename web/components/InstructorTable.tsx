"use client";

import { Fragment, useState } from "react";

import { displayName, num, pct, range } from "@/lib/format";
import type { Course, Instructor } from "@/lib/types";

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

type Metric = "a" | "df";
type Sort = "recent" | "estimate";

// Positions are percentages of the cell width, so dots stay round at any table width.
function Forest({ lo, hi, est, plo, phi, base, scale }: {
  lo: number; hi: number; est: number; plo?: number; phi?: number; base: number; scale: (p: number) => number;
}) {
  return (
    <div className="fp" aria-hidden>
      {plo != null && phi != null && (
        <span className="fp-pred" style={{ left: `${scale(plo)}%`, width: `${scale(phi) - scale(plo)}%` }} />
      )}
      <span className="fp-base" style={{ left: `${scale(base)}%` }} />
      <span className="fp-ci" style={{ left: `${scale(lo)}%`, width: `${scale(hi) - scale(lo)}%` }} />
      <span className="fp-dot" style={{ left: `${scale(est)}%` }} />
    </div>
  );
}

export default function InstructorTable({ course, colored }: { course: Course; colored: string[] }) {
  const [metric, setMetric] = useState<Metric>("a");
  const [sort, setSort] = useState<Sort>("recent");
  const base = course.baseline[metric];
  const all = course.instructors;

  const lows = all.map((i) => (metric === "a" ? i.a.pred_lo : i.df.lo)).concat(base.lo);
  const highs = all.map((i) => (metric === "a" ? i.a.pred_hi : i.df.hi)).concat(base.hi);
  const lo = Math.max(0, Math.floor(Math.min(...lows) * 10) / 10);
  const hi = Math.min(1, Math.ceil(Math.max(...highs) * 10) / 10);
  const scale = (p: number) => 3 + ((p - lo) / Math.max(hi - lo, 0.05)) * 94;
  const ticks = [];
  for (let t = lo; t <= hi + 1e-9; t += hi - lo > 0.5 ? 0.2 : 0.1) ticks.push(Math.round(t * 100) / 100);

  const est = (i: Instructor) => i[metric].est;
  const sorted =
    sort === "recent"
      ? [...all].sort((a, b) => b.last_t - a.last_t || est(b) - est(a))
      : [...all].sort((a, b) => (metric === "a" ? est(b) - est(a) : est(a) - est(b)));
  const groups: [string | null, Instructor[]][] =
    sort === "recent"
      ? [[null, sorted]]
      : [
          ["Taught it at least twice", sorted.filter((i) => i.offerings >= 2)],
          ["Taught it once: thin evidence", sorted.filter((i) => i.offerings < 2)],
        ];
  const what = metric === "a" ? "A-rate" : "D/F rate";

  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Metric">
          <button aria-pressed={metric === "a"} onClick={() => setMetric("a")}>A-rate</button>
          <button aria-pressed={metric === "df"} onClick={() => setMetric("df")}>D/F rate</button>
        </div>
        <div className="seg" role="group" aria-label="Sort">
          <button aria-pressed={sort === "recent"} onClick={() => setSort("recent")}>Recently taught</button>
          <button aria-pressed={sort === "estimate"} onClick={() => setSort("estimate")}>By estimate</button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="itable">
          <thead>
            <tr>
              <th>Instructor</th>
              <th className="num">Offerings</th>
              <th className="num">Raw {what}</th>
              <th className="num">Adjusted, 90% interval</th>
              <th className="forest">
                <div className="fp-axis" aria-hidden>
                  {ticks.map((t) => (
                    <span key={t} style={{ left: `${scale(t)}%` }}>
                      {Math.round(t * 100)}%
                    </span>
                  ))}
                </div>
              </th>
              <th className="num" title={`Probability this instructor's ${what} is above a typical instructor's for this course`}>
                P(above typical)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="name">
                Typical or new instructor
                <div className="sub">no history in this course</div>
              </td>
              <td className="num">–</td>
              <td className="num">–</td>
              <td className="num">
                {pct(base.est)} <span className="sub">({range(base.lo, base.hi)})</span>
              </td>
              <td className="forest">
                <Forest lo={base.lo} hi={base.hi} est={base.est} base={base.est} scale={scale} />
              </td>
              <td className="num">50%</td>
            </tr>
            {groups.map(([label, rows]) => (
              <Fragment key={label ?? "all"}>
                {label && rows.length > 0 && (
                  <tr className="group">
                    <td colSpan={6}>{label}</td>
                  </tr>
                )}
                {rows.map((i) => {
                  const c = colored.indexOf(i.name);
                  const m = i[metric];
                  return (
                    <tr key={i.name} className={i.offerings < 2 ? "thin" : ""}>
                      <td className="name">
                        {c >= 0 && (
                          <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: SERIES[c], marginRight: 7 }} />
                        )}
                        {displayName(i.name)}
                        {i.offerings < 2 && sort === "recent" && <span className="thin-flag">1 offering</span>}
                        <div className="sub">
                          {i.first === i.last ? i.last : `${i.first} – ${i.last}`} · {num(i.students)} students
                        </div>
                      </td>
                      <td className="num">{i.offerings}</td>
                      <td className="num">{pct(metric === "a" ? i.raw_a : i.raw_df)}</td>
                      <td className="num">
                        {pct(m.est)} <span className="sub">({range(m.lo, m.hi)})</span>
                      </td>
                      <td className="forest">
                        <Forest
                          lo={m.lo}
                          hi={m.hi}
                          est={m.est}
                          plo={metric === "a" ? i.a.pred_lo : undefined}
                          phi={metric === "a" ? i.a.pred_hi : undefined}
                          base={base.est}
                          scale={scale}
                        />
                      </td>
                      <td className="num">{pct(m.p_above)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        “Adjusted” = the instructor’s expected {what} for a typical offering at this course’s {course.current_era} grading
        level, shrunk toward the course average when they have few offerings. Dark bar: 90% interval for that expectation.
        {metric === "a" && " Light band: 90% range for a single next offering (offerings vary even with the same instructor)."}{" "}
        Yellow line: typical instructor. Raw = pooled over all their regular-quarter offerings, unadjusted.
      </p>
    </div>
  );
}

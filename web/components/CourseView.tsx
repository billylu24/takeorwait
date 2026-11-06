"use client";

import HistoryChart from "@/components/HistoryChart";
import InstructorTable from "@/components/InstructorTable";
import Search from "@/components/Search";
import { SENSITIVITY_TEXT, displayName, num, pct, range } from "@/lib/format";
import type { Course } from "@/lib/types";

const signedPct = (x: number) => (x < 0 ? "<0%" : pct(x));

function Sensitivity({ c }: { c: Course }) {
  const s = c.sensitivity;
  const t = SENSITIVITY_TEXT[s.label];
  return (
    <div className="card">
      <div className="eyebrow">Does the instructor matter here?</div>
      <div style={{ marginTop: 10 }}>
        <span className={`badge ${s.label}`}>
          <span className="dot" />
          {t.title}
        </span>
      </div>
      {s.score != null && s.lo != null && s.hi != null ? (
        <>
          <div className="big">
            {signedPct(s.score)}
            <small>
              90% interval {signedPct(s.lo)} to {signedPct(s.hi)}
            </small>
          </div>
          <p className="callout">
            {s.score > 0 ? (
              <>
                Knowing who taught a past offering cuts the error in predicting its A-rate by <b>{pct(s.score)}</b>,
                compared with knowing only the era.
              </>
            ) : (
              <>Knowing who taught a past offering does not improve the prediction of its A-rate beyond the era.</>
            )}
          </p>
          <p className="note">
            Leave-one-offering-out test on {s.offerings} regular offerings, {s.repeat_instructors} instructors who taught
            it more than once. Interval from resampling instructors.
          </p>
        </>
      ) : (
        <p className="callout">
          Only {s.repeat_instructors} instructor{s.repeat_instructors === 1 ? "" : "s"} taught this course more than once
          ({s.offerings} regular offering{s.offerings === 1 ? "" : "s"} in total). The test needs at least three repeat
          instructors and six offerings. The per-instructor intervals below still apply.
        </p>
      )}
    </div>
  );
}

function Baseline({ c }: { c: Course }) {
  const b = c.baseline.a;
  const sw = c.same_instructor_swing;
  const first = c.eras[0];
  const last = c.eras[c.eras.length - 1];
  return (
    <div className="card">
      <div className="eyebrow">Typical offering now ({c.current_era} grading level)</div>
      <div className="big">
        {pct(b.est)} A<small>D/F {pct(c.baseline.df.est)}</small>
      </div>
      <p className="callout">
        A new instructor would most likely land between <b>{range(b.lo, b.hi)}</b> A (90%). Even the same instructor
        swings about <b>{range(sw.lo, sw.hi)}</b> from one offering to the next.
      </p>
      {c.eras.length > 1 && (
        <p className="note">
          Era drift: {first.era} level {pct(first.level)} → {last.era} level {pct(last.level)} (
          {c.eras.map((e) => `${e.era}: ${e.offerings}`).join(", ")} offerings). Instructors are compared on the{" "}
          {c.current_era} level.
        </p>
      )}
    </div>
  );
}

export default function CourseView({ c }: { c: Course }) {
  const colored = [...c.instructors].sort((a, b) => b.last_t - a.last_t).slice(0, 3).map((i) => i.name);
  const recent = c.history.filter((r) => r[2] !== "M").slice(-8);
  const s = c.summary;

  return (
    <>
      <div style={{ marginTop: 20 }}>
        <Search />
      </div>
      <div className="course-head">
        <div>
          <div className="eyebrow">{c.dept}</div>
          <h1>{c.code}</h1>
          <p className="facts">
            {s.regular_offerings} regular-quarter offerings
            {s.summer_offerings > 0 && ` (+${s.summer_offerings} summer)`} · {num(s.students)} letter-graded students ·{" "}
            {s.instructors} instructor{s.instructors === 1 ? "" : "s"} · {s.first} – {s.last}
          </p>
        </div>
        <div className="actions">
          <a className="btn" href={c.plat_url} target="_blank" rel="noopener">
            Sections &amp; registration on UCSBPlat ↗
          </a>
        </div>
      </div>

      <div className="two-col">
        <Sensitivity c={c} />
        <Baseline c={c} />
      </div>

      <div className="card section">
        <h2>Every offering</h2>
        <p className="sub" style={{ marginBottom: 12 }}>
          A-rate (A+, A, A−) of letter-graded students per offering, with 95% intervals. Dot size grows with class size.
          Hover for details.
        </p>
        <HistoryChart course={c} colored={colored} />
        {recent.length > 1 && (
          <>
            <div className="eyebrow" style={{ marginTop: 18 }}>
              Recent rotation
            </div>
            <div className="rotation">
              {recent.map((r, i) => (
                <span key={i}>
                  {r[2]}
                  {String(r[1]).slice(2)} <b>{displayName(r[3]).split(" ")[0]}</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card section">
        <h2>Instructors compared</h2>
        <p className="sub" style={{ marginBottom: 14 }}>
          Each instructor’s expected grades in this course, adjusted to the same grading era.
        </p>
        <InstructorTable course={c} colored={colored} />
        <div className="disclaimer">
          Grade distributions describe grading, not teaching quality. A lower A-rate can come with a harder, more useful
          course. Use these numbers to understand the trade-off, not to rank people.
        </div>
      </div>
    </>
  );
}

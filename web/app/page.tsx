import Link from "next/link";

import Search from "@/components/Search";
import { readIndex, readManifest } from "@/lib/data";
import { SENSITIVITY_TEXT, courseHref, num } from "@/lib/format";
import type { IndexRow, SensitivityLabel } from "@/lib/types";

const EXAMPLES = ["CMPSC 24", "PHYS 7A", "MATH 4B", "CHEM 1C", "ECON 1"];

function CourseList({ rows }: { rows: IndexRow[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {rows.map((r) => (
        <li key={r[1]} style={{ display: "flex", gap: 10, padding: "5px 0", borderTop: "1px solid var(--grid)" }}>
          <Link href={courseHref(r[1])} style={{ fontWeight: 600, minWidth: 92 }}>
            {r[0]}
          </Link>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {r[2]} offerings · {num(r[3])} students
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const index = readIndex();
  const m = readManifest();
  const top = (label: SensitivityLabel) => index.filter((r) => r[6] === label).slice(0, 6);
  const total = index.reduce((s, r) => s + r[3], 0);
  const known = (["large", "moderate", "small", "unclear"] as SensitivityLabel[]).reduce(
    (s, l) => s + (m.sensitivity_labels[l] ?? 0),
    0,
  );

  return (
    <>
      <section className="hero">
        <h1>Take it now, with this instructor, or wait?</h1>
        <p className="lede">
          A course page tells you “82% A”. It can’t tell you whether that’s high <em>for this course</em>, whether it
          reflects the instructor or just the era, or whether it rests on one offering or fifteen. This tool compares
          instructors within each UCSB course, adjusted for grading eras, with sample sizes and intervals on every
          number.
        </p>
        <Search autoFocus />
        <div className="try">
          Try
          {EXAMPLES.map((c) => (
            <Link key={c} href={courseHref(c.replace(/[^A-Za-z0-9]+/g, "-"))}>
              {c}
            </Link>
          ))}
        </div>
      </section>

      <div className="stat-row">
        <div className="card stat">
          <div className="v">{num(m.courses)}</div>
          <div className="l">courses with letter-graded offerings</div>
        </div>
        <div className="card stat">
          <div className="v">{(total / 1e6).toFixed(2)}M</div>
          <div className="l">letter grades, {m.source.first}–{m.source.last}</div>
        </div>
        <div className="card stat">
          <div className="v">{num(known)}</div>
          <div className="l">courses with enough repeat instructors to test whether instructor matters</div>
        </div>
        <div className="card stat">
          <div className="v">{num(m.sensitivity_labels.large ?? 0)}</div>
          <div className="l">of those where it clearly matters a lot</div>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="eyebrow">1 · Does it matter?</div>
          <h2 style={{ marginTop: 6 }}>Instructor sensitivity</h2>
          <p className="sub">
            Hold out each past offering and try to predict its A-rate with and without knowing who taught it. If knowing
            the instructor doesn’t help, stop agonizing over sections.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">2 · Where do they sit?</div>
          <h2 style={{ marginTop: 6 }}>Era-adjusted estimates</h2>
          <p className="sub">
            A-rates drifted a lot (CMPSC 24: 39% in 2009–14, 82% in 2020–21). Each instructor is compared on today’s
            grading level, shrunk toward the course average when evidence is thin, with a 90% interval.
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">3 · Who teaches it?</div>
          <h2 style={{ marginTop: 6 }}>Full offering history</h2>
          <p className="sub">
            Every regular-quarter offering since 2009, who taught it, and the recent rotation. Each course links to
            UCSBPlat for current sections and registration.
          </p>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 28 }}>
        <div className="card">
          <span className="badge large">{SENSITIVITY_TEXT.large.title}</span>
          <p className="sub">Large courses where knowing the instructor clearly improves prediction.</p>
          <CourseList rows={top("large")} />
        </div>
        <div className="card">
          <span className="badge small">{SENSITIVITY_TEXT.small.title}</span>
          <p className="sub">Large courses where grades look about the same whoever teaches.</p>
          <CourseList rows={top("small")} />
        </div>
      </div>
    </>
  );
}

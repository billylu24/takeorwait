"use client";

// The one feature: for a course, does the instructor matter, and where does each instructor sit
// (era-adjusted A-rate with a 90% interval)? Overview = the course's drawer; detail = one extracted file.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArchiveScene, webglAvailable } from "./ArchiveScene";
import type { CassetteData } from "./cassette";
import Roll, { Masked } from "./Roll";
import SearchModal from "./SearchModal";
import { SENSITIVITY_TEXT, displayName, num, pct, range } from "@/lib/format";
import type { Course, Instructor } from "@/lib/types";

type Mode = "overview" | "detail";
type Tab = "position" | "effect" | "notes";

const DEFAULT = "CMPSC-24";
const pad3 = (n: number) => String(n).padStart(3, "0");
const pad2 = (n: number) => String(n).padStart(2, "0");
const islug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const signed = (x: number) => (x < 0 ? "<0%" : pct(x));

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  return { slug: q.get("c") ?? DEFAULT, inst: q.get("i") };
}

export default function CourseApp() {
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<ArchiveScene | null>(null);
  const [gl, setGl] = useState(true);
  const [dark, setDark] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("overview");
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("position");
  const [revealed, setRevealed] = useState(false);
  const [search, setSearch] = useState(false);
  const pendingInst = useRef<string | null>(null);
  const selRef = useRef(0);
  selRef.current = sel;

  // ---- ranked files for the current course
  const ranked = useMemo<Instructor[]>(
    () => (course ? [...course.instructors].sort((a, b) => b.a.est - a.a.est) : []),
    [course],
  );
  const latest = useMemo(() => ranked.reduce((best, i, k) => (i.last_t > ranked[best].last_t ? k : best), 0), [ranked]);
  const files = useMemo<CassetteData[]>(
    () =>
      ranked.map((i, k) => ({
        name: displayName(i.name),
        no: k + 1,
        total: ranked.length,
        est: i.a.est,
        lo: i.a.lo,
        hi: i.a.hi,
        pAbove: i.a.p_above,
        typical: course!.baseline.a.est,
        offerings: i.offerings,
        students: i.students,
        last: i.last,
      })),
    [ranked, course],
  );

  // ---- boot: URL, theme, WebGL
  useEffect(() => {
    const { slug, inst } = readUrl();
    pendingInst.current = inst;
    setSlug(slug);
    if (inst) setMode("detail");
    setGl(webglAvailable());
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = () => setDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // ---- fetch the course
  useEffect(() => {
    if (!slug) return;
    if (!/^[A-Za-z0-9-]+$/.test(slug)) {
      setMissing(slug);
      return;
    }
    let live = true;
    fetch(`/data/courses/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((c: Course) => {
        if (!live) return;
        setMissing(null);
        setCourse(c);
        document.title = `${c.code} · TakeOrWait`;
      })
      .catch(() => live && setMissing(slug));
    return () => {
      live = false;
    };
  }, [slug]);

  // ---- choose the initial file when a course arrives
  useEffect(() => {
    if (!course) return;
    const want = pendingInst.current;
    pendingInst.current = null;
    const k = want ? ranked.findIndex((i) => islug(i.name) === want) : -1;
    setSel(k >= 0 ? k : latest);
    if (k < 0) setMode("overview");
    setRevealed(false);
    setTab("position");
  }, [course, ranked, latest]);

  // ---- scene lifecycle
  useEffect(() => {
    if (!gl || !stage.current) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let s: ArchiveScene;
    try {
      s = new ArchiveScene(
        stage.current,
        {
          // clicking the highlighted file opens it; clicking another one highlights it
          onPick: (i) => (selRef.current === i ? setMode("detail") : setSel(i)),
          onReveal: () => setRevealed(true),
        },
        reduced,
        dark,
      );
    } catch {
      // no usable WebGL (GPU blocked or disabled): the 2D file is complete on its own
      stage.current.querySelectorAll("canvas").forEach((c) => c.remove());
      setGl(false);
      return;
    }
    scene.current = s;
    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __archive?: ArchiveScene }).__archive = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, [gl, dark]);

  useEffect(() => {
    if (scene.current && files.length) scene.current.setFiles(files, sel);
    // only when the course (or the scene) changes; selection is pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, gl, dark]);

  useEffect(() => {
    scene.current?.setSelection(sel, mode);
    setRevealed(!gl);
  }, [sel, mode, files, gl]);

  // ---- URL
  useEffect(() => {
    if (!course || !slug) return;
    const q = new URLSearchParams({ c: slug });
    if (mode === "detail" && ranked[sel]) q.set("i", islug(ranked[sel].name));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [course, slug, mode, sel, ranked]);

  const step = useCallback(
    (d: number) => setSel((s) => Math.max(0, Math.min(ranked.length - 1, s + d))),
    [ranked.length],
  );

  // ---- keyboard + wheel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (search) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "Enter" && mode === "overview" && !t.closest("a, button")) setMode("detail");
      else if (e.key === "Escape" && mode === "detail") setMode("overview");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [search, step, mode]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let acc = 0;
    let lastStep = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      const now = performance.now();
      if (Math.abs(acc) > 50 && now - lastStep > 160) {
        step(Math.sign(acc));
        acc = 0;
        lastStep = now;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  const openCourse = (s: string) => {
    setSearch(false);
    if (s === slug) return;
    setMode("overview");
    setSlug(s);
  };

  const cur = ranked[sel];
  const sens = course?.sensitivity;
  const st = sens ? SENSITIVITY_TEXT[sens.label] : null;
  const fileKey = `${slug}-${sel}-${mode}`;

  return (
    <div className={`app mode-${mode}`}>
      <div className="stage" ref={stage}>
        {!gl && <div className="nogl caps">3D view needs WebGL. The numbers below are complete without it.</div>}
      </div>

      {/* ---------------------------------------------------------------- top bar */}
      <header className="hud-top">
        <Link href="/" className="brand" aria-label="TakeOrWait home" onClick={() => setMode("overview")}>
          <span className="l1">TAKEORWAIT</span>
          <span className="l2">Synthesize grade records</span>
          <span className="l3">
            Analysis<b>UCSB</b>
          </span>
        </Link>
        <nav>
          <button className="nav-btn" onClick={() => setSearch(true)}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="14" cy="10" r="6" />
              <path d="m9.5 14.5-6 6" />
            </svg>
            Course index <kbd>/</kbd>
          </button>
          <Link href="/about/" className="nav-btn">
            How it works
          </Link>
        </nav>
      </header>

      {mode === "detail" && (
        <button className="back caps" onClick={() => setMode("overview")}>
          <span aria-hidden>←</span> Course overview <kbd>Esc</kbd>
        </button>
      )}

      {missing && (
        <section className="panel ov">
          <div className="kick caps">Internal database</div>
          <h2 className="ov-title">No file for “{missing.replace(/-/g, " ")}”</h2>
          <div className="ov-rule" />
          <p className="ov-text">
            Only courses with a regular-quarter offering of five or more letter grades are on file.{" "}
            <button className="link" onClick={() => setSearch(true)}>
              Search the index
            </button>
          </p>
        </section>
      )}

      {/* ---------------------------------------------------------------- overview: the course */}
      {course && cur && !missing && mode === "overview" && (
        <section className="panel ov" aria-live="polite">
          <div className="kick caps">
            Internal database <i>/</i> {course.dept}
          </div>
          <h2 className="ov-title">
            Course file: <Roll text={course.code} />
          </h2>
          <div className="ov-rule" />
          <div className="ov-row caps">
            <span>
              <Roll
                text={`${course.summary.regular_offerings} offerings · ${num(course.summary.students)} students · ${ranked.length} instructor${ranked.length === 1 ? "" : "s"}`}
                stagger={6}
              />
            </span>
            <span className="muted">Reference area</span>
          </div>

          <div className="q">
            <div className="q-l caps">01 · Does the instructor matter here?</div>
            <div className="q-v">
              <span className={`tag ${sens!.label}`}>{st!.title}</span>
              {sens!.score != null && (
                <span className="q-num">
                  <Roll text={signed(sens!.score)} />
                  <small className="caps">
                    90% <Roll text={`${signed(sens!.lo!)} – ${signed(sens!.hi!)}`} stagger={6} />
                  </small>
                </span>
              )}
            </div>
            <p className="q-text">
              {sens!.score != null
                ? sens!.score > 0
                  ? `Knowing who taught a past offering cuts the error in predicting its A-rate by ${pct(sens!.score)}, compared with knowing only the grading era.`
                  : "Knowing who taught a past offering does not predict its A-rate better than the grading era alone."
                : `Only ${sens!.repeat_instructors} instructor${sens!.repeat_instructors === 1 ? "" : "s"} taught it more than once; the test needs three. Per-instructor intervals still apply.`}
            </p>
          </div>

          <div className="q">
            <div className="q-l caps">02 · Typical offering now ({course.current_era.replace("-", "–")} level)</div>
            <div className="q-v">
              <span className="q-num">
                <Roll text={`${pct(course.baseline.a.est)} A`} />
                <small className="caps">
                  New instructor <Roll text={range(course.baseline.a.lo, course.baseline.a.hi)} stagger={6} />
                </small>
              </span>
            </div>
          </div>

          <button className="access" onClick={() => setMode("detail")}>
            <span className="no">NO.{pad3(sel + 1)}</span>
            <span className="nm">
              <Roll text={displayName(cur.name)} />
            </span>
            <span className="vv">
              <Roll text={`${pct(cur.a.est)} (${range(cur.a.lo, cur.a.hi)})`} stagger={6} />
            </span>
            <span className="go caps">
              Access file <span aria-hidden>→</span>
            </span>
          </button>
        </section>
      )}

      {/* ---------------------------------------------------------------- detail: one instructor */}
      {course && cur && !missing && mode === "detail" && (
        <section className="panel dt" aria-live="polite">
          <div className="file-line caps">
            <span>
              File {course.code.replace(/\s+/g, "-")}-
              <Roll text={pad3(sel + 1)} />
            </span>
            <span className="muted">Reference area</span>
          </div>
          <h1 className="dt-name">
            <Roll text={displayName(cur.name).toUpperCase()} />
          </h1>
          <div className="dt-sub">
            <span>{course.code}</span>
            <small className="caps">Instructor file</small>
            {sel === latest && <span className="tag-mini caps">Most recent</span>}
            {cur.offerings < 2 && <span className="tag-mini warn caps">1 offering</span>}
          </div>
          <div className="dt-rule" />
          <dl className="fields">
            {[
              ["Era-adjusted A-rate", pct(cur.a.est)],
              ["90% interval", range(cur.a.lo, cur.a.hi)],
              ["Rank in course", `${pad2(sel + 1)} / ${pad2(ranked.length)}`],
              ["P(above typical)", pct(cur.a.p_above)],
              ["Offerings · students", `${cur.offerings} · ${num(cur.students)}`],
              ["Taught", cur.first === cur.last ? cur.last : `${cur.first} – ${cur.last}`],
            ].map(([k, v], i) => (
              <div key={k}>
                <dt className="caps">{k}</dt>
                <dd>
                  <Masked on={revealed} k={`${fileKey}-${i}`} delay={i * 70}>
                    <Roll text={v} stagger={8} />
                  </Masked>
                </dd>
              </div>
            ))}
          </dl>

          <div className="tabs" role="tablist">
            {(
              [
                ["position", "Position"],
                ["effect", "Instructor effect"],
                ["notes", "Reading notes"],
              ] as [Tab, string][]
            ).map(([t, label], i) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                <small>0{i + 1}</small>
                {label}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === "position" && <Position course={course} ranked={ranked} sel={sel} onPick={setSel} />}
            {tab === "effect" && (
              <div>
                <div className="tb-l caps">Instructor effect / {course.code}</div>
                <p>
                  <span className={`tag ${sens!.label}`}>{st!.title}</span>
                </p>
                <p>
                  {sens!.score != null ? (
                    <>
                      Score <b>{signed(sens!.score)}</b> (90% interval {signed(sens!.lo!)} to {signed(sens!.hi!)}): the
                      share of out-of-sample prediction error removed by knowing the instructor, tested by leaving out
                      each of {sens!.offerings} offerings in turn.
                    </>
                  ) : (
                    <>
                      Only {sens!.repeat_instructors} instructor
                      {sens!.repeat_instructors === 1 ? "" : "s"} taught this course more than once ({sens!.offerings}{" "}
                      offerings), so whether the instructor matters can’t be tested yet.
                    </>
                  )}
                </p>
              </div>
            )}
            {tab === "notes" && (
              <div>
                <div className="tb-l caps">Reading notes</div>
                <ol>
                  <li>
                    Estimates are on the course’s {course.current_era.replace("-", "–")} grading level. Era drift is
                    large: {course.eras.map((e) => `${e.era.replace("-", "–")} ${pct(e.level)}`).join(", ")}.
                  </li>
                  <li>
                    Raw A-rate over their offerings is {pct(cur.raw_a)}; the estimate is shrunk toward the typical
                    instructor when evidence is thin. A single next offering could land in{" "}
                    {range(cur.a.pred_lo, cur.a.pred_hi)}.
                  </li>
                  <li>Grade distributions describe grading, not teaching quality.</li>
                </ol>
              </div>
            )}
          </div>

          <div className="dt-actions">
            <a className="solid" href={course.plat_url} target="_blank" rel="noopener">
              <span>+ Sections &amp; registration on UCSBPlat</span>
              <small aria-hidden>↗</small>
            </a>
            <Link className="plain caps" href="/about/">
              Method <span aria-hidden>↓</span>
            </Link>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- bottom-left: file counter */}
      {course && cur && !missing && (
        <div className="counter">
          {mode === "overview" ? (
            <>
              <div className="caps c-l">Instructor / select</div>
              <div className="c-n">
                <Roll text={pad2(sel + 1)} />
                <span className="c-of">/ {pad2(ranked.length)}</span>
              </div>
              <div className="c-ticks">
                <button aria-label="Previous instructor" onClick={() => step(-1)}>
                  ↑
                </button>
                <span className="ticks" aria-hidden>
                  {ranked.slice(0, 40).map((_, i) => (
                    <i key={i} className={i === sel ? "on" : ""} />
                  ))}
                </span>
                <button aria-label="Next instructor" onClick={() => step(1)}>
                  ↓
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="c-n big">
                NO.
                <Roll text={pad3(sel + 1)} />
              </div>
              <div className="caps c-l">Ranked in {course.code}</div>
              <div className="caps c-hint">
                Drag to inspect <span aria-hidden>↔</span>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "overview" && course && (
        <div className="hints caps" aria-hidden>
          <span className="glyph">↑ ↓</span> Switch file <i>/</i> <span className="glyph">↵</span> Open <i>/</i> <span className="glyph">/</span> Search
        </div>
      )}

      <div className="powered">
        Powered by <b>Registrar data</b> <i />
      </div>
      <footer className="hud-foot caps">
        <span>
          <i className="sq" /> Session authorized · public read-only
        </span>
        <span className="right">
          <span>Daily Nexus · Registrar 2009–2026</span>
          <i>/</i>
          <Clock />
          <i>/</i>
          <Link href="/about/">Method ↗</Link>
        </span>
      </footer>

      {search && <SearchModal onClose={() => setSearch(false)} onOpen={openCourse} />}
    </div>
  );
}

// ------------------------------------------------------------------ position strip (2D)

function Position({
  course,
  ranked,
  sel,
  onPick,
}: {
  course: Course;
  ranked: Instructor[];
  sel: number;
  onPick: (i: number) => void;
}) {
  const cur = ranked[sel];
  const base = course.baseline.a;
  const lo = Math.max(0, Math.floor(Math.min(base.lo, ...ranked.map((i) => i.a.lo)) * 10) / 10);
  const hi = Math.min(1, Math.ceil(Math.max(base.hi, ...ranked.map((i) => i.a.hi)) * 10) / 10);
  const x = (p: number) => 2 + ((p - lo) / Math.max(hi - lo, 0.1)) * 96;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += hi - lo > 0.5 ? 0.2 : 0.1) ticks.push(Math.round(t * 100) / 100);
  const width = cur.a.hi - cur.a.lo;
  return (
    <div>
      <div className="tb-l caps">Era-adjusted A-rate, every instructor of {course.code}</div>
      <div className="strip">
        <span
          className="s-band"
          style={{
            left: `${x(base.lo)}%`,
            width: `${x(base.hi) - x(base.lo)}%`,
          }}
        />
        <span className="s-typ" style={{ left: `${x(base.est)}%` }} />
        {ranked.map((i, k) => (
          <button
            key={i.name}
            className={`s-dot${k === sel ? " on" : ""}`}
            style={{ left: `${x(i.a.est)}%` }}
            onClick={() => onPick(k)}
            aria-label={`${displayName(i.name)} ${pct(i.a.est)}`}
          />
        ))}
        <span
          className="s-ci"
          style={{
            left: `${x(cur.a.lo)}%`,
            width: `${x(cur.a.hi) - x(cur.a.lo)}%`,
          }}
        />
        <span className="s-sel" style={{ left: `${x(cur.a.est)}%` }} />
      </div>
      <div className="s-axis" aria-hidden>
        {ticks.map((t) => (
          <span key={t} style={{ left: `${x(t)}%` }}>
            {Math.round(t * 100)}%
          </span>
        ))}
      </div>
      <p>
        Ranked{" "}
        <b>
          {sel + 1} of {ranked.length}
        </b>{" "}
        by estimate, but intervals overlap: the chance this instructor grades above a typical one is{" "}
        <b>{pct(cur.a.p_above)}</b>. Shaded band: a new instructor ({range(base.lo, base.hi)}); line: typical (
        {pct(base.est)}).
        {cur.offerings < 2
          ? " One offering only, so the estimate is pulled hard toward typical and the glass stays frosted."
          : width > 0.3
            ? ` Interval ${Math.round(width * 100)} points wide: still uncertain.`
            : ""}
      </p>
    </div>
  );
}

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => setT(new Date().toTimeString().slice(0, 8));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return <Roll text={t} stagger={0} />;
}

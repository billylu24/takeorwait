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
import type { Course, Instructor, Photos, Upcoming } from "@/lib/types";

type Mode = "overview" | "detail";
type Tab = "position" | "effect" | "notes";
type Scope = "all" | "next";

/** One file in the drawer: a historical instructor, or next quarter's instructor with no history in this course. */
type Entry = { key: string; name: string; inst: Instructor | null; rank: number | null; next: boolean };

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
  return { slug: q.get("c") ?? DEFAULT, inst: q.get("i"), scope: (q.get("s") === "next" ? "next" : "all") as Scope };
}

/** "MIRZA D" -> ["MIRZA", "D."]; "ZHOU BOHAN" -> ["ZHOU", "Bohan"] */
function splitName(name: string): [string, string] {
  const [last, ...rest] = name.split(" ");
  return [last, rest.map((t) => (t.length === 1 ? `${t}.` : t[0] + t.slice(1).toLowerCase())).join(" ")];
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
  const [scope, setScope] = useState<Scope>("all");
  const [upcoming, setUpcoming] = useState<Upcoming | null>(null);
  const [photos, setPhotos] = useState<Photos>({});
  const pendingInst = useRef<string | null>(null);
  const selKey = useRef<string | null>(null);
  const selRef = useRef(0);
  selRef.current = sel;

  // ---- ranked files for the current course
  const ranked = useMemo<Instructor[]>(
    () => (course ? [...course.instructors].sort((a, b) => b.a.est - a.a.est) : []),
    [course],
  );
  const nextRows = useMemo(() => (slug && upcoming?.courses[slug]) || [], [slug, upcoming]);
  const nextSet = useMemo(() => new Set(nextRows.map((r) => r.match).filter(Boolean)), [nextRows]);
  const canNext = nextRows.length > 0;
  const view: Scope = canNext ? scope : "all";

  const entries = useMemo<Entry[]>(() => {
    const hist = ranked.map((i, k) => ({ key: i.name, name: i.name, inst: i, rank: k + 1, next: nextSet.has(i.name) }));
    if (view === "all") return hist;
    const fresh = nextRows
      .filter((r) => !r.match)
      .map((r) => ({ key: `new:${r.name}`, name: r.name, inst: null, rank: null, next: true }));
    const base = course?.baseline.a.est ?? 0;
    return [...hist.filter((e) => e.next), ...fresh].sort((a, b) => (b.inst?.a.est ?? base) - (a.inst?.a.est ?? base));
  }, [ranked, nextSet, nextRows, view, course]);

  const latest = useMemo(
    () =>
      entries.reduce((best, e, k) => ((e.inst?.last_t ?? 9999) > (entries[best].inst?.last_t ?? 9999) ? k : best), 0),
    [entries],
  );
  const quarter = upcoming?.quarter ?? "Next quarter";
  const files = useMemo<CassetteData[]>(() => {
    if (!course) return [];
    const b = course.baseline.a;
    return entries.map((e) => {
      const i = e.inst;
      const photo = photos[`${course.dept}:${e.name}`];
      const [last, rest] = splitName(photo?.display ?? e.name);
      return {
        name: displayName(e.name),
        nameLast: photo ? (photo.display.split(" ").slice(-1)[0] ?? last) : last,
        nameRest: photo ? photo.display.split(" ").slice(0, -1).join(" ") : rest,
        no: e.rank ?? 0,
        total: ranked.length,
        est: i ? i.a.est : b.est,
        lo: i ? i.a.lo : b.lo,
        hi: i ? i.a.hi : b.hi,
        pAbove: i ? i.a.p_above : 0.5,
        typical: b.est,
        offerings: i ? i.offerings : 0,
        students: i ? i.students : 0,
        last: i ? i.last : "",
        next: e.next,
        quarter,
        photo: photo ? `/photos/${photo.file}` : undefined,
      };
    });
  }, [entries, course, ranked.length, photos, quarter]);

  // ---- boot: URL, theme, WebGL
  useEffect(() => {
    const { slug, inst, scope } = readUrl();
    pendingInst.current = inst;
    setSlug(slug);
    setScope(scope);
    fetch("/data/upcoming.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUpcoming)
      .catch(() => setUpcoming(null));
    fetch("/photos/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setPhotos)
      .catch(() => setPhotos({}));
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

  // a new course starts without a remembered instructor (declared first so it runs before the choice below)
  useEffect(() => {
    setTab("position");
    selKey.current = null;
  }, [course]);

  // ---- choose the file to show whenever the list changes (new course, scope switch, schedule loaded):
  // keep the same instructor if they are still in the drawer, else the one who taught it most recently
  useEffect(() => {
    if (!course || !entries.length) return;
    const want = pendingInst.current;
    if (want) pendingInst.current = null;
    const byUrl = want ? entries.findIndex((e) => islug(e.name) === want) : -1;
    const kept = selKey.current ? entries.findIndex((e) => e.key === selKey.current) : -1;
    const k = byUrl >= 0 ? byUrl : kept >= 0 ? kept : latest;
    selKey.current = entries[k].key;
    setSel(k);
    if (want && byUrl < 0) setMode("overview");
    setRevealed(false);
  }, [course, entries, latest]);

  // remember who is selected by key; skip the commit where the list itself changed (sel is still the old index there)
  const lastEntries = useRef(entries);
  useEffect(() => {
    if (lastEntries.current !== entries) {
      lastEntries.current = entries;
      return;
    }
    if (entries[sel]) selKey.current = entries[sel].key;
  }, [entries, sel]);

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
    if (new URLSearchParams(location.search).has("debug"))
      (window as unknown as { __archive?: ArchiveScene }).__archive = s;
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
    if (view === "next") q.set("s", "next");
    if (mode === "detail" && entries[sel]) q.set("i", islug(entries[sel].name));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [course, slug, mode, sel, entries, view]);

  const step = useCallback(
    (d: number) => setSel((s) => Math.max(0, Math.min(entries.length - 1, s + d))),
    [entries.length],
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

  const entry = entries[sel];
  const cur = entry?.inst ?? null;
  const base = course?.baseline.a;
  const nextCount = ranked.filter((i) => nextSet.has(i.name)).length;
  const newCount = nextRows.filter((r) => !r.match).length;
  const sens = course?.sensitivity;
  const st = sens ? SENSITIVITY_TEXT[sens.label] : null;
  const fileKey = `${slug}-${view}-${entry?.key}-${mode}`;
  const ready = Boolean(course && entry && base && !missing);

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
          {course && !missing && (
            <div className="scope">
              <button
                className="sw caps"
                role="switch"
                aria-checked={view === "next"}
                aria-label={`Show only instructors teaching ${quarter}`}
                disabled={!canNext}
                onClick={() => setScope(view === "next" ? "all" : "next")}
              >
                <span className={view === "all" ? "on" : ""}>All history</span>
                <span className={view === "next" ? "on" : ""}>{quarter}</span>
                <i className={`thumb ${view}`} aria-hidden />
              </button>
              <div className="legend caps">
                <span>
                  <i className="blk next" /> Teaching {quarter}
                </span>
                <span>
                  <i className="blk past" /> History only
                </span>
              </div>
              {!canNext && upcoming && <div className="legend caps muted">Not on the {quarter} schedule</div>}
            </div>
          )}
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
      {ready && mode === "overview" && (
        <section className="panel ov" aria-live="polite">
          <div className="kick caps">
            Internal database <i>/</i> {course!.dept}
          </div>
          <h2 className="ov-title">
            Course file: <Roll text={course!.code} />
          </h2>
          <div className="ov-rule" />
          <div className="ov-row caps">
            <span>
              <Roll
                text={`${course!.summary.regular_offerings} offerings · ${num(course!.summary.students)} students · ${ranked.length} instructor${ranked.length === 1 ? "" : "s"}`}
                stagger={6}
              />
              {canNext && (
                <span className="next-note">
                  {nextCount} teaching {quarter}
                  {newCount ? ` + ${newCount} new` : ""}
                </span>
              )}
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
            <div className="q-l caps">02 · Typical offering now ({course!.current_era.replace("-", "–")} level)</div>
            <div className="q-v">
              <span className="q-num">
                <Roll text={`${pct(base!.est)} A`} />
                <small className="caps">
                  New instructor <Roll text={range(base!.lo, base!.hi)} stagger={6} />
                </small>
              </span>
            </div>
          </div>

          <button className={`access${entry!.next ? " is-next" : ""}`} onClick={() => setMode("detail")}>
            <span className="no">{entry!.rank ? `NO.${pad3(entry!.rank)}` : "NEW"}</span>
            <span className="nm">
              <Roll text={displayName(entry!.name)} />
            </span>
            <span className="vv">
              <Roll
                text={cur ? `${pct(cur.a.est)} (${range(cur.a.lo, cur.a.hi)})` : `new · ${range(base!.lo, base!.hi)}`}
                stagger={6}
              />
            </span>
            <span className="go caps">
              Access file <span aria-hidden>→</span>
            </span>
          </button>
        </section>
      )}

      {/* ---------------------------------------------------------------- detail: one instructor */}
      {ready && mode === "detail" && (
        <section className="panel dt" aria-live="polite">
          <div className="file-line caps">
            <span>
              File {course!.code.replace(/\s+/g, "-")}-
              <Roll text={entry!.rank ? pad3(entry!.rank) : "NEW"} />
            </span>
            <span className="muted">Reference area</span>
          </div>
          <h1 className="dt-name">
            <Roll text={displayName(entry!.name).toUpperCase()} />
          </h1>
          <div className="dt-sub">
            <span>{course!.code}</span>
            <small className="caps">Instructor file</small>
            {entry!.next && <span className="tag-mini next caps">Teaching {quarter}</span>}
            {!entry!.next && sel === latest && <span className="tag-mini caps">Most recent</span>}
            {cur && cur.offerings < 2 && <span className="tag-mini warn caps">1 offering</span>}
            {!cur && <span className="tag-mini warn caps">No history here</span>}
          </div>
          <div className="dt-rule" />
          <dl className="fields">
            {(cur
              ? [
                  ["Era-adjusted A-rate", pct(cur.a.est)],
                  ["90% interval", range(cur.a.lo, cur.a.hi)],
                  ["Rank in course", `${pad2(entry!.rank!)} / ${pad2(ranked.length)}`],
                  ["P(above typical)", pct(cur.a.p_above)],
                  ["Offerings · students", `${cur.offerings} · ${num(cur.students)}`],
                  ["Taught", cur.first === cur.last ? cur.last : `${cur.first} – ${cur.last}`],
                ]
              : [
                  ["Expected A-rate (new)", pct(base!.est)],
                  ["90% interval", range(base!.lo, base!.hi)],
                  ["Rank in course", "— / no history"],
                  ["P(above typical)", "50% by definition"],
                  ["Offerings · students", "0 · 0"],
                  ["Taught", `First time, ${quarter}`],
                ]
            ).map(([k, v], i) => (
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
            {tab === "position" && (
              <Position
                course={course!}
                ranked={ranked}
                cur={cur}
                onPick={(name) => {
                  const k = entries.findIndex((e) => e.key === name);
                  if (k >= 0) setSel(k);
                }}
              />
            )}
            {tab === "effect" && (
              <div>
                <div className="tb-l caps">Instructor effect / {course!.code}</div>
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
                    Estimates are on the course’s {course!.current_era.replace("-", "–")} grading level. Era drift is
                    large: {course!.eras.map((e) => `${e.era.replace("-", "–")} ${pct(e.level)}`).join(", ")}.
                  </li>
                  {cur ? (
                    <li>
                      Raw A-rate over their offerings is {pct(cur.raw_a)}; the estimate is shrunk toward the typical
                      instructor when evidence is thin. A single next offering could land in{" "}
                      {range(cur.a.pred_lo, cur.a.pred_hi)}.
                    </li>
                  ) : (
                    <li>
                      {displayName(entry!.name)} has no letter-grade record in {course!.code}, so the file shows what
                      the model expects from a new instructor here.
                    </li>
                  )}
                  {upcoming && (
                    <li>
                      {quarter} instructors: UCSB public schedule of classes, fetched {upcoming.fetched_at.slice(0, 10)}
                      ; it can change before the quarter starts.
                    </li>
                  )}
                  <li>Grade distributions describe grading, not teaching quality.</li>
                </ol>
              </div>
            )}
          </div>

          <div className="dt-actions">
            <a className="solid" href={course!.plat_url} target="_blank" rel="noopener">
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
      {ready && (
        <div className="counter">
          {mode === "overview" ? (
            <>
              <div className="caps c-l">Instructor / select</div>
              <div className="c-n">
                <Roll text={pad2(sel + 1)} />
                <span className="c-of">/ {pad2(entries.length)}</span>
              </div>
              <div className="c-ticks">
                <button aria-label="Previous instructor" onClick={() => step(-1)}>
                  ↑
                </button>
                <span className="ticks" aria-hidden>
                  {entries.slice(0, 40).map((e, i) => (
                    <i key={e.key} className={`${i === sel ? "on" : ""}${e.next ? " next" : ""}`} />
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
                {entry!.rank ? "NO." : ""}
                <Roll text={entry!.rank ? pad3(entry!.rank) : "NEW"} />
              </div>
              <div className="caps c-l">{entry!.rank ? `Ranked in ${course!.code}` : `New to ${course!.code}`}</div>
              <div className="caps c-hint">
                Drag to inspect <span aria-hidden>↔</span>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "overview" && course && (
        <div className="hints caps" aria-hidden>
          <span className="glyph">↑ ↓</span> Switch file <i>/</i> <span className="glyph">↵</span> Open <i>/</i>{" "}
          <span className="glyph">/</span> Search
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
  cur,
  onPick,
}: {
  course: Course;
  ranked: Instructor[];
  cur: Instructor | null;
  onPick: (name: string) => void;
}) {
  const base = course.baseline.a;
  const at = cur ? cur.a : { est: base.est, lo: base.lo, hi: base.hi, p_above: 0.5 };
  const lo = Math.max(0, Math.floor(Math.min(base.lo, ...ranked.map((i) => i.a.lo)) * 10) / 10);
  const hi = Math.min(1, Math.ceil(Math.max(base.hi, ...ranked.map((i) => i.a.hi)) * 10) / 10);
  const x = (p: number) => 2 + ((p - lo) / Math.max(hi - lo, 0.1)) * 96;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += hi - lo > 0.5 ? 0.2 : 0.1) ticks.push(Math.round(t * 100) / 100);
  const rank = cur ? ranked.indexOf(cur) + 1 : 0;
  const width = at.hi - at.lo;
  return (
    <div>
      <div className="tb-l caps">Era-adjusted A-rate, every instructor of {course.code}</div>
      <div className="strip">
        <span className="s-band" style={{ left: `${x(base.lo)}%`, width: `${x(base.hi) - x(base.lo)}%` }} />
        <span className="s-typ" style={{ left: `${x(base.est)}%` }} />
        {ranked.map((i) => (
          <button
            key={i.name}
            className={`s-dot${i === cur ? " on" : ""}`}
            style={{ left: `${x(i.a.est)}%` }}
            onClick={() => onPick(i.name)}
            aria-label={`${displayName(i.name)} ${pct(i.a.est)}`}
          />
        ))}
        <span className="s-ci" style={{ left: `${x(at.lo)}%`, width: `${x(at.hi) - x(at.lo)}%` }} />
        <span className="s-sel" style={{ left: `${x(at.est)}%` }} />
      </div>
      <div className="s-axis" aria-hidden>
        {ticks.map((t) => (
          <span key={t} style={{ left: `${x(t)}%` }}>
            {Math.round(t * 100)}%
          </span>
        ))}
      </div>
      {cur ? (
        <p>
          Ranked{" "}
          <b>
            {rank} of {ranked.length}
          </b>{" "}
          by estimate, but intervals overlap: the chance this instructor grades above a typical one is{" "}
          <b>{pct(at.p_above)}</b>. Shaded band: a new instructor ({range(base.lo, base.hi)}); line: typical (
          {pct(base.est)}).
          {cur.offerings < 2
            ? " One offering only, so the estimate is pulled hard toward typical and the glass stays frosted."
            : width > 0.3
              ? ` Interval ${Math.round(width * 100)} points wide: still uncertain.`
              : ""}
        </p>
      ) : (
        <p>
          No history in this course: the best estimate is the course’s typical instructor, <b>{pct(base.est)}</b>, with
          the wide new-instructor range <b>{range(base.lo, base.hi)}</b>. Dots: everyone who has taught it.
        </p>
      )}
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

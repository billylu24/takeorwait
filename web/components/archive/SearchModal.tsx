"use client";

// Course index: a modal directory, in the manner of RhineLabUI's archive index.
import { useEffect, useMemo, useRef, useState } from "react";

import { SENSITIVITY_TEXT, displayName, num } from "@/lib/format";
import type { IndexRow } from "@/lib/types";

const ALIASES: Record<string, string> = { CS: "CMPSC", CE: "ECE", STATS: "PSTAT", STAT: "PSTAT" };
const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9&]/g, "");

function normalize(q: string) {
  const m = q
    .trim()
    .toUpperCase()
    .match(/^([A-Z&]+)\s*(.*)$/);
  if (m && ALIASES[m[1]]) return compact(ALIASES[m[1]] + m[2]);
  return compact(q);
}

type Hit = { row: IndexRow; score: number; via?: string };

function search(index: IndexRow[], q: string): Hit[] {
  const key = normalize(q);
  if (!key) return [];
  const hits: Hit[] = [];
  for (const row of index) {
    const code = compact(row[0]);
    let score = 0;
    let via: string | undefined;
    if (code === key) score = 100;
    else if (code.startsWith(key)) score = 60 - Math.min(code.length - key.length, 20);
    else if (key.length >= 3 && row[5].some((n) => compact(n).startsWith(key))) {
      score = 30;
      via = row[5].find((n) => compact(n).startsWith(key));
    } else if (key.length >= 3 && code.includes(key)) score = 10;
    if (score > 0) hits.push({ row, score: score + Math.log10(row[3] + 1), via });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}

const SUGGEST = ["CMPSC 24", "PHYS 7A", "MATH 4B", "MATH 6A", "CHEM 1A", "ECON 1", "WRIT 2", "PSTAT 120A"];

let cached: IndexRow[] | null = null;
let loading: Promise<IndexRow[]> | null = null;

/** The course index (search and the department's column order), fetched once per page. */
export function loadIndex(): Promise<IndexRow[]> {
  loading ??= fetch("/data/index.json")
    .then((r) => r.json())
    .then((rows: IndexRow[]) => (cached = rows))
    .catch(() => (cached = []));
  return loading;
}

export default function SearchModal({ onClose, onOpen }: { onClose: () => void; onOpen: (slug: string) => void }) {
  const [index, setIndex] = useState<IndexRow[] | null>(cached);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    if (cached) return;
    loadIndex().then(setIndex);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (!index) return [];
    if (q.trim()) return search(index, q);
    const bySlug = new Map(index.map((r) => [r[0], r]));
    return SUGGEST.map((c) => bySlug.get(c))
      .filter((r): r is IndexRow => Boolean(r))
      .map((row) => ({ row, score: 0 }));
  }, [index, q]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Course index"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card">
        <div className="modal-top caps">
          <span>TakeOrWait / course directory</span>
          <button onClick={onClose}>
            Close <span aria-hidden>✕</span>
          </button>
        </div>
        <h2>
          Course index <small>registrar archive search</small>
        </h2>
        <div className="field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="14" cy="10" r="6" />
            <path d="m9.5 14.5-6 6" />
          </svg>
          <input
            ref={input}
            value={q}
            placeholder="Course or instructor, e.g. CMPSC 24"
            aria-label="Search courses or instructors"
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) onOpen(hits[active].row[1]);
              else if (e.key === "Escape") onClose();
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="rows" role="listbox">
          <div className="rows-head caps">
            <span>File</span>
            <span>Record</span>
            <span>Instructor effect</span>
            <span />
          </div>
          {!index && <div className="rows-empty caps">Connecting to internal database…</div>}
          {index && hits.length === 0 && <div className="rows-empty caps">No record matches “{q}”</div>}
          {hits.map((h, i) => (
            <button
              key={h.row[1]}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onClick={() => onOpen(h.row[1])}
            >
              <span className="code">{h.row[0]}</span>
              <span className="meta">
                {h.via ? `taught by ${displayName(h.via)} · ` : ""}
                {h.row[2]} offerings · {num(h.row[3])} students · last {h.row[4]}
              </span>
              <span className={`tag ${h.row[6]}`}>{SENSITIVITY_TEXT[h.row[6]].short}</span>
              <span className="arrow" aria-hidden>
                ↗
              </span>
            </button>
          ))}
        </div>
        <div className="modal-foot caps">
          <span>{index ? `${pad(hits.length)} records ${q.trim() ? "found" : "suggested"}` : "—"}</span>
          <span>
            Internal database <i className="dot" /> {index ? "connected" : "connecting"}
          </span>
        </div>
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

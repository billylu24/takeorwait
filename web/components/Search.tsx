"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SENSITIVITY_TEXT, courseHref, displayName, num } from "@/lib/format";
import type { IndexRow } from "@/lib/types";

const ALIASES: Record<string, string> = { CS: "CMPSC", CE: "ECE", STATS: "PSTAT", STAT: "PSTAT" };
const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9&]/g, "");

function normalize(q: string) {
  const m = q.trim().toUpperCase().match(/^([A-Z&]+)\s*(.*)$/);
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
  return hits.sort((a, b) => b.score - a.score).slice(0, 10);
}

export default function Search({ autoFocus = false }: { autoFocus?: boolean }) {
  const [index, setIndex] = useState<IndexRow[] | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/data/index.json")
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const hits = useMemo(() => (index ? search(index, q) : []), [index, q]);
  const go = (h: Hit) => router.push(courseHref(h.row[1]));

  return (
    <div className="search" ref={box}>
      <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        aria-label="Search courses or instructors"
        placeholder="Course or instructor, e.g. CMPSC 24"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            go(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim() && (
        <div className="results" role="listbox">
          {!index && <div className="empty">Loading course index…</div>}
          {index && hits.length === 0 && <div className="empty">No course matches “{q}”.</div>}
          {hits.map((h, i) => (
            <a
              key={h.row[1]}
              href={courseHref(h.row[1])}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              role="option"
              aria-selected={i === active}
            >
              <span className="code">{h.row[0]}</span>
              <span className="meta">
                {h.via ? `taught by ${displayName(h.via)} · ` : ""}
                {h.row[2]} offerings · {num(h.row[3])} students · last {h.row[4]}
              </span>
              <span className={`badge ${h.row[6]}`}>{SENSITIVITY_TEXT[h.row[6]].short}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

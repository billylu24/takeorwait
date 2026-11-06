"use client";

// Rolling text: when the value changes, each changed character rolls up out of its slot with a short motion blur
// while the new one rolls in from below (after RhineLabUI's rolling titles and numbers).
import { useEffect, useState } from "react";

export default function Roll({
  text,
  className = "",
  stagger = 14,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const [s, setS] = useState({ cur: text, prev: text, gen: 0 });
  useEffect(() => {
    setS((o) => (o.cur === text ? o : { cur: text, prev: o.cur, gen: o.gen + 1 }));
  }, [text]);
  const { cur, prev, gen } = s;
  const n = Math.max(cur.length, prev.length);
  const nb = (c: string) => (c === " " ? " " : c);
  return (
    <span className={`roll ${className}`} aria-label={cur} role="text">
      {Array.from({ length: n }, (_, i) => {
        const a = prev[i] ?? "";
        const b = cur[i] ?? "";
        if (gen === 0 || a === b)
          return b ? (
            <span key={i} className="rc" aria-hidden>
              {nb(b)}
            </span>
          ) : null;
        return (
          <span
            key={`${i}-${gen}`}
            className={`rc swap${b ? "" : " gone"}`}
            aria-hidden
            style={{ animationDelay: `${i * stagger}ms` }}
          >
            <span className="rc-in" style={{ animationDelay: `${i * stagger}ms` }}>
              {b ? nb(b) : ""}
            </span>
            {a && (
              <span className="rc-out" style={{ animationDelay: `${i * stagger}ms` }}>
                {nb(a)}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** A value hidden under an ink bar that retracts when `on` (the "document decryption" mask). */
export function Masked({
  on,
  k,
  delay = 0,
  children,
}: {
  on: boolean;
  k: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <span key={k} className={`masked${on ? " on" : ""}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </span>
  );
}

import type { SensitivityLabel } from "./types";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";

export const pct = (x: number | null | undefined, digits = 0) =>
  x == null ? "–" : `${(x * 100).toFixed(digits)}%`;

export const range = (lo: number | null | undefined, hi: number | null | undefined) =>
  lo == null || hi == null ? "–" : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;

export const num = (x: number) => x.toLocaleString("en-US");

// "MIRZA D" -> "Mirza D", "GARCIA-CERVER" -> "Garcia-Cerver". Initials stay uppercase.
export function displayName(raw: string) {
  return raw
    .split(" ")
    .map((w) => (w.length <= 1 ? w : w.toLowerCase().replace(/(^|[-'])([a-z])/g, (_, p, c) => p + c.toUpperCase())))
    .join(" ");
}

export const QUARTER_NAME = { W: "Winter", S: "Spring", M: "Summer", F: "Fall" } as const;

export const SENSITIVITY_TEXT: Record<SensitivityLabel, { title: string; short: string }> = {
  large: { title: "Instructor matters a lot", short: "Matters a lot" },
  moderate: { title: "Instructor matters somewhat", short: "Matters somewhat" },
  small: { title: "Instructor barely matters", short: "Barely matters" },
  unclear: { title: "Too noisy to tell", short: "Unclear" },
  insufficient: { title: "Not enough repeat instructors to tell", short: "Not enough data" },
};

export const courseHref = (slug: string) => `/course/?c=${encodeURIComponent(slug)}`;

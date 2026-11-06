// Shapes of the JSON written by analysis/build_site_data.py.

export type Interval = { est: number; lo: number; hi: number };

export type SensitivityLabel = "large" | "moderate" | "small" | "unclear" | "insufficient";

export type Instructor = {
  name: string;
  offerings: number;
  students: number;
  first: string;
  last: string;
  last_t: number;
  quarters: string;
  raw_a: number;
  raw_df: number;
  a: Interval & { pred_lo: number; pred_hi: number; p_above: number };
  df: Interval & { p_above: number };
};

// [t, year, quarter (W/S/M/F), instructor, nGraded, nA, aLo95, aHi95, nDF, avgGPA]
export type HistoryRow = [number, number, "W" | "S" | "M" | "F", string, number, number, number, number, number, number | null];

export type Course = {
  code: string;
  dept: string;
  plat_url: string;
  summary: {
    offerings: number;
    regular_offerings: number;
    summer_offerings: number;
    students: number;
    instructors: number;
    first: string;
    last: string;
  };
  current_era: string;
  eras: { era: string; level: number; lo: number; hi: number; offerings: number }[];
  baseline: {
    a: Interval & { era: string; pred_lo: number; pred_hi: number };
    df: Interval & { era: string; pred_lo: number; pred_hi: number };
  };
  same_instructor_swing: { lo: number; hi: number; centre: number };
  sensitivity: {
    score: number | null;
    lo: number | null;
    hi: number | null;
    label: SensitivityLabel;
    repeat_instructors: number;
    offerings: number;
  };
  instructors: Instructor[];
  history: HistoryRow[];
};

// [code, slug, offerings, students, last quarter, recent instructors, sensitivity label]
export type IndexRow = [string, string, number, number, string, string[], SensitivityLabel];

export type Manifest = {
  built_at: string;
  source: { url: string; file: string; sha256: string; fetched_at: string; first: string; last: string };
  courses: number;
  sensitivity_labels: Record<SensitivityLabel, number>;
  model: Record<string, unknown>;
};

// web/public/data/upcoming.json, written by analysis/build_upcoming.py
export type Upcoming = {
  quarter: string;
  quarter_code: string;
  source: string;
  fetched_at: string;
  courses: Record<string, { name: string; match: string | null }[]>;
};

// web/public/photos/manifest.json: "DEPT:REGISTRAR NAME" -> a verified photo from an official UCSB page
export type Photos = Record<string, { file: string; display: string; source: string }>;

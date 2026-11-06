// Build-time data access (server components only).
import fs from "node:fs";
import path from "node:path";

import type { Course, IndexRow, Manifest } from "./types";

const DATA = path.join(process.cwd(), "public", "data");

export function readIndex(): IndexRow[] {
  return JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
}

export function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(path.join(DATA, "manifest.json"), "utf8"));
}

export function readCourse(slug: string): Course | null {
  const file = path.join(DATA, "courses", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

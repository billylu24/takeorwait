import type { Metadata } from "next";
import Link from "next/link";

import { REPO_URL } from "@/lib/format";
import { readManifest } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TakeOrWait · UCSB course decisions", template: "%s · TakeOrWait" },
  description:
    "Should I take this UCSB course now, with this instructor, or wait? Era-adjusted grade history with sample sizes and intervals, from Registrar data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const m = readManifest();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              Take<span>Or</span>Wait
            </Link>
            <nav>
              <Link href="/about/">How it works</Link>
              {REPO_URL && <a href={REPO_URL}>GitHub</a>}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>
              Data: <a href={m.source.url}>Daily Nexus grades data</a> (UCSB Office of the Registrar, via Public Records
              Act requests), {m.source.first}–{m.source.last}, fetched {m.source.fetched_at.slice(0, 10)}. Grade
              distributions describe grading, not teaching quality.
            </p>
            <p>
              Independent student project, not affiliated with UCSB. Built {m.built_at.slice(0, 10)} · source{" "}
              <span className="mono">sha256 {m.source.sha256.slice(0, 12)}</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

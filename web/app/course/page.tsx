"use client";

// One static page for all 8,600 courses: it reads ?c=<slug> and fetches /data/courses/<slug>.json.
// Pre-rendering a page per course embedded each course's data twice and produced ~500 MB of HTML.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import CourseView from "@/components/CourseView";
import Search from "@/components/Search";
import type { Course } from "@/lib/types";

type State = { status: "loading" } | { status: "missing"; slug: string } | { status: "ok"; course: Course };

function Loader() {
  const slug = useSearchParams().get("c") ?? "";
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!/^[A-Za-z0-9-]+$/.test(slug)) {
      setState({ status: "missing", slug });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    fetch(`/data/courses/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((course: Course) => {
        if (!live) return;
        setState({ status: "ok", course });
        document.title = `${course.code} · TakeOrWait`;
      })
      .catch(() => live && setState({ status: "missing", slug }));
    return () => {
      live = false;
    };
  }, [slug]);

  if (state.status === "ok") return <CourseView c={state.course} />;
  return (
    <>
      <div style={{ marginTop: 20 }}>
        <Search />
      </div>
      <div className="course-head">
        {state.status === "loading" ? (
          <p className="facts">Loading…</p>
        ) : (
          <div>
            <h1>No data for “{state.slug.replace(/-/g, " ") || "?"}”</h1>
            <p className="facts">
              Only courses with at least one regular-quarter offering with five or more letter grades are included.{" "}
              <Link href="/">Back to search</Link>
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function CoursePage() {
  return (
    <Suspense fallback={<p className="facts">Loading…</p>}>
      <Loader />
    </Suspense>
  );
}

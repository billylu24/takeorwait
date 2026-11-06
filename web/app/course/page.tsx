// Old links (/course/?c=SLUG) keep working: same app, it reads ?c= itself.
import CourseApp from "@/components/archive/CourseApp";

export default function CoursePage() {
  return <CourseApp />;
}

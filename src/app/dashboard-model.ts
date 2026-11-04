import type { Lesson } from "../api/portal.ts";

export function featuredLesson(lessons: Lesson[], now: number) {
  const ordered = [...lessons].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const lesson = ordered.find(item => Date.parse(item.ends_at) > now) ?? ordered.at(-1);
  if (!lesson) return null;
  const phase = Date.parse(lesson.ends_at) <= now ? "finished" : Date.parse(lesson.starts_at) <= now ? "current" : "next";
  return { lesson, phase } as const;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courseLessons, getCourseLesson } from "@/data/course";
import { CourseMissionPlayer } from "@/components/course-mission-player";

export function generateStaticParams() {
  return courseLessons.map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  return {
    title: `${getCourseLesson(lessonId)?.title ?? "ミッション"} — 冒険`,
  };
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = getCourseLesson(lessonId);
  if (!lesson) notFound();
  return <CourseMissionPlayer key={lesson.id} lesson={lesson} />;
}

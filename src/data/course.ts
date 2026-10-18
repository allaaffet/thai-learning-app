import { chapter, lessons, parts, sources } from "@/data/curriculum";
import { alphabetSources } from "@/data/alphabet";
import { phaseTwoChapters, phaseTwoLessons } from "@/data/phase-two";
import { phaseThreeChapters, phaseThreeLessons } from "@/data/phase-three";
import { toneSources } from "@/data/syllables";
import { phaseFourChapters, phaseFourLessons } from "@/data/phase-four";
import { languageSources } from "@/data/language";

/** Existing chapter-one IDs remain the persistence boundary for saved progress. */
export const courseChapters = [
  chapter,
  ...phaseTwoChapters,
  ...phaseThreeChapters,
  ...phaseFourChapters,
];
export const courseLessons = [
  ...lessons,
  ...phaseTwoLessons,
  ...phaseThreeLessons,
  ...phaseFourLessons,
];
export const courseSources = [
  ...sources,
  ...alphabetSources,
  ...toneSources,
  ...languageSources,
];
export const courseParts = parts.map((part) => {
  const chapters = courseChapters.filter(
    (chapter) => chapter.partId === part.id,
  );
  return chapters.length
    ? {
        ...part,
        status: "available" as const,
        chapterIds: chapters.map((chapter) => chapter.id),
      }
    : part;
});
export function getCourseLesson(id: string) {
  return courseLessons.find((lesson) => lesson.id === id);
}
export function getChapterLessons(id: string) {
  return courseLessons.filter((lesson) => lesson.chapterId === id);
}
export function getCourseChapter(id: string) {
  return courseChapters.find((entry) => entry.id === id);
}

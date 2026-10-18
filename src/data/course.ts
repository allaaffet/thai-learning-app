import { chapter, lessons, parts, sources } from "@/data/curriculum";
import { alphabetSources } from "@/data/alphabet";
import { phaseTwoChapters, phaseTwoLessons } from "@/data/phase-two";
import { phaseThreeChapters, phaseThreeLessons } from "@/data/phase-three";
import { toneSources } from "@/data/syllables";

/** Existing chapter-one IDs remain the persistence boundary for saved progress. */
export const courseChapters = [
  chapter,
  ...phaseTwoChapters,
  ...phaseThreeChapters,
];
export const courseLessons = [
  ...lessons,
  ...phaseTwoLessons,
  ...phaseThreeLessons,
];
export const courseSources = [...sources, ...alphabetSources, ...toneSources];
export const courseParts = parts.map((part) =>
  part.id === "part-2"
    ? {
        ...part,
        status: "available" as const,
        chapterIds: phaseTwoChapters.map((entry) => entry.id),
      }
    : part.id === "part-3"
      ? {
          ...part,
          status: "available" as const,
          chapterIds: phaseThreeChapters.map((entry) => entry.id),
        }
      : part,
);
export function getCourseLesson(id: string) {
  return courseLessons.find((lesson) => lesson.id === id);
}
export function getChapterLessons(id: string) {
  return courseLessons.filter((lesson) => lesson.chapterId === id);
}
export function getCourseChapter(id: string) {
  return courseChapters.find((entry) => entry.id === id);
}

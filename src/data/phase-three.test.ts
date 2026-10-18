import { describe, expect, it } from "vitest";
import { phaseThreeChapters, phaseThreeLessons } from "./phase-three";
import { getCourseLesson } from "./course";
import { lookupSyllable, toneSources } from "./syllables";
import { analyzeEntry } from "./syllables";

const sourceIds = new Set(
  toneSources
    .filter((source) => source.access === "accessible")
    .map((source) => source.id),
);
describe("Phase 3の教材と判定用カタログの整合", () => {
  it("第3章の最後から声調8レッスンへ順番に進み、章内番号が連続する", () => {
    expect(phaseThreeLessons).toHaveLength(8);
    expect(
      phaseThreeChapters.map((chapter) => chapter.lessonIds.length),
    ).toEqual([4, 4]);
    for (const [index, lesson] of phaseThreeLessons.entries()) {
      expect(lesson.prerequisites).toEqual([
        index === 0 ? "vowel-compounds" : phaseThreeLessons[index - 1].id,
      ]);
      expect(lesson.number).toBe((index % 4) + 1);
      for (const id of lesson.relatedLessonIds)
        expect(getCourseLesson(id)).toBeDefined();
    }
  });
  it("追加40問が5問ずつあり、選択肢・正解・理由と出典を持つ", () => {
    expect(
      phaseThreeLessons.flatMap((lesson) => lesson.exercises),
    ).toHaveLength(40);
    for (const lesson of phaseThreeLessons) {
      expect(lesson.exercises).toHaveLength(5);
      expect(lesson.xp).toBe(40);
      expect(lesson.verification).toBe("unreviewed");
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(3);
      expect(lesson.summary.length).toBeGreaterThanOrEqual(3);
      for (const source of lesson.sourceIds)
        expect(sourceIds.has(source)).toBe(true);
      for (const exercise of lesson.exercises) {
        expect(
          new Set(exercise.options.map((option) => option.label)).size,
        ).toBe(exercise.options.length);
        expect(
          exercise.options.filter((option) => option.id === exercise.answerId),
        ).toHaveLength(1);
        expect(exercise.explanation.length).toBeGreaterThan(20);
        expect(exercise.relatedConcepts.length).toBeGreaterThan(0);
      }
    }
  });
  it("カタログと同じ語を例示するときIPA・声調を別の表記に変えない", () => {
    const examples = phaseThreeLessons.flatMap((lesson) => [
      ...lesson.explore,
      ...lesson.blocks.flatMap((block) => block.examples ?? []),
    ]);
    let compared = 0;
    for (const example of examples) {
      const entry = lookupSyllable(example.thai);
      if (!entry) continue;
      compared++;
      expect(example.ipa, example.thai).toBe(entry.ipa);
      expect(analyzeEntry(entry)).toMatchObject({
        status: "determined",
        tone: entry.expectedTone,
      });
    }
    expect(compared).toBeGreaterThan(20);
  });
});

import { describe, expect, it } from "vitest";
import { alphabetCharacters, vowelPatterns } from "./alphabet";
import { chapter, lessons } from "./curriculum";
import {
  courseChapters,
  courseLessons,
  courseParts,
  courseSources,
  getChapterLessons,
  getCourseChapter,
  getCourseLesson,
} from "./course";
import { phaseTwoChapters, phaseTwoLessons } from "./phase-two";
import {
  completeLesson,
  createEmptyProgress,
  getNextLesson,
  getTotalXp,
  isLessonUnlocked,
} from "@/lib/progress";

function expectUnique(values: string[]) {
  expect(new Set(values).size).toBe(values.length);
}

/** Include the current lesson because Practice follows its Learn and Explore. */
function learnedByLesson(id: string, path: string[] = []): Set<string> {
  if (path.includes(id)) throw new Error(`前提が循環しています: ${id}`);
  const lesson = getCourseLesson(id);
  if (!lesson) throw new Error(`前提のレッスンがありません: ${id}`);
  return new Set([
    id,
    ...lesson.prerequisites.flatMap((prerequisite) => [
      ...learnedByLesson(prerequisite, [...path, id]),
    ]),
  ]);
}

describe("Phase 1とPhase 2の教材統合", () => {
  it("既存6レッスンのID・順序・内容を保ったまま8レッスンを追加する", () => {
    expect(courseLessons).toHaveLength(14);
    expect(courseLessons.slice(0, 6)).toEqual(lessons);
    expect(courseLessons.slice(6)).toEqual(phaseTwoLessons);
    expect(courseChapters[0]).toEqual(chapter);
    expect(courseChapters.slice(1)).toEqual(phaseTwoChapters);
    expect(
      courseChapters.map((entry) => getChapterLessons(entry.id).length),
    ).toEqual([6, 5, 3]);
    expect(courseLessons.reduce((total, lesson) => total + lesson.xp, 0)).toBe(
      570,
    );
    expect(
      phaseTwoLessons.reduce((total, lesson) => total + lesson.xp, 0),
    ).toBe(330);
  });

  it("章・部・レッスンの両方向の参照と章内番号が一致する", () => {
    expect(courseParts).toHaveLength(8);
    expect(
      courseParts
        .filter((part) => part.status === "available")
        .map((part) => part.id),
    ).toEqual(["part-1", "part-2"]);
    for (const part of courseParts) {
      for (const chapterId of part.chapterIds) {
        expect(getCourseChapter(chapterId)?.partId).toBe(part.id);
      }
      if (part.status === "planned") expect(part.chapterIds).toEqual([]);
    }
    for (const entry of courseChapters) {
      const chapterLessons = getChapterLessons(entry.id);
      expect(chapterLessons.map((lesson) => lesson.id)).toEqual(
        entry.lessonIds,
      );
      expect(chapterLessons.map((lesson) => lesson.number)).toEqual(
        Array.from({ length: chapterLessons.length }, (_, index) => index + 1),
      );
      expect(
        courseParts.find((part) => part.id === entry.partId)?.chapterIds,
      ).toContain(entry.id);
    }
    expect(getCourseLesson("unknown-lesson")).toBeUndefined();
    expect(getCourseChapter("unknown-chapter")).toBeUndefined();
    expect(getChapterLessons("unknown-chapter")).toEqual([]);
  });

  it("新旧教材の識別子と出典が衝突しない", () => {
    expectUnique(courseSources.map((source) => source.id));
    expectUnique(courseChapters.map((entry) => entry.id));
    expectUnique(courseParts.map((part) => part.id));
    expectUnique(
      courseLessons.flatMap((lesson) => [
        lesson.id,
        ...lesson.blocks.map((block) => block.id),
        ...lesson.explore.map((item) => item.id),
        ...lesson.exercises.flatMap((exercise) => [
          exercise.id,
          ...exercise.options.map((option) => option.id),
        ]),
      ]),
    );
    for (const lesson of courseLessons) {
      expect(getCourseChapter(lesson.chapterId)).toBeDefined();
      expect(lesson.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of lesson.sourceIds) {
        expect(
          courseSources.find((source) => source.id === sourceId)?.access,
        ).toBe("accessible");
      }
      for (const relatedId of lesson.relatedLessonIds) {
        expect(getCourseLesson(relatedId)).toBeDefined();
      }
      expect(lesson.verification).toBe("unreviewed");
    }
  });

  it("すべての前提が存在し、循環せず、第1章の終了を経てPhase 2へ進む", () => {
    expect(courseLessons[0].prerequisites).toEqual([]);
    for (const lesson of courseLessons.slice(1)) {
      expect(lesson.prerequisites.length).toBeGreaterThan(0);
    }
    expect(getCourseLesson("mid-consonants")?.prerequisites).toEqual([
      "five-tones",
    ]);
    for (const lesson of phaseTwoLessons) {
      const learned = learnedByLesson(lesson.id);
      expect(learned.has("five-tones")).toBe(true);
      const currentIndex = courseLessons.findIndex(
        (entry) => entry.id === lesson.id,
      );
      for (const prerequisite of lesson.prerequisites) {
        expect(
          courseLessons.findIndex((entry) => entry.id === prerequisite),
        ).toBeLessThan(currentIndex);
      }
    }
  });

  it("文字の導入レッスンが実在し、演習の文字はその時点までに導入される", () => {
    for (const character of alphabetCharacters) {
      for (const introductionId of character.introducedInLessonIds) {
        const introduction = getCourseLesson(introductionId);
        expect(
          introduction,
          `${character.thai}: 存在しない導入 ${introductionId}`,
        ).toBeDefined();
        const text = JSON.stringify(introduction);
        expect(text).toContain(character.thai);
      }
    }
    const consonants = new Map(
      alphabetCharacters.map((character) => [character.thai, character]),
    );
    for (const lesson of phaseTwoLessons) {
      const learned = learnedByLesson(lesson.id);
      for (const exercise of lesson.exercises) {
        const text = [
          exercise.prompt,
          exercise.explanation,
          ...exercise.options.map((option) => option.label),
        ].join(" ");
        for (const letter of text) {
          const character = consonants.get(letter);
          if (!character) continue;
          expect(
            character.introducedInLessonIds.some((id) => learned.has(id)),
            `${exercise.id}: ${letter} は前提・本レッスンで未導入`,
          ).toBe(true);
        }
      }
    }
  });

  it("単語のIPAを文字ノート・母音ノート・レッスンで一致させる", () => {
    const examples = [
      ...alphabetCharacters.map((character) => character.example),
      ...vowelPatterns.map((vowel) => vowel.example),
      ...phaseTwoLessons.flatMap((lesson) =>
        lesson.blocks.flatMap((block) => block.examples ?? []),
      ),
      ...phaseTwoLessons.flatMap((lesson) => lesson.explore),
    ];
    const pronunciationByThai = new Map<string, string>();
    for (const example of examples) {
      const previous = pronunciationByThai.get(example.thai);
      if (previous !== undefined) {
        expect(example.ipa, `表記が不一致: ${example.thai}`).toBe(previous);
      }
      pronunciationByThai.set(example.thai, example.ipa);
    }
  });

  it("新40問すべてに一意の選択肢、正解、理由と関連概念がある", () => {
    const exercises = phaseTwoLessons.flatMap((lesson) => lesson.exercises);
    expect(exercises).toHaveLength(40);
    expect(courseLessons.flatMap((lesson) => lesson.exercises)).toHaveLength(
      70,
    );
    for (const lesson of phaseTwoLessons) {
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(3);
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
      expect(lesson.explore.length).toBeGreaterThanOrEqual(3);
      expect(lesson.summary.length).toBeGreaterThanOrEqual(3);
      expect(lesson.exercises).toHaveLength(5);
      expect(lesson.durationMinutes).toBeGreaterThanOrEqual(8);
      expect(lesson.durationMinutes).toBeLessThanOrEqual(12);
    }
    for (const exercise of exercises) {
      expectUnique(exercise.options.map((option) => option.id));
      expectUnique(exercise.options.map((option) => option.label));
      expect(exercise.options.length).toBeGreaterThanOrEqual(3);
      expect(
        exercise.options.filter((option) => option.id === exercise.answerId),
      ).toHaveLength(1);
      expect(exercise.prompt.length).toBeGreaterThan(5);
      expect(exercise.explanation.length).toBeGreaterThan(15);
      expect(exercise.relatedConcepts.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(exercise.difficulty);
      expect(["multiple-choice", "character-recognition"]).toContain(
        exercise.type,
      );
    }
  });

  it("既存の完了記録から第2章へ進み、14件を完了してもXPを重複加算しない", () => {
    let progress = createEmptyProgress();
    expect(
      phaseTwoLessons.every((lesson) => !isLessonUnlocked(progress, lesson)),
    ).toBe(true);
    for (const lesson of courseLessons) {
      expect(getNextLesson(progress, courseLessons)?.id).toBe(lesson.id);
      const result = completeLesson(progress, lesson, {
        correct: lesson.exercises.length,
        total: lesson.exercises.length,
        now: "2026-10-18T05:00:00Z",
      });
      expect(result.passed).toBe(true);
      expect(result.earnedXp).toBe(lesson.xp);
      progress = result.progress;
      if (lesson.id === "five-tones") {
        expect(getTotalXp(progress)).toBe(240);
        expect(getNextLesson(progress, courseLessons)?.id).toBe(
          "mid-consonants",
        );
      }
    }
    expect(Object.keys(progress.lessons)).toHaveLength(14);
    expect(getTotalXp(progress)).toBe(570);
    expect(getNextLesson(progress, courseLessons)).toBeUndefined();
    for (const lesson of phaseTwoLessons) {
      const result = completeLesson(progress, lesson, {
        correct: 4,
        total: 5,
        now: "2026-10-19T05:00:00Z",
      });
      expect(result.passed).toBe(true);
      expect(result.earnedXp).toBe(0);
      progress = result.progress;
    }
    expect(getTotalXp(progress)).toBe(570);
  });
});

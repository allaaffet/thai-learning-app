import { describe, expect, it } from "vitest";
import {
  chapter,
  characters,
  getLesson,
  lessons,
  parts,
  sources,
} from "./curriculum";

function expectUnique(values: string[]) {
  expect(new Set(values).size).toBe(values.length);
}

describe("curriculum integrity", () => {
  it("keeps every content identifier unique", () => {
    expectUnique(parts.map((part) => part.id));
    expectUnique(characters.map((character) => character.id));
    expectUnique(sources.map((source) => source.id));
    expectUnique(
      lessons.flatMap((lesson) => [
        lesson.id,
        ...lesson.blocks.map((block) => block.id),
        ...lesson.explore.map((item) => item.id),
        ...lesson.exercises.map((exercise) => exercise.id),
      ]),
    );
  });

  it("exposes only the six implemented lessons and planned later parts", () => {
    expect(lessons).toHaveLength(6);
    expect(chapter.lessonIds).toEqual(lessons.map((lesson) => lesson.id));
    expect(parts).toHaveLength(8);
    expect(parts[0].status).toBe("available");
    expect(parts[0].chapterIds).toEqual([chapter.id]);
    expect(
      parts
        .slice(1)
        .every(
          (part) => part.status === "planned" && part.chapterIds.length === 0,
        ),
    ).toBe(true);
    expect(getLesson("not-a-lesson")).toBeUndefined();
  });

  it("uses existing prerequisites without cycles or inaccessible starting lessons", () => {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
      expect(visiting.has(id), `循環する前提: ${id}`).toBe(false);
      if (visited.has(id)) return;
      const lesson = getLesson(id);
      expect(lesson, `存在しない前提: ${id}`).toBeDefined();
      visiting.add(id);
      for (const prerequisite of lesson!.prerequisites) visit(prerequisite);
      visiting.delete(id);
      visited.add(id);
    };
    for (const lesson of lessons) visit(lesson.id);
    expect(lessons[0].prerequisites).toEqual([]);
    for (const lesson of lessons.slice(1))
      expect(lesson.prerequisites.length).toBeGreaterThan(0);
    expect(visited.size).toBe(lessons.length);
  });

  it.each(lessons)(
    "$id has complete learning steps and resolvable references",
    (lesson) => {
      expect(lesson.chapterId).toBe(chapter.id);
      expect(lesson.durationMinutes).toBeGreaterThanOrEqual(8);
      expect(lesson.durationMinutes).toBeLessThanOrEqual(12);
      expect(lesson.xp).toBeGreaterThan(0);
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(3);
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
      expect(
        lesson.blocks.every(
          (block) =>
            block.title &&
            block.paragraphs.length > 0 &&
            block.paragraphs.every(Boolean),
        ),
      ).toBe(true);
      expect(lesson.explore.length).toBeGreaterThanOrEqual(3);
      expect(
        lesson.explore.every(
          (item) => item.thai && item.ipa && item.meaning && item.note,
        ),
      ).toBe(true);
      expect(lesson.exercises.length).toBeGreaterThanOrEqual(5);
      expect(lesson.summary.length).toBeGreaterThanOrEqual(3);
      for (const id of lesson.relatedLessonIds)
        expect(getLesson(id)).toBeDefined();
      expect(lesson.sourceIds.length).toBeGreaterThan(0);
      for (const id of lesson.sourceIds) {
        const source = sources.find((entry) => entry.id === id);
        expect(source).toBeDefined();
        expect(source!.access).toBe("accessible");
      }
    },
  );

  it.each(lessons.flatMap((lesson) => lesson.exercises))(
    "$id has one valid answer and a reason",
    (exercise) => {
      expect(["multiple-choice", "character-recognition"]).toContain(
        exercise.type,
      );
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
    },
  );

  it("preserves the intended ten consonants and their distinct classes", () => {
    expect(characters.map((character) => character.thai).join("")).toBe(
      "กขคงจดตนมร",
    );
    const byClass = (className: string) =>
      characters
        .filter((character) => character.consonantClass === className)
        .map((character) => character.thai)
        .join("");
    expect(byClass("mid")).toBe("กจดต");
    expect(byClass("high")).toBe("ข");
    expect(byClass("low")).toBe("คงนมร");
    expect(
      characters.find((character) => character.thai === "ก")?.initialIpa,
    ).toBe("/k/");
    expect(
      characters.find((character) => character.thai === "ข")?.initialIpa,
    ).toBe("/kʰ/");
    expect(
      characters.find((character) => character.thai === "ค")?.initialIpa,
    ).toBe("/kʰ/");
  });

  it("keeps Thai combining marks in their intended code point order", () => {
    const vowelLesson = getLesson("vowel-length")!;
    const mi = vowelLesson.explore.find(
      (item) => item.meaning === "ある・持っている",
    )!;
    expect([...mi.thai].map((letter) => letter.codePointAt(0))).toEqual([
      0x0e21, 0x0e35,
    ]);
    const toneExamples = getLesson("five-tones")!.explore;
    expect(toneExamples.map((item) => item.thai)).toEqual([
      "กา",
      "ก่า",
      "ก้า",
      "ก๊า",
      "ก๋า",
    ]);
    expect(
      [...toneExamples[1].thai].map((letter) => letter.codePointAt(0)),
    ).toEqual([0x0e01, 0x0e48, 0x0e32]);
  });

  it("uses consistent tone notation while keeping restricted examples explicit", () => {
    const toneLesson = getLesson("five-tones")!;
    expect(toneLesson.explore.map((item) => item.ipa)).toEqual([
      "/kaː˧/",
      "/kaː˨˩/",
      "/kaː˥˩/",
      "/kaː˦˥/",
      "/kaː˩˩˦/",
    ]);
    expect(
      toneLesson.blocks.some((block) =>
        block.paragraphs.some((paragraph) => paragraph.includes("練習用音節")),
      ),
    ).toBe(true);
    expect(
      toneLesson.summary.some((paragraph) => paragraph.includes("条件限定")),
    ).toBe(true);
  });

  it("does not promote incomplete review or fabricate audio", () => {
    expect(
      lessons.every((lesson) => lesson.verification === "unreviewed"),
    ).toBe(true);
    expect(
      characters.every((character) => character.verification === "unreviewed"),
    ).toBe(true);
    expect(sources.find((source) => source.id === "unicode-16")?.access).toBe(
      "accessible",
    );
    expect(sources.find((source) => source.id === "niu-thai")?.access).toBe(
      "blocked",
    );
    for (const lesson of lessons) {
      expect(lesson).not.toHaveProperty("audio");
      expect(
        lesson.exercises.every(
          (exercise) => exercise.type !== ("listening" as string),
        ),
      ).toBe(true);
    }
  });
});

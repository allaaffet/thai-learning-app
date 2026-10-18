import { describe, expect, it } from "vitest";
import { courseLessons, courseSources, getCourseLesson } from "./course";
import { grammarPoints, vocabularyEntries } from "./language";
import { phaseFourChapters, phaseFourLessons } from "./phase-four";
import { gradeExercise, INCORRECT_INPUT_ID } from "@/lib/exercise-grading";

function learnedText(id: string, path: string[] = []): string {
  if (path.includes(id)) throw new Error(`循環する前提: ${id}`);
  const lesson = getCourseLesson(id);
  if (!lesson) throw new Error(`存在しない前提: ${id}`);
  return [
    ...lesson.blocks.flatMap((block) => [
      ...block.paragraphs,
      ...(block.examples ?? []).map((example) => example.thai),
    ]),
    ...lesson.explore.flatMap((example) => [example.thai, example.note]),
    ...lesson.prerequisites.map((prerequisite) =>
      learnedText(prerequisite, [...path, id]),
    ),
  ].join("\n");
}

describe("Phase 4の文法レッスンと入力教材", () => {
  it("声調の総まとめに続く8課40問を、Part 5・6の順で学ぶ", () => {
    expect(phaseFourLessons).toHaveLength(8);
    expect(phaseFourLessons.flatMap((lesson) => lesson.exercises)).toHaveLength(
      40,
    );
    expect(phaseFourChapters.map((chapter) => chapter.partId)).toEqual([
      "part-5",
      "part-6",
    ]);
    expect(phaseFourChapters.flatMap((chapter) => chapter.lessonIds)).toEqual(
      phaseFourLessons.map((lesson) => lesson.id),
    );
    for (const [index, lesson] of phaseFourLessons.entries()) {
      expect(lesson.prerequisites).toEqual([
        index === 0 ? "tone-reading-review" : phaseFourLessons[index - 1].id,
      ]);
      expect(lesson.exercises).toHaveLength(5);
      expect(lesson.xp).toBe(40);
      expect(lesson.durationMinutes).toBeGreaterThanOrEqual(8);
      expect(lesson.durationMinutes).toBeLessThanOrEqual(12);
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(3);
      expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
      expect(lesson.explore.length).toBeGreaterThanOrEqual(3);
      expect(lesson.summary.length).toBeGreaterThanOrEqual(3);
      expect(
        lesson.exercises.some(
          (exercise) => exercise.type === "fill-in-the-blank",
        ),
      ).toBe(true);
      expect(
        lesson.exercises.some((exercise) => exercise.type === "word-ordering"),
      ).toBe(true);
    }
  });

  it("新しい入力形式にも正答・理由・関連概念があり、語句IDに重複・欠落がない", () => {
    for (const lesson of phaseFourLessons) {
      const learned = learnedText(lesson.id);
      for (const exercise of lesson.exercises) {
        expect(exercise.explanation.length, exercise.id).toBeGreaterThan(20);
        expect(exercise.relatedConcepts.length, exercise.id).toBeGreaterThan(0);
        expect([1, 2, 3]).toContain(exercise.difficulty);
        expect(new Set(exercise.options.map((option) => option.id)).size).toBe(
          exercise.options.length,
        );
        const correct = exercise.options.filter(
          (option) => option.id === exercise.answerId,
        );
        expect(correct, exercise.id).toHaveLength(1);
        if (exercise.type === "fill-in-the-blank") {
          expect(exercise.acceptedAnswers, exercise.id).toContain(
            correct[0].label,
          );
          expect(new Set(exercise.acceptedAnswers).size).toBe(
            exercise.acceptedAnswers.length,
          );
          for (const answer of exercise.acceptedAnswers) {
            expect(answer.trim(), exercise.id).toBe(answer);
            expect(answer, exercise.id).toMatch(
              /^[\u0e01-\u0e3a\u0e40-\u0e4e]+$/u,
            );
            expect(learned, exercise.id).toContain(answer);
            expect(
              gradeExercise(exercise, { type: "text", text: ` ${answer} ` }),
            ).toEqual({
              correct: true,
              selectedOptionId: exercise.answerId,
            });
          }
          expect(
            gradeExercise(exercise, { type: "text", text: "PRIVATE" }),
          ).toEqual({
            correct: false,
            selectedOptionId: INCORRECT_INPUT_ID,
          });
        } else if (exercise.type === "word-ordering") {
          const ids = exercise.tokens.map((token) => token.id);
          expect(new Set(ids).size, exercise.id).toBe(ids.length);
          expect([...exercise.answerOrder].sort(), exercise.id).toEqual(
            [...ids].sort(),
          );
          expect(exercise.tokens.length, exercise.id).toBeGreaterThanOrEqual(3);
          const answer = exercise.answerOrder
            .map(
              (id) => exercise.tokens.find((token) => token.id === id)?.label,
            )
            .join("");
          expect(answer, exercise.id).toBe(correct[0].label);
          for (const token of exercise.tokens)
            expect(learned, `${exercise.id}: ${token.label}`).toContain(
              token.label,
            );
          expect(
            gradeExercise(exercise, {
              type: "ordering",
              tokenIds: exercise.answerOrder,
            }),
          ).toEqual({
            correct: true,
            selectedOptionId: exercise.answerId,
          });
          expect(
            gradeExercise(exercise, {
              type: "ordering",
              tokenIds: [...exercise.answerOrder, exercise.answerOrder[0]],
            }),
          ).toBeUndefined();
          const reversed = [...exercise.answerOrder].reverse();
          expect(
            gradeExercise(exercise, { type: "ordering", tokenIds: reversed }),
          ).toEqual({
            correct: false,
            selectedOptionId: INCORRECT_INPUT_ID,
          });
        } else {
          expect(
            gradeExercise(exercise, {
              type: "option",
              optionId: exercise.answerId,
            }),
          ).toEqual({ correct: true, selectedOptionId: exercise.answerId });
        }
      }
    }
  });

  it("新旧の語彙・文法・例文を参照でき、出典は実在する資料に限って未監修と記録する", () => {
    const knownLessons = new Set(courseLessons.map((lesson) => lesson.id));
    const knownSources = new Set(courseSources.map((source) => source.id));
    for (const lesson of phaseFourLessons) {
      expect(lesson.verification).toBe("unreviewed");
      expect(lesson.sourceIds.length).toBeGreaterThan(0);
      expect(new Set(lesson.sourceIds).size).toBe(lesson.sourceIds.length);
      for (const id of lesson.sourceIds)
        expect(knownSources.has(id), id).toBe(true);
      for (const id of lesson.relatedLessonIds)
        expect(knownLessons.has(id), id).toBe(true);
      expect(
        grammarPoints.some((point) =>
          point.relatedLessonIds.includes(lesson.id),
        ),
      ).toBe(true);
      expect(
        vocabularyEntries.some((entry) =>
          entry.relatedLessonIds.includes(lesson.id),
        ),
      ).toBe(true);
    }
    for (const item of [...vocabularyEntries, ...grammarPoints]) {
      for (const id of item.relatedLessonIds)
        expect(knownLessons.has(id), id).toBe(true);
    }
    const examples = phaseFourLessons.flatMap((lesson) => [
      ...lesson.blocks.flatMap((block) => block.examples ?? []),
      ...lesson.explore,
    ]);
    const ipaByThai = new Map<string, string>();
    for (const example of examples) {
      const previous = ipaByThai.get(example.thai);
      if (previous) expect(example.ipa, example.thai).toBe(previous);
      ipaByThai.set(example.thai, example.ipa);
      expect(example.ipa, example.thai).toMatch(/^\/.+\/$/u);
      expect(example.meaning, example.thai).toBeTruthy();
    }
    for (const entry of vocabularyEntries) {
      if (ipaByThai.has(entry.thai))
        expect(ipaByThai.get(entry.thai), entry.id).toBe(entry.ipa);
    }
  });
});

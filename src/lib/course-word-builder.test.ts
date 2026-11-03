import { describe, expect, it } from "vitest";
import { courseLessons } from "@/data/course";
import { courseWordBuilderTargets } from "@/data/course-word-builders";
import { getCourseConversationSteps } from "@/data/course-conversations";
import { conversationScenarios, conversationWords } from "@/data/conversations";
import {
  getCourseWordBuilder,
  gradeCourseWordBuilder,
} from "@/lib/course-word-builder";

describe("本編の会話の語句組立", () => {
  it("全30課に明示した対象だけを持ち、複数の会話機能を扱う", () => {
    expect(Object.keys(courseWordBuilderTargets).sort()).toEqual(
      courseLessons.map((lesson) => lesson.id).sort(),
    );
    expect(
      new Set(Object.values(courseWordBuilderTargets)).size,
    ).toBeGreaterThan(8);
    expect(getCourseWordBuilder("unknown-lesson")).toBeUndefined();
    expect(getCourseWordBuilder("__proto__")).toBeUndefined();
  });

  it.each(courseLessons)(
    "$id は習ったモデルの語句を保持し、登録した全ての丁寧な正答を受け付ける",
    (lesson) => {
      const original = JSON.stringify([
        conversationScenarios,
        conversationWords,
      ]);
      const builder = getCourseWordBuilder(lesson.id);
      expect(builder).toBeDefined();
      if (!builder) throw new Error("Missing builder");
      expect(getCourseConversationSteps(builder.unit)).toContain(builder.step);
      expect(builder.unit.stepIds).toContain(builder.step.id);
      expect(builder.scenario.steps).toContain(builder.step);
      expect(builder.scenario.verification).toBe("unreviewed");
      expect(builder.acceptedWordIds).toEqual(
        builder.step.choices
          .filter((choice) => builder.step.answerIds.includes(choice.id))
          .map((choice) => choice.phrase.wordIds),
      );
      expect(builder.acceptedWordIds.length).toBeGreaterThan(1);
      for (const sequence of builder.acceptedWordIds) {
        expect(sequence.length).toBeGreaterThanOrEqual(2);
        expect(gradeCourseWordBuilder(builder, sequence).correct).toBe(true);
        expect(gradeCourseWordBuilder(builder, sequence).explanation).toBe(
          builder.step.explanation,
        );
        const bank = builder.bank.map((word) => word.id);
        for (const id of sequence)
          expect(
            bank.filter((wordId) => wordId === id).length,
          ).toBeGreaterThanOrEqual(
            sequence.filter((wordId) => wordId === id).length,
          );
        expect(gradeCourseWordBuilder(builder, sequence.slice(1)).correct).toBe(
          false,
        );
        expect(
          gradeCourseWordBuilder(builder, [...sequence, sequence[0]]).correct,
        ).toBe(false);
        expect(
          gradeCourseWordBuilder(builder, [...sequence].reverse()).correct,
        ).toBe(false);
      }
      for (const token of builder.bank)
        expect(conversationWords).toContain(token);
      expect(new Set(builder.bank.map((word) => word.verification))).toEqual(
        new Set(["unreviewed"]),
      );
      expect(JSON.stringify([conversationScenarios, conversationWords])).toBe(
        original,
      );
    },
  );

  it.each([
    null,
    undefined,
    "hello",
    [],
    ["not-in-the-bank"],
    [0],
    ["hello", "hello", "hello"],
  ])("不正・未完成の入力 %j を推測補完しない", (response) => {
    const builder = getCourseWordBuilder("sounds-and-letters");
    if (!builder) throw new Error("Missing first builder");
    expect(gradeCourseWordBuilder(builder, response).correct).toBe(false);
  });

  it("順序だけseedで安定して変え、元の語句・正答・シナリオを変更しない", () => {
    const original = getCourseWordBuilder("syllable-endings", 3);
    expect(original).toEqual(getCourseWordBuilder("syllable-endings", 3));
    expect(getCourseWordBuilder("syllable-endings", NaN)).toEqual(
      getCourseWordBuilder("syllable-endings", 0),
    );
    const variants = new Set(
      Array.from({ length: 8 }, (_, seed) =>
        getCourseWordBuilder("syllable-endings", seed)
          ?.bank.map((word) => word.id)
          .join(":"),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
    const second = getCourseWordBuilder("syllable-endings", 4);
    expect(second?.step).toBe(original?.step);
    expect(second?.acceptedWordIds).toEqual(original?.acceptedWordIds);
    expect(second?.bank.map((word) => word.id).sort()).toEqual(
      original?.bank.map((word) => word.id).sort(),
    );
  });
});

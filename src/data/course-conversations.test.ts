import { describe, expect, it } from "vitest";
import { courseLessons, courseSources } from "@/data/course";
import {
  conversationScenarios,
  conversationSources,
  conversationWords,
} from "@/data/conversations";
import {
  courseConversationUnits,
  getCourseConversation,
  getCourseConversationScenario,
  getCourseConversationSteps,
} from "@/data/course-conversations";
import { gradeConversationChoice } from "@/lib/conversation";

describe("初回から本編に組み込む会話カリキュラム", () => {
  it("全30課へ一意に対応し、既存の課・確認問題・XPを変えない", () => {
    expect(courseConversationUnits.map((unit) => unit.lessonId)).toEqual(
      courseLessons.map((lesson) => lesson.id),
    );
    expect(
      new Set(courseConversationUnits.map((unit) => unit.lessonId)).size,
    ).toBe(30);
    expect(
      courseLessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0),
    ).toBe(150);
    expect(courseLessons.reduce((sum, lesson) => sum + lesson.xp, 0)).toBe(
      1210,
    );
    expect(getCourseConversation("unknown")).toBeUndefined();
  });

  it.each(courseConversationUnits)(
    "$lessonId は元の会話・複数の返答・照合範囲をそのまま参照する",
    (unit) => {
      const snapshot = JSON.stringify(conversationScenarios);
      const scenario = getCourseConversationScenario(unit);
      expect(scenario).toBe(
        conversationScenarios.find(
          (candidate) => candidate.id === unit.scenarioId,
        ),
      );
      expect(scenario?.verification).toBe("unreviewed");
      const steps = getCourseConversationSteps(unit);
      expect(steps.map((step) => step.id)).toEqual(unit.stepIds);
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps.length).toBeLessThanOrEqual(3);
      const sourceIds = [...courseSources, ...conversationSources].map(
        (source) => source.id,
      );
      for (const id of scenario?.sourceIds ?? [])
        expect(sourceIds).toContain(id);
      const usedWordIds = new Set<string>();
      for (const step of steps) {
        expect(step).toBe(
          scenario?.steps.find((candidate) => candidate.id === step.id),
        );
        expect(step.answerIds).toHaveLength(2);
        for (const answerId of step.answerIds)
          expect(
            gradeConversationChoice(unit.scenarioId, step.id, answerId).correct,
          ).toBe(true);
        const phrases = [
          step.npc,
          ...step.choices.map((choice) => choice.phrase),
        ];
        for (const phrase of phrases) {
          expect(phrase).not.toHaveProperty("ipa");
          for (const id of phrase.wordIds) {
            usedWordIds.add(id);
            expect(conversationWords.some((word) => word.id === id)).toBe(true);
          }
          expect(phrase.thai).toBe(
            phrase.wordIds
              .map(
                (id) => conversationWords.find((word) => word.id === id)?.thai,
              )
              .join(""),
          );
        }
      }
      expect(unit.focusWordIds.length).toBeGreaterThanOrEqual(2);
      expect(unit.focusWordIds.length).toBeLessThanOrEqual(4);
      expect(new Set(unit.focusWordIds).size).toBe(unit.focusWordIds.length);
      for (const id of unit.focusWordIds)
        expect(usedWordIds.has(id)).toBe(true);
      for (const text of [unit.title, unit.objective, unit.context])
        expect(text.trim().length).toBeGreaterThan(0);
      expect(JSON.stringify(conversationScenarios)).toBe(snapshot);
    },
  );

  it("初回から挨拶を使い、最初の6課で既習のやり取りを再びつなげる", () => {
    expect(
      courseConversationUnits.slice(0, 6).map((unit) => unit.stepIds),
    ).toEqual([
      ["greeting-origin-hello"],
      ["cafe-water-thanks"],
      ["cafe-water-order"],
      ["greeting-origin-close"],
      ["greeting-origin-from"],
      [
        "greeting-origin-hello",
        "greeting-origin-from",
        "greeting-origin-close",
      ],
    ]);
    expect(courseConversationUnits[0].title).toBe("「こんにちは」から始めよう");
    expect(courseConversationUnits[1].context).toContain("水をお願い");
    expect(courseConversationUnits[1].context).toContain("受けてくれました");
    const introduced = new Set(
      courseConversationUnits.slice(0, 5).flatMap((unit) => unit.stepIds),
    );
    for (const id of courseConversationUnits[5].stepIds)
      expect(introduced.has(id)).toBe(true);
  });

  it("全12の既存ステップへ段階的に出会い、後半は既習の場面を再利用する", () => {
    const firstFourteen = new Set(
      courseConversationUnits.slice(0, 14).flatMap((unit) => unit.stepIds),
    );
    expect(firstFourteen.size).toBe(12);
    for (const scenario of conversationScenarios)
      for (const step of scenario.steps)
        expect(firstFourteen.has(step.id)).toBe(true);
    for (const unit of courseConversationUnits.slice(14))
      for (const stepId of unit.stepIds)
        expect(firstFourteen.has(stepId)).toBe(true);
    expect(getCourseConversation("time-aspect")?.objective).toContain(
      "以前に学んだ",
    );
    expect(
      getCourseConversation("comparisons-connectors")?.objective,
    ).toContain("以前に学んだ");
  });

  it("未知のシナリオ・別場面のステップ・欠落・重複を会話の一部へ黙って縮めない", () => {
    const original = courseConversationUnits[0];
    expect(
      getCourseConversationScenario({ ...original, scenarioId: "unknown" }),
    ).toBeUndefined();
    expect(
      getCourseConversationSteps({ ...original, scenarioId: "unknown" }),
    ).toEqual([]);
    expect(getCourseConversationSteps({ ...original, stepIds: [] })).toEqual(
      [],
    );
    expect(
      getCourseConversationSteps({
        ...original,
        stepIds: [original.stepIds[0], "unknown"],
      }),
    ).toEqual([]);
    expect(
      getCourseConversationSteps({
        ...original,
        stepIds: ["cafe-water-order"],
      }),
    ).toEqual([]);
    expect(
      getCourseConversationSteps({
        ...original,
        stepIds: [original.stepIds[0], original.stepIds[0]],
      }),
    ).toEqual([]);
  });
});

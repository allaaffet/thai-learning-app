import { describe, expect, it } from "vitest";
import { lessons } from "@/data/curriculum";
import { createEmptyProgress, type ExerciseAttempt } from "@/lib/progress";
import { getLearningInsights } from "./learning-insights";

function attempt(
  exerciseIndex: number,
  correct: boolean,
  attemptedAt = "2026-10-18T10:00:00Z",
): ExerciseAttempt {
  return {
    lessonId: lessons[0].id,
    exerciseId: lessons[0].exercises[exerciseIndex].id,
    selectedOptionId: correct
      ? lessons[0].exercises[exerciseIndex].answerId
      : "__incorrect__",
    correct,
    attemptedAt,
  };
}

describe("学習記録からの振り返り", () => {
  it("未回答を0%の理解度と呼ばず、7日分の空の活動を示す", () => {
    const result = getLearningInsights(
      createEmptyProgress(),
      lessons,
      new Date("2026-10-18T12:00:00Z"),
    );
    expect(result.questionCount).toBe(0);
    expect(result.latestAccuracy).toBeNull();
    expect(result.weakConcepts).toEqual([]);
    expect(result.activity).toHaveLength(7);
    expect(result.activity.at(-1)?.day).toBe("2026-10-18");
    expect(result.activity.every((day) => day.answered === 0)).toBe(true);
  });
  it("最新の回答で改善を反映し、履歴を消さず古い誤答を苦手へ残し続けない", () => {
    const progress = createEmptyProgress();
    progress.attempts = [
      attempt(0, false),
      attempt(0, true, "2026-10-19T10:00:00Z"),
    ];
    const result = getLearningInsights(progress, lessons);
    expect(result.latestAccuracy).toBe(100);
    expect(result.questionCount).toBe(1);
    expect(result.weakConcepts).toEqual([]);
    expect(result.recentAnswers.map((answer) => answer.correct)).toEqual([
      true,
      false,
    ]);
    expect(progress.attempts).toHaveLength(2);
  });
  it("前後した履歴でも時刻で最新を選び、同時刻は後で記録した回答を選ぶ", () => {
    const progress = createEmptyProgress();
    progress.attempts = [
      attempt(0, false, "2026-10-19T10:00:00Z"),
      attempt(0, true),
      attempt(0, true, "2026-10-19T10:00:00Z"),
    ];
    expect(getLearningInsights(progress, lessons).latestAccuracy).toBe(100);
  });
  it("存在しない問題とレッスン違いを集計せず、実在する苦手概念へ関連レッスンを返す", () => {
    const progress = createEmptyProgress();
    progress.attempts = [
      attempt(0, false),
      { ...attempt(1, false), exerciseId: "unknown" },
      { ...attempt(1, false), lessonId: lessons[1].id },
    ];
    const result = getLearningInsights(progress, lessons);
    expect(result.questionCount).toBe(1);
    expect(result.latestAccuracy).toBe(0);
    expect(result.weakConcepts.length).toBeGreaterThan(0);
    for (const record of result.weakConcepts) {
      expect(record.correct).toBe(0);
      expect(record.total).toBe(1);
      expect(record.lessonIds).toEqual([lessons[0].id]);
    }
  });
  it("同じ概念を1問で二重に数えず、実際の終了済み回答と学習日を分ける", () => {
    const progress = createEmptyProgress();
    progress.attempts = [attempt(0, false)];
    progress.studyDays = ["2026-10-17"];
    const duplicate = {
      ...lessons[0],
      exercises: [
        { ...lessons[0].exercises[0], relatedConcepts: ["語順", "語順"] },
      ],
    };
    const result = getLearningInsights(
      progress,
      [duplicate],
      new Date("2026-10-18T12:00:00Z"),
    );
    expect(result.weakConcepts).toEqual([
      { concept: "語順", correct: 0, total: 1, lessonIds: [lessons[0].id] },
    ]);
    expect(
      result.activity.find((day) => day.day === "2026-10-17"),
    ).toMatchObject({ studied: true, answered: 0 });
    expect(
      result.activity.find((day) => day.day === "2026-10-18"),
    ).toMatchObject({ studied: false, answered: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { courseLessons } from "@/data/course";
import type { Lesson } from "@/lib/content-types";
import {
  appendMissionRetry,
  buildLessonMission,
  buildMixedReviewMission,
  getMissionExercise,
  type MissionCard,
  type MissionQuestionCard,
} from "@/lib/course-mission";
import {
  completeLesson,
  createEmptyProgress,
  type LearningProgress,
} from "@/lib/progress";

const timestamp = "2026-10-30T09:00:00.000Z";

function completed(lessons: readonly Lesson[]): LearningProgress {
  return {
    version: 1,
    lessons: Object.fromEntries(
      lessons.map((lesson) => [
        lesson.id,
        {
          completedAt: timestamp,
          lastStudiedAt: timestamp,
          bestScore: 100,
          attemptCount: 1,
          xpAwarded: lesson.xp,
        },
      ]),
    ),
    attempts: [],
    studyDays: [timestamp.slice(0, 10)],
  };
}

function questions(cards: readonly MissionCard[]): MissionQuestionCard[] {
  return cards.filter((card) => card.kind === "question");
}

describe("体系的な教材を混ぜて進める本編ミッション", () => {
  it.each(courseLessons)(
    "$id の元の全説明・確認例・初回5問を保ち、未説明の新しい問題を先に出さない",
    (lesson) => {
      const before = JSON.stringify(courseLessons);
      const progress = completed(courseLessons);
      const saved = JSON.stringify(progress);
      const mission = buildLessonMission(lesson, courseLessons, progress, 7);
      expect(mission.lessonId).toBe(lesson.id);
      expect(mission.coreExerciseIds).toEqual(
        lesson.exercises.map((exercise) => exercise.id),
      );
      expect(
        mission.cards
          .filter((card) => card.kind === "learn")
          .map((card) => card.block),
      ).toEqual(lesson.blocks);
      expect(
        mission.cards
          .filter((card) => card.kind === "explore")
          .map((card) => card.item),
      ).toEqual(lesson.explore);
      const firstCore = mission.cards.findIndex(
        (card) => card.kind === "question" && card.purpose === "core",
      );
      expect(firstCore).toBeGreaterThanOrEqual(
        lesson.blocks.length + lesson.explore.length,
      );
      expect(
        mission.cards
          .slice(firstCore)
          .every((card) => card.kind === "question"),
      ).toBe(true);
      const core = questions(mission.cards).filter(
        (card) => card.purpose === "core",
      );
      expect(core.map((card) => card.exercise)).toEqual(lesson.exercises);
      expect(core.every((card) => card.lessonId === lesson.id)).toBe(true);
      const reviews = questions(mission.cards).filter(
        (card) => card.purpose === "review",
      );
      expect(reviews.length).toBeLessThanOrEqual(2);
      expect(reviews.every((card) => card.lessonId !== lesson.id)).toBe(true);
      expect(new Set(mission.cards.map((card) => card.id)).size).toBe(
        mission.cards.length,
      );
      expect(JSON.stringify(courseLessons)).toBe(before);
      expect(JSON.stringify(progress)).toBe(saved);
    },
  );

  it("はじめての学習には未習の復習を混ぜず、前提がない課を拒否する", () => {
    const progress = createEmptyProgress();
    const first = courseLessons[0];
    const mission = buildLessonMission(first, courseLessons, progress);
    expect(
      questions(mission.cards).filter((card) => card.purpose === "review"),
    ).toEqual([]);
    const locked = courseLessons.find((lesson) => lesson.prerequisites.length)!;
    expect(() => buildLessonMission(locked, courseLessons, progress)).toThrow(
      "前提レッスン",
    );
    expect(buildMixedReviewMission(courseLessons, progress).cards).toEqual([]);
  });

  it("完了した既知の課だけを使い、未知・未完了・前提のない完了記録を混ぜない", () => {
    const [first, second, third] = courseLessons;
    const progress = completed([first]);
    progress.lessons.unknown = { ...progress.lessons[first.id] };
    progress.lessons[second.id] = {
      ...progress.lessons[first.id],
      completedAt: undefined,
      xpAwarded: 0,
    };
    // third の前提である second は未完了。破損した完了記録を根拠にしない。
    progress.lessons[third.id] = { ...progress.lessons[first.id] };
    const review = questions(
      buildMixedReviewMission(courseLessons, progress).cards,
    );
    expect(review).toHaveLength(first.exercises.length);
    expect(review.every((card) => card.lessonId === first.id)).toBe(true);
    expect(new Set(review.map((card) => card.exercise.id)).size).toBe(
      review.length,
    );
  });

  it("少し間を空けて最初と中央の問題を思い出し、初回問題とは区別する", () => {
    const lesson = courseLessons[0];
    const { cards } = buildLessonMission(
      lesson,
      courseLessons,
      createEmptyProgress(),
    );
    const recalls = questions(cards).filter(
      (card) => card.purpose === "recall",
    );
    expect(recalls.map((card) => card.exercise.id)).toEqual([
      lesson.exercises[0].id,
      lesson.exercises[2].id,
    ]);
    for (const recall of recalls) {
      const coreIndex = cards.findIndex(
        (card) =>
          card.kind === "question" &&
          card.purpose === "core" &&
          card.exercise.id === recall.exercise.id,
      );
      const recallIndex = cards.indexOf(recall);
      expect(
        questions(cards.slice(coreIndex + 1, recallIndex)).filter(
          (card) => card.purpose === "core",
        ).length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("既習の復習を新しい説明の合間に置き、選んだ課自身は復習に使わない", () => {
    const progress = completed(courseLessons.slice(0, 3));
    const target = courseLessons[2];
    const { cards } = buildLessonMission(target, courseLessons, progress);
    const firstCore = cards.findIndex(
      (card) => card.kind === "question" && card.purpose === "core",
    );
    const reviewIndices = cards.flatMap((card, index) =>
      card.kind === "question" && card.purpose === "review" ? [index] : [],
    );
    expect(reviewIndices).toHaveLength(2);
    expect(reviewIndices.every((index) => index < firstCore)).toBe(true);
    expect(reviewIndices[0]).toBeGreaterThan(0);
    expect(
      questions(cards)
        .filter((card) => card.purpose === "review")
        .every((card) => card.lessonId !== target.id),
    ).toBe(true);
  });

  it("ミックスは最大6問・複数の既習課から選び、直近の誤答を優先する", () => {
    const progress = completed(courseLessons.slice(0, 4));
    const lesson = courseLessons[3];
    const exercise = lesson.exercises[4];
    progress.attempts = [
      {
        lessonId: lesson.id,
        exerciseId: exercise.id,
        selectedOptionId: "wrong",
        correct: false,
        attemptedAt: timestamp,
      },
    ];
    const mission = buildMixedReviewMission(courseLessons, progress, 19);
    const cards = questions(mission.cards);
    expect(mission.lessonId).toBeNull();
    expect(mission.coreExerciseIds).toEqual([]);
    expect(cards).toHaveLength(6);
    expect(cards.every((card) => card.purpose === "review")).toBe(true);
    expect(cards[0].exercise.id).toBe(exercise.id);
    expect(new Set(cards.map((card) => card.lessonId)).size).toBe(4);
    expect(new Set(cards.map((card) => card.exercise.id)).size).toBe(6);
  });

  it("古い誤答があっても最新回答が正しければ誤答優先へ戻さない", () => {
    const lesson = courseLessons[0];
    const progress = completed([lesson]);
    const [recovered, mistaken] = lesson.exercises;
    progress.attempts = [
      {
        lessonId: lesson.id,
        exerciseId: recovered.id,
        selectedOptionId: "wrong",
        correct: false,
        attemptedAt: "2026-10-20T09:00:00.000Z",
      },
      {
        lessonId: lesson.id,
        exerciseId: mistaken.id,
        selectedOptionId: "wrong",
        correct: false,
        attemptedAt: timestamp,
      },
      {
        lessonId: lesson.id,
        exerciseId: recovered.id,
        selectedOptionId: recovered.answerId,
        correct: true,
        attemptedAt: timestamp,
      },
    ];
    // 元の履歴の配列順に依存せず、日時で最新回答を選ぶ。
    progress.attempts.reverse();
    const cards = questions(
      buildMixedReviewMission(courseLessons, progress).cards,
    );
    expect(cards[0].exercise.id).toBe(mistaken.id);
    expect(cards.at(-1)?.exercise.id).toBe(recovered.id);
  });

  it("同じ優先度では古い日を優先し、seedで同日の組み合わせを変えられる", () => {
    const lesson = courseLessons[0];
    const progress = completed([lesson]);
    progress.attempts = lesson.exercises.map((exercise, index) => ({
      lessonId: lesson.id,
      exerciseId: exercise.id,
      selectedOptionId: exercise.answerId,
      correct: true,
      attemptedAt: index === 4 ? "2026-10-01T09:00:00.000Z" : timestamp,
    }));
    const cards = questions(
      buildMixedReviewMission(courseLessons, progress).cards,
    );
    expect(cards[0].exercise.id).toBe(lesson.exercises[4].id);
    const all = completed(courseLessons);
    const variants = new Set(
      Array.from({ length: 8 }, (_, seed) =>
        buildMixedReviewMission(courseLessons, all, seed)
          .cards.map((card) =>
            card.kind === "question"
              ? `${card.lessonId}:${card.exercise.id}`
              : card.id,
          )
          .join("|"),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
    expect(buildMixedReviewMission(courseLessons, all, 3)).toEqual(
      buildMixedReviewMission(courseLessons, all, 3),
    );
    expect(buildMixedReviewMission(courseLessons, all, NaN)).toEqual(
      buildMixedReviewMission(courseLessons, all, 0),
    );
  });

  it("再挑戦は同じ問題ごとに一度だけ追加し、元の計画を変更せず必ず終わる", () => {
    const lesson = courseLessons[0];
    const original = buildLessonMission(
      lesson,
      courseLessons,
      createEmptyProgress(),
    );
    const core = questions(original.cards).find(
      (card) => card.purpose === "core",
    )!;
    const recall = questions(original.cards).find(
      (card) =>
        card.purpose === "recall" && card.exercise.id === core.exercise.id,
    )!;
    const before = JSON.stringify(original);
    const initial = Object.freeze(original.cards);
    const extended = appendMissionRetry(initial, core);
    expect(extended).toHaveLength(initial.length + 1);
    const retry = extended.at(-1)!;
    expect(retry).toMatchObject({
      kind: "question",
      exercise: core.exercise,
      purpose: "retry",
      lessonId: lesson.id,
    });
    expect(appendMissionRetry(extended, core)).toEqual(extended);
    expect(appendMissionRetry(extended, recall)).toEqual(extended);
    expect(appendMissionRetry(extended, retry)).toEqual(extended);
    expect(appendMissionRetry(initial, initial[0])).toEqual(initial);
    expect(
      appendMissionRetry(initial, { ...core, id: "not-in-the-mission" }),
    ).toEqual(initial);
    expect(JSON.stringify(original)).toBe(before);
    let bounded = [...initial];
    for (const card of questions(initial))
      bounded = appendMissionRetry(bounded, card);
    const count = questions(bounded).filter(
      (card) => card.purpose === "retry",
    ).length;
    expect(count).toBe(lesson.exercises.length);
    for (const card of questions(bounded))
      bounded = appendMissionRetry(bounded, card);
    expect(
      questions(bounded).filter((card) => card.purpose === "retry"),
    ).toHaveLength(count);
  });

  it("順序だけを変え、全形式のThai・IPA・選択肢・正答・トークンをそのまま保つ", () => {
    const progress = completed(courseLessons);
    for (const lesson of courseLessons) {
      const mission = buildLessonMission(lesson, courseLessons, progress, 2);
      for (const card of questions(mission.cards)) {
        const before = JSON.stringify(card.exercise);
        const exercise = getMissionExercise(card);
        expect(exercise).not.toBe(card.exercise);
        expect(exercise.answerId).toBe(card.exercise.answerId);
        expect(exercise.prompt).toBe(card.exercise.prompt);
        expect(exercise.explanation).toBe(card.exercise.explanation);
        expect(exercise.options).not.toBe(card.exercise.options);
        expect(
          [...exercise.options].sort((a, b) => a.id.localeCompare(b.id)),
        ).toEqual(
          [...card.exercise.options].sort((a, b) => a.id.localeCompare(b.id)),
        );
        if (
          exercise.type === "word-ordering" &&
          card.exercise.type === "word-ordering"
        ) {
          expect(new Set(exercise.tokens)).toEqual(
            new Set(card.exercise.tokens),
          );
          expect(exercise.answerOrder).toBe(card.exercise.answerOrder);
        }
        if (
          exercise.type === "fill-in-the-blank" &&
          card.exercise.type === "fill-in-the-blank"
        )
          expect(exercise.acceptedAnswers).toBe(card.exercise.acceptedAnswers);
        expect(getMissionExercise(card)).toEqual(exercise);
        expect(JSON.stringify(card.exercise)).toBe(before);
      }
    }
  });

  it("初回問題のIDは再挑戦・思い出す問題・過去問を採点へ混入させない", () => {
    const lesson = courseLessons[1];
    const progress = completed([courseLessons[0]]);
    const mission = buildLessonMission(lesson, courseLessons, progress);
    const core = questions(mission.cards).filter(
      (card) => card.purpose === "core",
    );
    const attempts = core.map((card, index) => ({
      lessonId: lesson.id,
      exerciseId: card.exercise.id,
      selectedOptionId: index < 2 ? "wrong" : card.exercise.answerId,
      correct: index >= 2,
      attemptedAt: timestamp,
    }));
    const result = completeLesson(progress, lesson, {
      correct: 3,
      total: mission.coreExerciseIds.length,
      attempts,
      now: timestamp,
    });
    expect(result.passed).toBe(false);
    expect(result.earnedXp).toBe(0);
    expect(result.progress.attempts).toHaveLength(5);
    expect(result.progress.lessons[lesson.id].bestScore).toBe(60);
    expect(mission.coreExerciseIds).toHaveLength(5);
    expect(questions(mission.cards).length).toBeGreaterThan(5);
  });

  it("空のカタログ・最小の教材にも対応し、存在しない補足や音声を作らない", () => {
    const empty: Lesson = {
      ...courseLessons[0],
      blocks: [],
      explore: [],
      exercises: [],
    };
    expect(buildLessonMission(empty, [], createEmptyProgress()).cards).toEqual(
      [],
    );
    expect(buildMixedReviewMission([], completed(courseLessons)).cards).toEqual(
      [],
    );
    const one: Lesson = {
      ...empty,
      exercises: [courseLessons[0].exercises[0]],
    };
    const mission = buildLessonMission(one, [], createEmptyProgress());
    expect(mission.coreExerciseIds).toEqual([one.exercises[0].id]);
    expect(questions(mission.cards).map((card) => card.purpose)).toEqual([
      "core",
      "recall",
    ]);
  });
});

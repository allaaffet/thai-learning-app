import { afterEach, describe, expect, it, vi } from "vitest";
import { courseChapters, courseLessons } from "@/data/course";
import {
  completeLesson,
  createEmptyProgress,
  getTotalXp,
  type ExerciseAttempt,
  type LearningProgress,
} from "@/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  reviewCard,
  type ReviewGrade,
  type ReviewState,
} from "@/lib/review";
import {
  getGameProgress,
  type GameBadgeId,
  type GameProgressInput,
} from "./gamification";

const now = new Date(2026, 9, 25, 12);
const past = new Date(2026, 9, 24, 10).toISOString();
const today = new Date(2026, 9, 25, 10).toISOString();
const future = new Date(2026, 9, 25, 13).toISOString();
const lesson = courseLessons[0];

afterEach(() => vi.unstubAllEnvs());

function game(input: Partial<GameProgressInput> = {}) {
  return getGameProgress({
    progress: createEmptyProgress(),
    review: createEmptyReview(),
    lessons: courseLessons,
    chapters: courseChapters,
    now,
    ...input,
  });
}

function withXp(xp: number): LearningProgress {
  return {
    ...createEmptyProgress(),
    lessons: {
      [lesson.id]: {
        completedAt: past,
        lastStudiedAt: past,
        bestScore: 100,
        attemptCount: 1,
        xpAwarded: xp,
      },
    },
  };
}

function answer(index: number, correct = false, at = today): ExerciseAttempt {
  return {
    exerciseId: lesson.exercises[index].id,
    lessonId: lesson.id,
    selectedOptionId: correct
      ? lesson.exercises[index].answerId
      : "__incorrect__",
    correct,
    attemptedAt: at,
  };
}

function reviewed(grade: ReviewGrade = "again", at = today) {
  return reviewCard(
    addReviewCard(createEmptyReview(), "word", at),
    "word",
    grade,
    at,
    "review-1",
  );
}

function badge(progress: ReturnType<typeof game>, id: GameBadgeId) {
  const found = progress.badges.find((item) => item.id === id);
  if (!found) throw new Error("Missing badge");
  return found;
}

describe("XP experience levels", () => {
  it("starts at level 1 without calling a new learner proficient or complete", () => {
    const result = game();
    expect(result.experience).toMatchObject({
      level: 1,
      maxLevel: 14,
      xp: 0,
      goalXp: 1210,
      remainingXp: 100,
      percent: 0,
      isMax: false,
    });
    expect(result.unlockedBadgeCount).toBe(0);
    expect(result.completedQuestCount).toBe(0);
    expect(result.badges).toHaveLength(8);
    expect(result.quests).toHaveLength(3);
  });

  it.each([
    [99, 1, 99, 1, 100],
    [100, 2, 0, 100, 100],
    [1199, 12, 99, 1, 100],
    [1200, 13, 0, 10, 10],
    [1205, 13, 50, 5, 10],
  ])(
    "handles %i XP at the level boundary",
    (xp, level, percent, remainingXp, requiredInLevel) => {
      expect(game({ progress: withXp(xp) }).experience).toMatchObject({
        xp,
        level,
        percent,
        remainingXp,
        requiredInLevel,
        isMax: false,
      });
    },
  );

  it("finishes at the available 1210 XP without suggesting an unreachable next level", () => {
    expect(game({ progress: withXp(1210) }).experience).toMatchObject({
      level: 14,
      maxLevel: 14,
      xp: 1210,
      percent: 100,
      currentThreshold: 1210,
      nextThreshold: 1210,
      remainingXp: 0,
      requiredInLevel: 0,
      isMax: true,
    });
  });

  it("preserves existing XP totals and bounds the visual gauge if a future course record adds XP", () => {
    const progress = withXp(1250);
    progress.lessons["future-course"] = {
      completedAt: past,
      lastStudiedAt: past,
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: 30,
    };
    expect(game({ progress }).experience).toMatchObject({
      xp: getTotalXp(progress),
      level: 14,
      maxLevel: 14,
      percent: 100,
      isMax: true,
    });
    expect(game({ progress }).completedLessonCount).toBe(1);
  });

  it.each([100, 150, 200])(
    "uses a %i XP course's real final interval",
    (xp) => {
      const lessons = [{ ...lesson, xp }];
      const end = game({ lessons, progress: withXp(xp) }).experience;
      expect(end.isMax).toBe(true);
      expect(end.level).toBe(Math.ceil(xp / 100) + 1);
      expect(end.remainingXp).toBe(0);
    },
  );

  it("does not auto-finish an empty or zero-XP course", () => {
    const result = game({
      lessons: [],
      chapters: [],
      progress: withXp(200),
      review: reviewed(),
    });
    expect(result.experience).toMatchObject({
      level: 1,
      maxLevel: 1,
      xp: 200,
      percent: 0,
      isMax: false,
    });
    expect(
      result.badges.every((item) => !item.done && item.current === 0),
    ).toBe(true);
    expect(
      result.quests.every((item) => !item.done && item.current === 0),
    ).toBe(true);
    expect(game({ lessons: [{ ...lesson, xp: 0 }] }).experience).toMatchObject({
      isMax: false,
      percent: 0,
    });
  });
});

describe("daily quests count completed effort", () => {
  it("counts a failed lesson and incorrect first answers without awarding XP or badges for passing", () => {
    const completion = completeLesson(createEmptyProgress(), lesson, {
      correct: 0,
      total: 5,
      now: today,
      attempts: Array.from({ length: 5 }, (_, index) => answer(index)),
    });
    const result = game({ progress: completion.progress });
    expect(completion.passed).toBe(false);
    expect(result.quests.find((quest) => quest.id === "lesson")).toMatchObject({
      current: 1,
      target: 1,
      done: true,
    });
    expect(result.quests.find((quest) => quest.id === "answers")).toMatchObject(
      { current: 5, target: 5, done: true },
    );
    expect(result.completedQuestCount).toBe(2);
    expect(result.experience.xp).toBe(0);
    expect(badge(result, "first-lesson").done).toBe(false);
  });

  it("caps quest display while allowing a later session's genuine answers", () => {
    const progress = createEmptyProgress();
    progress.attempts = [
      answer(0),
      answer(0),
      answer(1),
      answer(2),
      answer(3),
      answer(4),
      answer(0, true, new Date(2026, 9, 25, 11).toISOString()),
    ];
    const result = game({ progress });
    expect(result.quests.find((quest) => quest.id === "answers")).toMatchObject(
      { current: 5, percent: 100, done: true },
    );
    progress.attempts = [answer(0), answer(0), answer(1)];
    expect(
      game({ progress }).quests.find((quest) => quest.id === "answers"),
    ).toMatchObject({ current: 2, percent: 40, done: false });
  });

  it("ignores unknown lessons, lesson/question mismatches, future and invalid timestamps", () => {
    const progress = createEmptyProgress();
    progress.lessons.unknown = {
      lastStudiedAt: today,
      completedAt: today,
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: 0,
    };
    progress.attempts = [
      { ...answer(0), lessonId: "unknown" },
      { ...answer(0), exerciseId: "unknown" },
      { ...answer(0), lessonId: courseLessons[1].id },
      answer(1, false, future),
      answer(2, true, "invalid"),
      answer(3, false, past),
    ];
    const result = game({ progress });
    expect(result.quests.every((quest) => quest.current === 0)).toBe(true);
    expect(result.completedLessonCount).toBe(0);
    expect(badge(result, "first-lesson").done).toBe(false);
  });

  it("resets daily quests at local midnight, while retaining cumulative badges", () => {
    const at = new Date(2026, 9, 25, 23, 59).toISOString();
    const progress = completeLesson(createEmptyProgress(), lesson, {
      correct: 5,
      total: 5,
      now: at,
      attempts: Array.from({ length: 5 }, (_, index) =>
        answer(index, true, at),
      ),
    }).progress;
    const before = game({ progress, now: new Date(2026, 9, 25, 23, 59, 59) });
    const after = game({ progress, now: new Date(2026, 9, 26, 0, 0, 1) });
    expect(before.dayKey).toBe("2026-10-25");
    expect(before.completedQuestCount).toBe(2);
    expect(after.dayKey).toBe("2026-10-26");
    expect(after.completedQuestCount).toBe(0);
    expect(badge(after, "first-lesson").done).toBe(true);
  });

  it("uses the learner's local calendar, rather than the UTC date prefix", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    const at = "2026-10-24T15:30:00Z";
    const progress = createEmptyProgress();
    progress.attempts = [answer(0, true, at)];
    const result = game({ progress, now: new Date("2026-10-24T16:00:00Z") });
    expect(result.dayKey).toBe("2026-10-25");
    expect(result.quests.find((quest) => quest.id === "answers")?.current).toBe(
      1,
    );
  });

  it.each(["again", "hard", "good"] as const)(
    "counts %s review as effort without treating it as proficiency",
    (grade) => {
      const review = reviewed(grade);
      const result = game({ review });
      expect(
        result.quests.find((quest) => quest.id === "review"),
      ).toMatchObject({ current: 1, done: true });
      expect(badge(result, "first-review").done).toBe(true);
      expect(result.experience.xp).toBe(0);
    },
  );

  it("does not count merely registered cards, duplicates, future reviews or missing cards", () => {
    const unreviewed = addReviewCard(createEmptyReview(), "word", today);
    expect(game({ review: unreviewed }).reviewCount).toBe(0);
    const review = reviewed();
    review.history = [
      review.history[0],
      review.history[0],
      { ...review.history[0], id: "future", reviewedAt: future },
      { ...review.history[0], id: "missing", cardId: "missing" },
    ];
    expect(
      game({ review }).quests.find((quest) => quest.id === "review")?.current,
    ).toBe(1);
    const later = reviewed("good", future);
    expect(game({ review: later }).reviewCount).toBe(0);
    expect(game({ review: later }).completedQuestCount).toBe(0);
  });
});

describe("badges restore from existing progress", () => {
  it("counts unique past study days cumulatively, allowing breaks without a penalty", () => {
    const progress = createEmptyProgress();
    progress.studyDays = [
      "2026-10-01",
      "2026-10-05",
      "2026-10-25",
      "2026-10-25",
      "2026-10-26",
      "2026-02-30",
      "invalid",
    ];
    const result = game({ progress });
    expect(result.studiedDayCount).toBe(3);
    expect(badge(result, "three-days")).toMatchObject({
      current: 3,
      target: 3,
      done: true,
    });
    expect(badge(result, "seven-days")).toMatchObject({
      current: 3,
      target: 7,
      done: false,
    });
  });

  it("unlocks the first chapter only when every declared lesson is completed", () => {
    const progress = createEmptyProgress();
    const ids = courseChapters[0].lessonIds;
    for (const id of ids.slice(0, -1))
      progress.lessons[id] = {
        lastStudiedAt: past,
        completedAt: past,
        bestScore: 100,
        attemptCount: 1,
        xpAwarded: 0,
      };
    expect(badge(game({ progress }), "first-chapter").done).toBe(false);
    const last = ids.at(-1)!;
    progress.lessons[last] = {
      lastStudiedAt: past,
      completedAt: future,
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: 0,
    };
    expect(badge(game({ progress }), "first-chapter").done).toBe(false);
    progress.lessons[last].completedAt = past;
    expect(badge(game({ progress }), "first-chapter")).toMatchObject({
      current: ids.length,
      target: ids.length,
      done: true,
    });
    expect(
      badge(
        game({
          progress,
          chapters: [{ ...courseChapters[0], lessonIds: [...ids, "unknown"] }],
        }),
        "first-chapter",
      ).done,
    ).toBe(false);
    expect(badge(game({ progress, chapters: [] }), "first-chapter").done).toBe(
      false,
    );
  });

  it("keeps cumulative review achievements after old history has been pruned", () => {
    let review: ReviewState = addReviewCard(
      createEmptyReview(),
      "word",
      new Date(2026, 9, 24, 8),
    );
    for (let index = 0; index < 10; index++)
      review = reviewCard(
        review,
        "word",
        "again",
        review.cards.word.dueAt,
        `review-${index}`,
      );
    review = { ...review, history: [] };
    const result = game({ review });
    expect(result.reviewCount).toBe(10);
    expect(badge(result, "first-review").done).toBe(true);
    expect(badge(result, "ten-reviews")).toMatchObject({
      current: 10,
      done: true,
    });
    expect(result.quests.find((quest) => quest.id === "review")?.done).toBe(
      false,
    );
  });

  it("restores a full course's XP and badges without rewriting any saved records", () => {
    const progress = createEmptyProgress();
    for (const entry of courseLessons)
      progress.lessons[entry.id] = {
        completedAt: past,
        lastStudiedAt: past,
        bestScore: 80,
        attemptCount: 1,
        xpAwarded: entry.xp,
      };
    progress.studyDays = Array.from(
      { length: 7 },
      (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`,
    );
    let review = addReviewCard(
      createEmptyReview(),
      "word",
      new Date(2026, 9, 24, 8),
    );
    for (let index = 0; index < 10; index++)
      review = reviewCard(
        review,
        "word",
        "again",
        review.cards.word.dueAt,
        `review-${index}`,
      );
    const saved = structuredClone({ progress, review });
    const result = game({ progress, review });
    expect(result.completedLessonCount).toBe(30);
    expect(result.experience.xp).toBe(1210);
    expect(result.unlockedBadgeCount).toBe(8);
    expect({ progress, review }).toEqual(saved);
    expect(game({ progress, review })).toEqual(result);
  });

  it("re-taking a lesson and doing SRS never adds XP through gamification", () => {
    const first = completeLesson(createEmptyProgress(), lesson, {
      correct: 4,
      total: 5,
      now: past,
    }).progress;
    const repeated = completeLesson(first, lesson, {
      correct: 5,
      total: 5,
      now: today,
    }).progress;
    const review = reviewed();
    const result = game({ progress: repeated, review });
    expect(result.experience.xp).toBe(lesson.xp);
    expect(result.completedLessonCount).toBe(1);
    expect(badge(result, "first-lesson").done).toBe(true);
    expect(badge(result, "five-lessons").done).toBe(false);
    expect(getTotalXp(repeated)).toBe(getTotalXp(first));
  });

  it("rejects an invalid clock instead of displaying misleading daily goals", () => {
    expect(() => game({ now: new Date("invalid") })).toThrow("学習日時");
  });
});

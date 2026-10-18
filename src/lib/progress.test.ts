import { describe, expect, it } from "vitest";
import {
  completeLesson,
  createEmptyProgress,
  getAccuracy,
  getNextLesson,
  getStreak,
  getTotalXp,
  isLessonUnlocked,
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
  type ExerciseAttempt,
  type LessonLike,
} from "./progress";

const now = "2026-10-18T10:00:00.000Z";
const first: LessonLike = { id: "intro", xp: 20, prerequisites: [] };
const second: LessonLike = {
  id: "consonants",
  xp: 30,
  prerequisites: ["intro"],
};

function attempt(exerciseId: string, correct: boolean): ExerciseAttempt {
  return {
    exerciseId,
    lessonId: first.id,
    selectedOptionId: correct ? "a" : "b",
    correct,
    attemptedAt: now,
  };
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>(
    initial === undefined ? [] : [[PROGRESS_STORAGE_KEY, initial]],
  );
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("lesson progress", () => {
  it("unlocks lessons through completed prerequisites and chooses the next available lesson", () => {
    const empty = createEmptyProgress();
    expect(isLessonUnlocked(empty, first)).toBe(true);
    expect(isLessonUnlocked(empty, second)).toBe(false);
    expect(getNextLesson(empty, [first, second])).toBe(first);
    expect(() =>
      completeLesson(empty, second, { correct: 1, total: 1, now }),
    ).toThrow("前提");

    const { progress } = completeLesson(empty, first, {
      correct: 1,
      total: 1,
      now,
    });
    expect(isLessonUnlocked(progress, second)).toBe(true);
    expect(getNextLesson(progress, [first, second])).toBe(second);
    expect(getNextLesson(progress, [first])).toBeUndefined();
    expect(empty).toEqual(createEmptyProgress());
  });

  it("requires at least 80%, rounded up to a whole answer", () => {
    expect(
      completeLesson(createEmptyProgress(), first, {
        correct: 4,
        total: 5,
        now,
      }).passed,
    ).toBe(true);
    expect(
      completeLesson(createEmptyProgress(), first, {
        correct: 3,
        total: 4,
        now,
      }).passed,
    ).toBe(false);
    expect(
      completeLesson(createEmptyProgress(), first, {
        correct: 2,
        total: 3,
        now,
      }).passed,
    ).toBe(false);
    expect(
      completeLesson(createEmptyProgress(), first, {
        correct: 1,
        total: 1,
        now,
      }).passed,
    ).toBe(true);
  });

  it("awards XP once and preserves completion and the best score after a failed retry", () => {
    const initial = completeLesson(createEmptyProgress(), first, {
      correct: 5,
      total: 5,
      now,
    });
    const repeated = completeLesson(initial.progress, first, {
      correct: 4,
      total: 5,
      now,
    });
    const failed = completeLesson(repeated.progress, first, {
      correct: 1,
      total: 5,
      now,
    });
    expect(initial.earnedXp).toBe(20);
    expect(repeated.earnedXp).toBe(0);
    expect(failed.earnedXp).toBe(0);
    expect(getTotalXp(failed.progress)).toBe(20);
    expect(failed.progress.lessons.intro).toMatchObject({
      bestScore: 100,
      attemptCount: 3,
      completedAt: now,
    });
    expect(failed.progress.studyDays).toHaveLength(1);
  });

  it("records failed attempts and only the first answer to an exercise in one session", () => {
    const result = completeLesson(createEmptyProgress(), first, {
      correct: 1,
      total: 2,
      now,
      attempts: [
        attempt("q1", false),
        attempt("q1", true),
        attempt("q2", true),
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.progress.lessons.intro).toMatchObject({
      bestScore: 50,
      attemptCount: 1,
      xpAwarded: 0,
    });
    expect(result.progress.lessons.intro.completedAt).toBeUndefined();
    expect(result.progress.attempts).toEqual([
      attempt("q1", false),
      attempt("q2", true),
    ]);
    expect(result.progress.studyDays).toHaveLength(1);
    expect(getAccuracy(result.progress)).toBe(50);
    expect(getAccuracy(createEmptyProgress())).toBe(0);
    expect(() =>
      completeLesson(createEmptyProgress(), first, {
        correct: 1,
        total: 1,
        now,
        attempts: [attempt("q1", false), attempt("q1", true)],
      }),
    ).toThrow("初回解答");
  });

  it("rejects impossible submissions without mutating progress", () => {
    const empty = createEmptyProgress();
    for (const result of [
      { correct: 0, total: 0, now },
      { correct: 2, total: 1, now },
      { correct: -1, total: 1, now },
      { correct: 0.5, total: 1, now },
      { correct: 1, total: 1, now: "2026-02-30T00:00:00Z" },
      { correct: 1, total: 1, now: "invalid date" },
    ])
      expect(() => completeLesson(empty, first, result)).toThrow();
    expect(() =>
      completeLesson(empty, first, {
        correct: 1,
        total: 1,
        now,
        attempts: [{ ...attempt("q1", true), lessonId: "another" }],
      }),
    ).toThrow("解答履歴");
    expect(empty).toEqual(createEmptyProgress());
  });

  it("uses the learner's local calendar date and computes a streak across month boundaries", () => {
    const localTime = new Date(2026, 9, 1, 0, 15);
    const result = completeLesson(createEmptyProgress(), first, {
      correct: 1,
      total: 1,
      now: localTime.toISOString(),
    });
    expect(result.progress.studyDays).toEqual(["2026-10-01"]);
    result.progress.studyDays.push("2026-09-30", "2026-09-29", "2026-09-27");
    expect(getStreak(result.progress, new Date(2026, 9, 1, 23))).toBe(3);
    expect(getStreak(result.progress, new Date(2026, 9, 2, 8))).toBe(3);
    expect(getStreak(result.progress, new Date(2026, 9, 3, 8))).toBe(0);
  });
});

describe("local progress repository", () => {
  it("round-trips progress and reports whether saved data was present", () => {
    const storage = memoryStorage();
    const repository = new LocalStorageProgressRepository(storage);
    expect(repository.load()).toEqual(createEmptyProgress());
    expect(repository.loadResult.status).toBe("empty");
    const { progress } = completeLesson(createEmptyProgress(), first, {
      correct: 1,
      total: 1,
      now,
    });
    expect(repository.save(progress)).toBe(true);
    expect(repository.load()).toEqual(progress);
    expect(repository.loadResult.status).toBe("loaded");
    expect(repository.saveError).toBeUndefined();
  });

  it.each([
    "{broken",
    "null",
    "[]",
    JSON.stringify({ ...createEmptyProgress(), version: 2 }),
    JSON.stringify({
      ...createEmptyProgress(),
      attempts: [{ correct: "yes" }],
    }),
    JSON.stringify({ ...createEmptyProgress(), studyDays: ["2026-02-30"] }),
    JSON.stringify({
      ...createEmptyProgress(),
      lessons: { intro: { bestScore: 200 } },
    }),
  ])(
    "falls back safely without overwriting invalid or unknown stored data: %s",
    (serialized) => {
      const storage = memoryStorage(serialized);
      const repository = new LocalStorageProgressRepository(storage);
      expect(repository.load()).toEqual(createEmptyProgress());
      expect(repository.loadResult.status).toBe("invalid");
      expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(serialized);
    },
  );

  it("handles SSR, blocked storage reads, and rejected writes without crashing", () => {
    const server = new LocalStorageProgressRepository(null);
    expect(server.load()).toEqual(createEmptyProgress());
    expect(server.loadResult.status).toBe("unavailable");
    expect(server.save(createEmptyProgress())).toBe(false);

    const blocked = new LocalStorageProgressRepository({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(blocked.load()).toEqual(createEmptyProgress());
    expect(blocked.loadResult.status).toBe("unavailable");
    expect(blocked.save(createEmptyProgress())).toBe(false);
    expect(blocked.saveError).toBeTruthy();
  });
});

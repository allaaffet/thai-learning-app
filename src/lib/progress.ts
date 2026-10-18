/** The storage boundary can be replaced with an authenticated backend later. */
export const PROGRESS_STORAGE_KEY = "thai-learning.progress.v1";

export interface LessonLike {
  id: string;
  xp: number;
  prerequisites: readonly string[];
}

export interface ExerciseAttempt {
  exerciseId: string;
  lessonId: string;
  selectedOptionId: string;
  correct: boolean;
  attemptedAt: string;
}

export interface LessonProgress {
  completedAt?: string;
  bestScore: number;
  attemptCount: number;
  xpAwarded: number;
  lastStudiedAt: string;
}

export interface LearningProgress {
  version: 1;
  lessons: Record<string, LessonProgress>;
  attempts: ExerciseAttempt[];
  /** Calendar dates in the learner's local time zone, rather than UTC dates. */
  studyDays: string[];
}

export interface LessonResult {
  correct: number;
  total: number;
  now?: string;
  attempts?: ExerciseAttempt[];
}

export interface ProgressRepository {
  load(): LearningProgress;
  save(progress: LearningProgress): boolean;
}

export type ProgressLoadStatus = "empty" | "loaded" | "invalid" | "unavailable";

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function createEmptyProgress(): LearningProgress {
  return { version: 1, lessons: {}, attempts: [], studyDays: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  // Require a full timestamp and a time zone to avoid ambiguous local parsing.
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  return Boolean(
    match &&
      isStudyDay(match[1]) &&
      Number(match[2]) < 24 &&
      Number(match[3]) < 60 &&
      Number(match[4]) < 60 &&
      (match[5] === undefined ||
        (Number(match[5]) < 24 && Number(match[6]) < 60)) &&
      Number.isFinite(new Date(value).getTime()),
  );
}

function isStudyDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAttempt(value: unknown): value is ExerciseAttempt {
  return (
    isRecord(value) &&
    isIdentifier(value.exerciseId) &&
    isIdentifier(value.lessonId) &&
    isIdentifier(value.selectedOptionId) &&
    typeof value.correct === "boolean" &&
    isTimestamp(value.attemptedAt)
  );
}

function isLessonProgress(value: unknown): value is LessonProgress {
  return (
    isRecord(value) &&
    (value.completedAt === undefined || isTimestamp(value.completedAt)) &&
    typeof value.bestScore === "number" &&
    Number.isFinite(value.bestScore) &&
    value.bestScore >= 0 &&
    value.bestScore <= 100 &&
    isNonnegativeInteger(value.attemptCount) &&
    isNonnegativeInteger(value.xpAwarded) &&
    isTimestamp(value.lastStudiedAt) &&
    (value.xpAwarded === 0 || value.completedAt !== undefined)
  );
}

/** Validate persisted input before it reaches progress calculations or the UI. */
export function isLearningProgress(value: unknown): value is LearningProgress {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isRecord(value.lessons) &&
    Object.entries(value.lessons).every(
      ([id, lesson]) => isIdentifier(id) && isLessonProgress(lesson),
    ) &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isAttempt) &&
    Array.isArray(value.studyDays) &&
    value.studyDays.every(isStudyDay)
  );
}

function localStudyDay(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isLessonUnlocked(
  progress: LearningProgress,
  lesson: LessonLike,
): boolean {
  return lesson.prerequisites.every((id) =>
    Boolean(progress.lessons[id]?.completedAt),
  );
}

/**
 * A lesson attempt keeps the first answer to each exercise. Re-answering within
 * one quiz cannot improve its score; taking the lesson again creates a new attempt.
 * Invalid or locked submissions are rejected without changing the caller's data.
 */
export function completeLesson(
  progress: LearningProgress,
  lesson: LessonLike,
  result: LessonResult,
): { progress: LearningProgress; passed: boolean; earnedXp: number } {
  if (
    !isLearningProgress(progress) ||
    !isIdentifier(lesson.id) ||
    !isNonnegativeInteger(lesson.xp) ||
    !Array.isArray(lesson.prerequisites) ||
    !lesson.prerequisites.every(isIdentifier)
  ) {
    throw new Error("学習データが正しくありません。");
  }
  if (!isLessonUnlocked(progress, lesson)) {
    throw new Error("前提レッスンを完了してください。");
  }
  if (
    !isNonnegativeInteger(result.correct) ||
    !isNonnegativeInteger(result.total) ||
    result.total < 1 ||
    result.correct > result.total
  ) {
    throw new Error("クイズの集計が正しくありません。");
  }

  const timestamp = result.now ?? new Date().toISOString();
  if (!isTimestamp(timestamp)) throw new Error("学習日時が正しくありません。");

  const firstAttempts: ExerciseAttempt[] = [];
  if (result.attempts !== undefined) {
    if (!Array.isArray(result.attempts))
      throw new Error("解答履歴が正しくありません。");
    const seen = new Set<string>();
    for (const attempt of result.attempts) {
      if (!isAttempt(attempt) || attempt.lessonId !== lesson.id) {
        throw new Error("解答履歴が正しくありません。");
      }
      if (!seen.has(attempt.exerciseId)) {
        seen.add(attempt.exerciseId);
        firstAttempts.push({ ...attempt });
      }
    }
    if (
      firstAttempts.length !== result.total ||
      firstAttempts.filter((attempt) => attempt.correct).length !==
        result.correct
    ) {
      throw new Error("初回解答とクイズの集計が一致しません。");
    }
  }

  const previous = progress.lessons[lesson.id];
  const passed = result.correct >= Math.ceil(result.total * 0.8);
  const earnedXp = passed && !previous?.completedAt ? lesson.xp : 0;
  const score = (result.correct / result.total) * 100;
  const lessonProgress: LessonProgress = {
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    attemptCount: (previous?.attemptCount ?? 0) + 1,
    xpAwarded: (previous?.xpAwarded ?? 0) + earnedXp,
    lastStudiedAt: timestamp,
  };
  if (previous?.completedAt) lessonProgress.completedAt = previous.completedAt;
  else if (passed) lessonProgress.completedAt = timestamp;

  return {
    passed,
    earnedXp,
    progress: {
      version: 1,
      lessons: { ...progress.lessons, [lesson.id]: lessonProgress },
      attempts: [...progress.attempts, ...firstAttempts],
      studyDays: [
        ...new Set([...progress.studyDays, localStudyDay(new Date(timestamp))]),
      ].sort(),
    },
  };
}

export function getTotalXp(progress: LearningProgress): number {
  return Object.values(progress.lessons).reduce(
    (sum, lesson) => sum + lesson.xpAwarded,
    0,
  );
}

export function getNextLesson<T extends LessonLike>(
  progress: LearningProgress,
  lessons: readonly T[],
): T | undefined {
  return lessons.find(
    (lesson) =>
      !progress.lessons[lesson.id]?.completedAt &&
      isLessonUnlocked(progress, lesson),
  );
}

/** Consecutive local calendar days ending today, or yesterday before today's study. */
export function getStreak(
  progress: LearningProgress,
  now = new Date(),
): number {
  if (!Number.isFinite(now.getTime())) return 0;
  const days = new Set(progress.studyDays);
  // Calendar arithmetic handles daylight-saving days without assuming 24 hours.
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!days.has(localStudyDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localStudyDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Percentage of first answers across all recorded quiz sessions. */
export function getAccuracy(progress: LearningProgress): number {
  if (progress.attempts.length === 0) return 0;
  return (
    (progress.attempts.filter((attempt) => attempt.correct).length /
      progress.attempts.length) *
    100
  );
}

export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly storage?: StorageAdapter;
  loadResult: { status: ProgressLoadStatus; message?: string } = {
    status: "empty",
  };
  saveError?: string;

  constructor(storage?: StorageAdapter | null) {
    try {
      this.storage =
        storage === null
          ? undefined
          : (storage ??
            (typeof window === "undefined" ? undefined : window.localStorage));
    } catch {
      this.storage = undefined;
    }
  }

  load(): LearningProgress {
    if (!this.storage) {
      this.loadResult = {
        status: "unavailable",
        message: "この環境では進捗を保存できません。",
      };
      return createEmptyProgress();
    }
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(PROGRESS_STORAGE_KEY);
    } catch {
      this.loadResult = {
        status: "unavailable",
        message: "保存済みの進捗を読み込めませんでした。",
      };
      return createEmptyProgress();
    }
    if (serialized === null) {
      this.loadResult = { status: "empty" };
      return createEmptyProgress();
    }
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!isLearningProgress(parsed)) throw new Error("Invalid progress");
      this.loadResult = { status: "loaded" };
      return parsed;
    } catch {
      // Preserve the original value for recovery; reading never overwrites it.
      this.loadResult = {
        status: "invalid",
        message:
          "保存データを読み込めませんでした。この画面では新しい進捗を使用します。",
      };
      return createEmptyProgress();
    }
  }

  save(progress: LearningProgress): boolean {
    this.saveError = undefined;
    if (!this.storage || !isLearningProgress(progress)) {
      this.saveError =
        "進捗を保存できません。この画面を閉じると今回の記録が失われる場合があります。";
      return false;
    }
    try {
      this.storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch {
      this.saveError =
        "進捗を保存できません。この画面を閉じると今回の記録が失われる場合があります。";
      return false;
    }
  }
}

import type { Chapter, Lesson } from "@/lib/content-types";
import { getTotalXp, type LearningProgress } from "@/lib/progress";
import type { ReviewState } from "@/lib/review";

export type GameQuestId = "lesson" | "answers" | "review";
export type GameBadgeId =
  | "first-lesson"
  | "five-lessons"
  | "first-chapter"
  | "three-days"
  | "seven-days"
  | "first-review"
  | "ten-reviews"
  | "course-complete";

export interface GameMilestone<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly description: string;
  readonly current: number;
  readonly target: number;
  readonly done: boolean;
  readonly percent: number;
}

/** XP describes recorded effort, never Thai proficiency or pronunciation quality. */
export interface ExperienceProgress {
  readonly level: number;
  readonly maxLevel: number;
  readonly xp: number;
  readonly goalXp: number;
  readonly currentThreshold: number;
  readonly nextThreshold: number;
  readonly earnedInLevel: number;
  readonly requiredInLevel: number;
  readonly remainingXp: number;
  readonly percent: number;
  readonly isMax: boolean;
}

export interface GameProgress {
  readonly dayKey: string;
  readonly experience: ExperienceProgress;
  readonly quests: readonly GameMilestone<GameQuestId>[];
  readonly badges: readonly GameMilestone<GameBadgeId>[];
  readonly completedQuestCount: number;
  readonly unlockedBadgeCount: number;
  readonly completedLessonCount: number;
  readonly studiedDayCount: number;
  readonly reviewCount: number;
}

export interface GameProgressInput {
  readonly progress: LearningProgress;
  readonly review: ReviewState;
  readonly lessons: readonly Pick<Lesson, "id" | "xp" | "exercises">[];
  readonly chapters: readonly Pick<
    Chapter,
    "id" | "number" | "title" | "lessonIds"
  >[];
  readonly now: Date;
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function knownPastTime(
  timestamp: string | undefined,
  now: number,
): Date | undefined {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  const time = date.getTime();
  return Number.isFinite(time) && time <= now ? date : undefined;
}

function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function milestone<Id extends string>(
  id: Id,
  title: string,
  description: string,
  count: number,
  target: number,
  enabled: boolean,
): GameMilestone<Id> {
  const current = enabled ? Math.max(0, Math.min(count, target)) : 0;
  return {
    id,
    title,
    description,
    current,
    target,
    done: enabled && target > 0 && current >= target,
    percent: target > 0 ? Math.round((current / target) * 100) : 0,
  };
}

function experience(xp: number, goalXp: number): ExperienceProgress {
  if (goalXp <= 0) {
    return {
      level: 1,
      maxLevel: 1,
      xp,
      goalXp: 0,
      currentThreshold: 0,
      nextThreshold: 0,
      earnedInLevel: 0,
      requiredInLevel: 0,
      remainingXp: 0,
      percent: 0,
      isMax: false,
    };
  }
  // The final interval can be shorter than 100 XP, so today's course has a real goal.
  const maxLevel = Math.ceil(goalXp / 100) + 1;
  const bounded = Math.max(0, Math.min(xp, goalXp));
  if (bounded >= goalXp) {
    return {
      level: maxLevel,
      maxLevel,
      xp,
      goalXp,
      currentThreshold: goalXp,
      nextThreshold: goalXp,
      earnedInLevel: 0,
      requiredInLevel: 0,
      remainingXp: 0,
      percent: 100,
      isMax: true,
    };
  }
  const level = Math.floor(bounded / 100) + 1;
  const currentThreshold = (level - 1) * 100;
  const nextThreshold = Math.min(currentThreshold + 100, goalXp);
  const earnedInLevel = bounded - currentThreshold;
  const requiredInLevel = nextThreshold - currentThreshold;
  return {
    level,
    maxLevel,
    xp,
    goalXp,
    currentThreshold,
    nextThreshold,
    earnedInLevel,
    requiredInLevel,
    remainingXp: nextThreshold - bounded,
    percent: Math.round((earnedInLevel / requiredInLevel) * 100),
    isMax: false,
  };
}

/** Derive the adventure from existing records; never award XP or write storage. */
export function getGameProgress({
  progress,
  review,
  lessons,
  chapters,
  now,
}: GameProgressInput): GameProgress {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime))
    throw new Error("学習日時が正しくありません。");
  const dayKey = localDay(now);
  const knownLessons = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const hasCourse = knownLessons.size > 0;
  const completed = new Set<string>();
  let studiedToday = 0;
  for (const id of knownLessons.keys()) {
    const record = progress.lessons[id];
    if (!record) continue;
    if (knownPastTime(record.completedAt, nowTime)) completed.add(id);
    const studied = knownPastTime(record.lastStudiedAt, nowTime);
    if (studied && localDay(studied) === dayKey) studiedToday += 1;
  }

  const questions = new Map(
    [...knownLessons.values()].map((lesson) => [
      lesson.id,
      new Set(lesson.exercises.map((exercise) => exercise.id)),
    ]),
  );
  const answersToday = new Set<string>();
  for (const attempt of progress.attempts) {
    if (!questions.get(attempt.lessonId)?.has(attempt.exerciseId)) continue;
    const at = knownPastTime(attempt.attemptedAt, nowTime);
    if (!at || localDay(at) !== dayKey) continue;
    // Exact duplicated persisted records do not create extra effort.
    answersToday.add(
      JSON.stringify([
        attempt.lessonId,
        attempt.exerciseId,
        attempt.selectedOptionId,
        attempt.correct,
        attempt.attemptedAt,
      ]),
    );
  }

  const studiedDays = new Set(
    progress.studyDays.filter((day) => validCalendarDay(day) && day <= dayKey),
  );
  const pastReviewCards = new Set<string>();
  let reviewCount = 0;
  for (const [id, card] of Object.entries(review.cards)) {
    if (!knownPastTime(card.lastReviewedAt, nowTime)) continue;
    if (!Number.isSafeInteger(card.reviewCount) || card.reviewCount < 0)
      continue;
    pastReviewCards.add(id);
    reviewCount += card.reviewCount;
  }
  const reviewedToday = new Set<string>();
  for (const attempt of review.history) {
    if (!pastReviewCards.has(attempt.cardId)) continue;
    const at = knownPastTime(attempt.reviewedAt, nowTime);
    if (at && localDay(at) === dayKey) reviewedToday.add(attempt.id);
  }

  const firstChapter = [...chapters].sort((a, b) => a.number - b.number)[0];
  const firstChapterIds = [...new Set(firstChapter?.lessonIds ?? [])];
  const firstChapterCompleted = firstChapterIds.filter((id) =>
    completed.has(id),
  ).length;
  const quests: GameMilestone<GameQuestId>[] = [
    milestone(
      "lesson",
      "1レッスンに取り組もう",
      "結果を振り返った受講を数えます。合否は問いません。",
      studiedToday,
      1,
      hasCourse,
    ),
    milestone(
      "answers",
      "5問に取り組もう",
      "終了した受講の確定回答を数えます。正誤は問いません。",
      answersToday.size,
      5,
      hasCourse,
    ),
    milestone(
      "review",
      "1語を復習しよう",
      "単語の答えを確かめ、自己評価を記録します。",
      reviewedToday.size,
      1,
      hasCourse,
    ),
  ];
  const badges: GameMilestone<GameBadgeId>[] = [
    milestone(
      "first-lesson",
      "はじめの一歩",
      "初めてのレッスンを完了。",
      completed.size,
      1,
      hasCourse,
    ),
    milestone(
      "five-lessons",
      "学びのリズム",
      "5つのレッスンを完了。",
      completed.size,
      5,
      hasCourse,
    ),
    milestone(
      "first-chapter",
      "最初の章を歩いて",
      firstChapter
        ? `「${firstChapter.title}」の全レッスンを完了。`
        : "最初の章の全レッスンを完了。",
      firstChapterCompleted,
      firstChapterIds.length,
      hasCourse,
    ),
    milestone(
      "three-days",
      "3日、ことばにふれる",
      "累計3日の受講記録。連続でなくても大丈夫。",
      studiedDays.size,
      3,
      hasCourse,
    ),
    milestone(
      "seven-days",
      "7日、ことばにふれる",
      "累計7日の受講記録。自分のペースで。",
      studiedDays.size,
      7,
      hasCourse,
    ),
    milestone(
      "first-review",
      "思い出す一歩",
      "初めて単語の復習を記録。",
      reviewCount,
      1,
      hasCourse,
    ),
    milestone(
      "ten-reviews",
      "復習の習慣",
      "単語の復習を累計10回記録。",
      reviewCount,
      10,
      hasCourse,
    ),
    milestone(
      "course-complete",
      "学びの地図を一巡",
      "現在のコースの全レッスンを完了。",
      completed.size,
      knownLessons.size,
      hasCourse,
    ),
  ];

  return {
    dayKey,
    experience: experience(
      getTotalXp(progress),
      [...knownLessons.values()].reduce((sum, lesson) => sum + lesson.xp, 0),
    ),
    quests,
    badges,
    completedQuestCount: quests.filter((quest) => quest.done).length,
    unlockedBadgeCount: badges.filter((badge) => badge.done).length,
    completedLessonCount: completed.size,
    studiedDayCount: studiedDays.size,
    reviewCount,
  };
}

import type {
  Exercise,
  ExploreItem,
  LearningBlock,
  Lesson,
} from "@/lib/content-types";
import { isLessonUnlocked, type LearningProgress } from "@/lib/progress";

export type MissionQuestionPurpose = "core" | "review" | "recall" | "retry";

export interface MissionQuestionCard {
  id: string;
  kind: "question";
  lessonId: string;
  exercise: Exercise;
  purpose: MissionQuestionPurpose;
}

export type MissionCard =
  | {
      id: string;
      kind: "learn";
      lessonId: string;
      block: LearningBlock;
      number: number;
    }
  | {
      id: string;
      kind: "explore";
      lessonId: string;
      item: ExploreItem;
    }
  | MissionQuestionCard;

/** 計画・復習・再挑戦は画面内のみ。保存する初回問題のIDは分離する。 */
export interface CourseMission {
  id: string;
  lessonId: string | null;
  cards: MissionCard[];
  coreExerciseIds: string[];
}

function safeSeed(seed: number): number {
  return Number.isSafeInteger(seed) ? seed >>> 0 : 0;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

function shuffled<T>(items: readonly T[], key: string): T[] {
  const result = [...items];
  let state = hash(key) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

interface ReviewCandidate {
  lesson: Lesson;
  exercise: Exercise;
  priority: number;
  ageDay: number;
  tie: number;
}

function questionKey(lessonId: string, exerciseId: string): string {
  return `${lessonId}:${exerciseId}`;
}

/** 未完了・未知の課は混ぜず、直近の誤答→未回答→古い回答を優先する。 */
function selectReview(
  lessons: readonly Lesson[],
  progress: LearningProgress,
  count: number,
  seed: number,
  excludedId?: string,
): ReviewCandidate[] {
  const candidates: ReviewCandidate[] = [];
  const seen = new Set<string>();
  const latest = new Map<string, { correct: boolean; at: number }>();
  for (const attempt of progress.attempts) {
    const at = Date.parse(attempt.attemptedAt);
    if (!Number.isFinite(at)) continue;
    const key = questionKey(attempt.lessonId, attempt.exerciseId);
    if (at >= (latest.get(key)?.at ?? -Infinity))
      latest.set(key, { correct: attempt.correct, at });
  }
  for (const lesson of lessons) {
    const previous = progress.lessons[lesson.id];
    if (
      lesson.id === excludedId ||
      !previous?.completedAt ||
      !isLessonUnlocked(progress, lesson)
    )
      continue;
    for (const exercise of lesson.exercises) {
      const key = questionKey(lesson.id, exercise.id);
      if (seen.has(key)) continue;
      seen.add(key);
      const attempt = latest.get(key);
      const fallback = Date.parse(previous.lastStudiedAt);
      const at = attempt?.at ?? (Number.isFinite(fallback) ? fallback : 0);
      candidates.push({
        lesson,
        exercise,
        priority: attempt ? (attempt.correct ? 2 : 0) : 1,
        // 日単位の古さを優先し、同日の教材はseedで入れ替える。
        ageDay: Math.floor(at / 86_400_000),
        tie: hash(`${seed}:${key}`),
      });
    }
  }
  const result: ReviewCandidate[] = [];
  const coverage = new Map<string, number>();
  while (result.length < count && candidates.length) {
    candidates.sort(
      (a, b) =>
        a.priority - b.priority ||
        (coverage.get(a.lesson.id) ?? 0) - (coverage.get(b.lesson.id) ?? 0) ||
        a.ageDay - b.ageDay ||
        a.tie - b.tie ||
        questionKey(a.lesson.id, a.exercise.id).localeCompare(
          questionKey(b.lesson.id, b.exercise.id),
        ),
    );
    const selected = candidates.shift()!;
    result.push(selected);
    coverage.set(
      selected.lesson.id,
      (coverage.get(selected.lesson.id) ?? 0) + 1,
    );
  }
  return result;
}

function question(
  lessonId: string,
  exercise: Exercise,
  purpose: MissionQuestionPurpose,
  seed: number,
): MissionQuestionCard {
  return {
    id: `${seed}:${purpose}:${questionKey(lessonId, exercise.id)}`,
    kind: "question",
    lessonId,
    exercise,
    purpose,
  };
}

/**
 * 説明と確認例を交互に扱う。概念と設問の対応を推測せず、新しい課の
 * 初回問題より前に全説明・例を置く。間に混ぜる問題は既に完了した課だけ。
 */
export function buildLessonMission(
  lesson: Lesson,
  allLessons: readonly Lesson[],
  progress: LearningProgress,
  seed = 0,
): CourseMission {
  if (!isLessonUnlocked(progress, lesson))
    throw new Error("前提レッスンを完了してください。");
  const runSeed = safeSeed(seed);
  const cards: MissionCard[] = [];
  const review = selectReview(allLessons, progress, 2, runSeed, lesson.id);
  const teachingCount = Math.max(lesson.blocks.length, lesson.explore.length);
  for (let index = 0; index < teachingCount; index += 1) {
    const block = lesson.blocks[index];
    const item = lesson.explore[index];
    if (block)
      cards.push({
        id: `${runSeed}:learn:${lesson.id}:${block.id}`,
        kind: "learn",
        lessonId: lesson.id,
        block,
        number: index + 1,
      });
    if (item)
      cards.push({
        id: `${runSeed}:explore:${lesson.id}:${item.id}`,
        kind: "explore",
        lessonId: lesson.id,
        item,
      });
    const retrieval = review[index];
    if (retrieval)
      cards.push(
        question(retrieval.lesson.id, retrieval.exercise, "review", runSeed),
      );
  }
  // 教材の説明が空でも、選んだ既習の復習は欠落させない。
  for (const retrieval of review.slice(teachingCount))
    cards.push(
      question(retrieval.lesson.id, retrieval.exercise, "review", runSeed),
    );

  const firstRecallAfter = Math.min(2, lesson.exercises.length - 1);
  for (const [index, exercise] of lesson.exercises.entries()) {
    cards.push(question(lesson.id, exercise, "core", runSeed));
    if (index === firstRecallAfter)
      cards.push(question(lesson.id, lesson.exercises[0], "recall", runSeed));
  }
  const middle = lesson.exercises[Math.floor(lesson.exercises.length / 2)];
  if (middle && middle.id !== lesson.exercises[0]?.id)
    cards.push(question(lesson.id, middle, "recall", runSeed));
  return {
    id: `lesson:${lesson.id}:${runSeed}`,
    lessonId: lesson.id,
    cards,
    coreExerciseIds: lesson.exercises.map((exercise) => exercise.id),
  };
}

/** 既習から最大6問。新規の進捗・XP・SRSの書込みを行う入口を持たない。 */
export function buildMixedReviewMission(
  allLessons: readonly Lesson[],
  progress: LearningProgress,
  seed = 0,
): CourseMission {
  const runSeed = safeSeed(seed);
  return {
    id: `review:${runSeed}`,
    lessonId: null,
    cards: selectReview(allLessons, progress, 6, runSeed).map((entry) =>
      question(entry.lesson.id, entry.exercise, "review", runSeed),
    ),
    coreExerciseIds: [],
  };
}

/** 同じ問題の再挑戦は一度だけ。再挑戦から次の再挑戦を生まない。 */
export function appendMissionRetry(
  cards: readonly MissionCard[],
  card: MissionCard,
): MissionCard[] {
  const original = cards.find((entry) => entry.id === card.id);
  if (
    card.kind !== "question" ||
    card.purpose === "retry" ||
    original?.kind !== "question" ||
    original.purpose === "retry" ||
    cards.some(
      (entry) =>
        entry.kind === "question" &&
        entry.purpose === "retry" &&
        entry.lessonId === original.lessonId &&
        entry.exercise.id === original.exercise.id,
    )
  )
    return [...cards];
  return [
    ...cards,
    {
      ...original,
      id: `retry:${questionKey(original.lessonId, original.exercise.id)}`,
      purpose: "retry",
    },
  ];
}

/** 問題の内容は変えず、選択位置だけを毎カードの安定した順へ入れ替える。 */
export function getMissionExercise(card: MissionQuestionCard): Exercise {
  const options = shuffled(card.exercise.options, `${card.id}:options`);
  if (card.exercise.type === "word-ordering")
    return {
      ...card.exercise,
      options,
      tokens: shuffled(card.exercise.tokens, `${card.id}:tokens`),
    };
  return { ...card.exercise, options };
}

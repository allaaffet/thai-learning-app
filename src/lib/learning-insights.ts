import type { Lesson } from "@/lib/content-types";
import type { ExerciseAttempt, LearningProgress } from "@/lib/progress";

export interface ConceptInsight {
  concept: string;
  correct: number;
  total: number;
  lessonIds: string[];
}

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Latest answer per question is used for weak concepts, rather than an old mistake forever. */
export function getLearningInsights(
  progress: LearningProgress,
  lessons: readonly Lesson[],
  now = new Date(),
) {
  const questions = new Map<
    string,
    { lesson: Lesson; exercise: Lesson["exercises"][number] }
  >(
    lessons.flatMap((lesson) =>
      lesson.exercises.map(
        (exercise) =>
          [`${lesson.id}:${exercise.id}`, { lesson, exercise }] as const,
      ),
    ),
  );
  const valid = progress.attempts.filter(
    (attempt) =>
      questions.has(`${attempt.lessonId}:${attempt.exerciseId}`) &&
      Number.isFinite(new Date(attempt.attemptedAt).getTime()),
  );
  const latest = new Map<string, ExerciseAttempt>();
  for (const attempt of valid) {
    const key = `${attempt.lessonId}:${attempt.exerciseId}`;
    const previous = latest.get(key);
    if (
      !previous ||
      new Date(attempt.attemptedAt).getTime() >=
        new Date(previous.attemptedAt).getTime()
    )
      latest.set(key, attempt);
  }
  const concepts = new Map<string, ConceptInsight>();
  for (const [key, attempt] of latest) {
    const question = questions.get(key)!;
    for (const concept of new Set(question.exercise.relatedConcepts)) {
      const record = concepts.get(concept) ?? {
        concept,
        correct: 0,
        total: 0,
        lessonIds: [],
      };
      record.total += 1;
      if (attempt.correct) record.correct += 1;
      if (!record.lessonIds.includes(attempt.lessonId))
        record.lessonIds.push(attempt.lessonId);
      concepts.set(concept, record);
    }
  }
  const weakConcepts = [...concepts.values()]
    .filter((record) => record.correct < record.total)
    .sort(
      (a, b) =>
        (b.total - b.correct) / b.total - (a.total - a.correct) / a.total ||
        b.total - a.total ||
        a.concept.localeCompare(b.concept, "ja"),
    )
    .slice(0, 6);
  const recentAnswers = [...valid]
    .reverse()
    .sort(
      (a, b) =>
        new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime(),
    )
    .slice(0, 8)
    .map((attempt) => ({
      ...attempt,
      ...questions.get(`${attempt.lessonId}:${attempt.exerciseId}`)!,
    }));
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - 6 + index);
    const day = localDay(date);
    return {
      day,
      answered: valid.filter(
        (attempt) => localDay(new Date(attempt.attemptedAt)) === day,
      ).length,
      studied: progress.studyDays.includes(day),
    };
  });
  return {
    weakConcepts,
    recentAnswers,
    activity,
    questionCount: latest.size,
    latestAccuracy: latest.size
      ? Math.round(
          ([...latest.values()].filter((attempt) => attempt.correct).length /
            latest.size) *
            100,
        )
      : null,
  };
}

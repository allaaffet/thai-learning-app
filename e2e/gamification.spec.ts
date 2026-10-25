import { expect, test, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import type { Lesson } from "../src/lib/content-types";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  isReviewState,
  reviewCard,
  REVIEW_STORAGE_KEY,
  type ReviewState,
} from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });

const firstLesson = courseLessons[0];
const now = "2026-10-25T09:00:00.000Z";
const earlier = "2026-10-24T09:00:00.000Z";

function completedProgress(
  lessons: readonly Lesson[],
  timestamp = earlier,
): LearningProgress {
  return {
    version: 1,
    lessons: Object.fromEntries(
      lessons.map((lesson) => [
        lesson.id,
        {
          completedAt: timestamp,
          bestScore: 100,
          attemptCount: 1,
          xpAwarded: lesson.xp,
          lastStudiedAt: timestamp,
        },
      ]),
    ),
    attempts: lessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        lessonId: lesson.id,
        selectedOptionId: exercise.answerId,
        correct: true,
        attemptedAt: timestamp,
      })),
    ),
    studyDays: [timestamp.slice(0, 10)],
  };
}

async function seed(
  page: Page,
  progress?: LearningProgress,
  review?: ReviewState,
  clock = now,
) {
  await page.clock.setFixedTime(new Date(clock));
  await page.addInitScript(
    ({ progressKey, reviewKey, progress, review }) => {
      if (progress && localStorage.getItem(progressKey) === null)
        localStorage.setItem(progressKey, JSON.stringify(progress));
      if (review && localStorage.getItem(reviewKey) === null)
        localStorage.setItem(reviewKey, JSON.stringify(review));
    },
    {
      progressKey: PROGRESS_STORAGE_KEY,
      reviewKey: REVIEW_STORAGE_KEY,
      progress,
      review,
    },
  );
}

async function savedProgress(page: Page): Promise<LearningProgress> {
  const value: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PROGRESS_STORAGE_KEY);
  if (!isLearningProgress(value)) throw new Error("Invalid learning progress");
  return value;
}

async function storageSnapshot(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}

async function expectQuest(
  page: Page,
  id: "lesson" | "answers" | "review",
  current: number,
  target: number,
) {
  const quest = page.getByTestId(`quest-${id}`);
  await expect(quest.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    String(current),
  );
  await expect(quest.getByRole("progressbar")).toHaveAttribute(
    "aria-valuemax",
    String(target),
  );
  await expect(quest).toHaveAttribute(
    "data-state",
    current === target ? "complete" : "active",
  );
}

async function enterQuiz(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: firstLesson.title }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
}

async function answerQuiz(page: Page, wrongIndexes = new Set<number>()) {
  for (const [index, exercise] of firstLesson.exercises.entries()) {
    const wrong = wrongIndexes.has(index);
    const answer = exercise.options.find((option) =>
      wrong ? option.id !== exercise.answerId : option.id === exercise.answerId,
    );
    if (!answer) throw new Error("Missing quiz option");
    await page.getByRole("radio", { name: answer.label, exact: true }).check();
    await page.getByRole("button", { name: "答えを確認", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: exercise.explanation }),
    ).toContainText(exercise.explanation);
    if (index === 2 && wrongIndexes.has(0) && !wrongIndexes.has(1) && !wrong)
      await expect(page.getByTestId("quiz-streak")).toContainText(
        "2問連続で正解",
      );
    await page
      .getByRole("button", {
        name:
          index === firstLesson.exercises.length - 1
            ? "結果を見る"
            : "次の問題へ",
        exact: true,
      })
      .click();
  }
}

async function finishLesson(page: Page) {
  await page
    .getByRole("button", { name: "レッスンを完了する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "レッスン完了！", exact: true }),
  ).toBeVisible();
}

async function installCelebrationProbe(page: Page) {
  await page.addInitScript(() => {
    const records: Array<{ display: string; animations: string[] }> = [];
    const observed = new WeakSet<Element>();
    Object.defineProperty(window, "__gameCelebrations", { value: records });
    const record = (element: Element) => {
      if (observed.has(element)) return;
      observed.add(element);
      records.push({
        display: getComputedStyle(element).display,
        animations: [
          ...element.querySelectorAll(".lesson-celebration-piece"),
        ].map((piece) => getComputedStyle(piece).animationName),
      });
    };
    new MutationObserver((mutations) => {
      for (const mutation of mutations)
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('[data-testid="lesson-celebration"]')) record(node);
          for (const element of node.querySelectorAll(
            '[data-testid="lesson-celebration"]',
          ))
            record(element);
        }
    }).observe(document, { childList: true, subtree: true });
  });
}

async function celebrationRecords(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__gameCelebrations");
    if (!Array.isArray(value)) throw new Error("Missing celebration probe");
    return value.map((record: unknown) => {
      if (typeof record !== "object" || record === null)
        throw new Error("Invalid celebration record");
      const display: unknown = Reflect.get(record, "display");
      const animations: unknown = Reflect.get(record, "animations");
      if (
        typeof display !== "string" ||
        !Array.isArray(animations) ||
        !animations.every((item: unknown) => typeof item === "string")
      )
        throw new Error("Invalid celebration styles");
      return { display, animations: animations as string[] };
    });
  });
}

test("以前の進捗から経験レベルとバッジを表示し、閲覧だけでは保存や演出を増やさない", async ({
  page,
}) => {
  const prior = completedProgress(courseLessons.slice(0, 22));
  prior.studyDays = ["2026-10-20", "2026-10-22", "2026-10-24"];
  await seed(page, prior);
  await installCelebrationProbe(page);
  await page.goto("/");
  await expect(page.getByTestId("experience-level")).toHaveText("9");
  await expect(page.getByTestId("experience-xp")).toContainText("890 XP");
  await expectQuest(page, "lesson", 0, 1);
  await expectQuest(page, "answers", 0, 5);
  await expectQuest(page, "review", 0, 1);
  const before = await storageSnapshot(page);
  expect(Object.keys(before)).toEqual([PROGRESS_STORAGE_KEY]);
  await page.goto("/progress#achievements");
  await expect(
    page.getByRole("region", { name: "達成バッジ", exact: true }),
  ).toBeVisible();
  for (const id of [
    "first-lesson",
    "five-lessons",
    "first-chapter",
    "three-days",
  ])
    await expect(page.getByTestId(`badge-${id}`)).toHaveAttribute(
      "data-earned",
      "true",
    );
  for (const id of [
    "seven-days",
    "first-review",
    "ten-reviews",
    "course-complete",
  ])
    await expect(page.getByTestId(`badge-${id}`)).toHaveAttribute(
      "data-earned",
      "false",
    );
  const badge = page.getByTestId("badge-first-lesson");
  await badge.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(badge).toHaveAttribute("open", "");
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await celebrationRecords(page)).toHaveLength(0);
  expect(await savedProgress(page)).toEqual(prior);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
});

test("正解の連続と完了を楽しめ、初回バッジを得ても再受講のXPは増えない", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seed(page);
  await installCelebrationProbe(page);
  await page.goto(`/lessons/${firstLesson.id}`);
  expect(await celebrationRecords(page)).toHaveLength(0);
  await enterQuiz(page);
  await answerQuiz(page, new Set([0]));
  expect(await celebrationRecords(page)).toHaveLength(0);
  await finishLesson(page);
  await expect
    .poll(async () => (await celebrationRecords(page)).length)
    .toBe(1);
  expect(
    (await celebrationRecords(page))[0].animations.some(
      (animation) => animation === "lesson-confetti",
    ),
  ).toBe(true);
  const saved = await savedProgress(page);
  expect(getTotalXp(saved)).toBe(firstLesson.xp);
  expect(saved.lessons[firstLesson.id].bestScore).toBe(80);
  await page.goto("/progress#achievements");
  await expect(page.getByTestId("badge-first-lesson")).toHaveAttribute(
    "data-earned",
    "true",
  );
  await page.reload();
  expect(await celebrationRecords(page)).toHaveLength(0);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterQuiz(page);
  await answerQuiz(page);
  await finishLesson(page);
  await expect
    .poll(async () => (await celebrationRecords(page)).length)
    .toBe(1);
  const repeated = await savedProgress(page);
  expect(getTotalXp(repeated)).toBe(firstLesson.xp);
  expect(repeated.lessons[firstLesson.id]).toMatchObject({
    completedAt: saved.lessons[firstLesson.id].completedAt,
    bestScore: 100,
    attemptCount: 2,
    xpAwarded: firstLesson.xp,
  });
  await expect(
    page.getByText("XP · 再受講は加算なし", { exact: true }),
  ).toBeVisible();
});

test("誤答した受講も努力クエストに数え、XPや次のレッスンの解放は追加しない", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seed(page);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterQuiz(page);
  await answerQuiz(
    page,
    new Set(firstLesson.exercises.map((_, index) => index)),
  );
  const saved = await savedProgress(page);
  expect(getTotalXp(saved)).toBe(0);
  expect(saved.lessons[firstLesson.id].completedAt).toBeUndefined();
  await expect(page.getByTestId("quiz-streak")).toHaveCount(0);
  await page.goto("/");
  await expectQuest(page, "lesson", 1, 1);
  await expectQuest(page, "answers", 5, 5);
  await expectQuest(page, "review", 0, 1);
  await expect(page.getByTestId("badge-first-lesson")).toHaveAttribute(
    "data-earned",
    "false",
  );
  await page.goto(`/lessons/${courseLessons[1].id}`);
  await expect(
    page.getByRole("button", { name: "練習に進む", exact: true }),
  ).toHaveCount(0);
  expect(await savedProgress(page)).toEqual(saved);
});

test("単語の自己評価で復習クエストとバッジが進み、既存のXPは変わらない", async ({
  page,
}) => {
  const prior = completedProgress([firstLesson]);
  const entry = vocabularyEntries[0];
  await seed(page, prior);
  await page.goto("/vocabulary");
  await page
    .getByRole("article", { name: entry.thai, exact: true })
    .getByRole("button", { name: `${entry.thai} を復習に追加`, exact: true })
    .click();
  await page.goto("/review");
  await page
    .getByRole("button", { name: "今日の復習をはじめる", exact: true })
    .click();
  await page.getByRole("button", { name: "答えを表示", exact: true }).click();
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await page.getByRole("button", { name: "復習を終える", exact: true }).click();
  await page.goto("/");
  await expectQuest(page, "review", 1, 1);
  await expectQuest(page, "lesson", 0, 1);
  expect(await savedProgress(page)).toEqual(prior);
  await page.goto("/progress#achievements");
  await expect(page.getByTestId("badge-first-review")).toHaveAttribute(
    "data-earned",
    "true",
  );
  const review: unknown = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    REVIEW_STORAGE_KEY,
  );
  expect(
    isReviewState(
      review,
      vocabularyEntries.map((item) => item.id),
    ),
  ).toBe(true);
  expect(Object.keys(await storageSnapshot(page)).sort()).toEqual(
    [PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY].sort(),
  );
});

test("日本時間の日付が変わると今日のクエストだけを切り替え、XPとバッジは保持する", async ({
  page,
}) => {
  const activityTime = "2026-10-25T14:50:00.000Z";
  const prior = completedProgress([firstLesson], activityTime);
  const id = vocabularyEntries[0].id;
  const review = reviewCard(
    addReviewCard(createEmptyReview(), id, activityTime),
    id,
    "again",
    activityTime,
    "midnight-review",
  );
  await seed(page, prior, review, "2026-10-25T14:59:00.000Z");
  await page.goto("/");
  await expectQuest(page, "lesson", 1, 1);
  await expectQuest(page, "answers", 5, 5);
  await expectQuest(page, "review", 1, 1);
  const before = await storageSnapshot(page);
  await page.clock.setFixedTime(new Date("2026-10-25T15:01:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expectQuest(page, "lesson", 0, 1);
  await expectQuest(page, "answers", 0, 5);
  await expectQuest(page, "review", 0, 1);
  await expect(page.getByTestId("experience-xp")).toContainText(
    `${firstLesson.xp} XP`,
  );
  await expect(page.getByTestId("badge-first-lesson")).toHaveAttribute(
    "data-earned",
    "true",
  );
  expect(await storageSnapshot(page)).toEqual(before);
});

test("動きを減らす設定では完了時の紙片アニメーションを停止する", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  await installCelebrationProbe(page);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterQuiz(page);
  await answerQuiz(page);
  expect(await celebrationRecords(page)).toHaveLength(0);
  await finishLesson(page);
  await expect
    .poll(async () => (await celebrationRecords(page)).length)
    .toBe(1);
  const [record] = await celebrationRecords(page);
  expect(record.display).toBe("none");
  expect(record.animations.length).toBeGreaterThan(0);
  expect(record.animations.every((animation) => animation === "none")).toBe(
    true,
  );
  expect(getTotalXp(await savedProgress(page))).toBe(firstLesson.xp);
});

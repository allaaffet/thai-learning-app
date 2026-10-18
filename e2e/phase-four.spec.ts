import { expect, test, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import {
  grammarPoints,
  vocabularyCategories,
  vocabularyEntries,
} from "../src/data/language";
import type { Exercise, Lesson } from "../src/lib/content-types";
import { INCORRECT_INPUT_ID } from "../src/lib/exercise-grading";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  isReviewState,
  REVIEW_STORAGE_KEY,
  type ReviewState,
} from "../src/lib/review";

const priorLessons = courseLessons.slice(0, 22);
const addedLessons = courseLessons.slice(22);
const now = "2026-10-18T09:00:00.000Z";
const day = 24 * 60 * 60 * 1_000;

function completedPriorCourse(): LearningProgress {
  return {
    version: 1,
    lessons: Object.fromEntries(
      priorLessons.map((lesson) => [
        lesson.id,
        {
          completedAt: now,
          bestScore: 100,
          attemptCount: 1,
          xpAwarded: lesson.xp,
          lastStudiedAt: now,
        },
      ]),
    ),
    attempts: priorLessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        lessonId: lesson.id,
        selectedOptionId: exercise.answerId,
        correct: true,
        attemptedAt: now,
      })),
    ),
    studyDays: ["2026-10-18"],
  };
}

async function seedProgress(page: Page) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ key, progress }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(progress));
    },
    { key: PROGRESS_STORAGE_KEY, progress: completedPriorCourse() },
  );
}

async function storedProgress(page: Page): Promise<LearningProgress> {
  const value: unknown = await page.evaluate((key) => {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  }, PROGRESS_STORAGE_KEY);
  expect(isLearningProgress(value)).toBe(true);
  if (!isLearningProgress(value)) throw new Error("Invalid lesson progress");
  return value;
}

async function storedReview(page: Page): Promise<ReviewState> {
  const value: unknown = await page.evaluate((key) => {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  }, REVIEW_STORAGE_KEY);
  if (
    !isReviewState(
      value,
      vocabularyEntries.map((entry) => entry.id),
    )
  )
    throw new Error("Invalid review progress");
  return value;
}

async function expectNoOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function enterQuiz(page: Page, lesson: Lesson) {
  await expect(
    page.getByRole("heading", { level: 1, name: lesson.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
}

async function answerExercise(
  page: Page,
  exercise: Exercise,
  wrong = false,
  keyboard = false,
  expectInitialFocus = true,
) {
  const prompt = page.getByRole("heading", {
    name: exercise.prompt,
    exact: true,
  });
  await expect(prompt).toBeVisible();
  if (expectInitialFocus) await expect(prompt).toBeFocused();
  const confirm = page.getByRole("button", { name: "答えを確認", exact: true });
  await expect(confirm).toBeDisabled();
  if (exercise.type === "fill-in-the-blank") {
    const input = page.getByRole("textbox", {
      name: "空欄の答え",
      exact: true,
    });
    await input.fill(
      wrong ? "PRIVATE INPUT NOT SAVED" : ` ${exercise.acceptedAnswers[0]} `,
    );
    await expect(confirm).toBeEnabled();
  } else if (exercise.type === "word-ordering") {
    const ordered = [...exercise.answerOrder];
    if (wrong) [ordered[0], ordered[1]] = [ordered[1], ordered[0]];
    for (const [index, id] of ordered.entries()) {
      const token = exercise.tokens.find((item) => item.id === id);
      if (!token) throw new Error("Missing word-ordering token");
      const button = page.getByRole("button", {
        name: `${token.label} を追加`,
        exact: true,
      });
      if (keyboard) {
        await button.focus();
        await page.keyboard.press("Enter");
      } else await button.click();
      await expect(button).toBeDisabled();
      if (index < ordered.length - 1) await expect(confirm).toBeDisabled();
    }
  } else {
    const option = exercise.options.find((item) =>
      wrong ? item.id !== exercise.answerId : item.id === exercise.answerId,
    );
    if (!option) throw new Error("Missing choice answer");
    await page.getByRole("radio", { name: option.label, exact: true }).click();
  }
  await confirm.click();
  const feedback = page
    .getByRole("status")
    .filter({ hasText: exercise.explanation });
  await expect(feedback).toContainText(wrong ? "不正解" : "正解");
  if (exercise.type === "fill-in-the-blank") {
    await expect(
      page.getByRole("textbox", { name: "空欄の答え", exact: true }),
    ).toBeDisabled();
  } else if (exercise.type === "word-ordering") {
    await expect(
      page.getByRole("button", { name: "一つ戻す", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "並べ直す", exact: true }),
    ).toBeDisabled();
  } else {
    for (const option of exercise.options)
      await expect(
        page.getByRole("radio", { name: option.label, exact: true }),
      ).toBeDisabled();
  }
}

async function answerLesson(
  page: Page,
  lesson: Lesson,
  wrongIds = new Set<string>(),
) {
  for (const [index, exercise] of lesson.exercises.entries()) {
    await answerExercise(
      page,
      exercise,
      wrongIds.has(exercise.id),
      index === 0,
    );
    await page
      .getByRole("button", {
        name:
          index === lesson.exercises.length - 1 ? "結果を見る" : "次の問題へ",
        exact: true,
      })
      .click();
  }
}

async function completeLesson(page: Page) {
  await page
    .getByRole("button", { name: "レッスンを完了する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "レッスン完了！", exact: true }),
  ).toBeVisible();
}

async function addVocabulary(page: Page, id: string) {
  const entry = vocabularyEntries.find((item) => item.id === id);
  if (!entry) throw new Error("Missing vocabulary entry");
  const article = page.getByRole("article", { name: entry.thai, exact: true });
  await article
    .getByRole("button", { name: `${entry.thai} を復習に追加`, exact: true })
    .click();
  await expect(
    article.getByRole("button", {
      name: `${entry.thai} は登録済み`,
      exact: true,
    }),
  ).toBeDisabled();
}

async function reviewSingleCard(
  page: Page,
  label: "もう一度" | "迷った" | "思い出せた",
) {
  await page.goto("/review");
  await page
    .getByRole("button", { name: "今日の復習をはじめる", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: label, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "答えを表示", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
  for (const grade of ["もう一度", "迷った", "思い出せた"])
    await expect(
      page.getByRole("button", { name: grade, exact: true }),
    ).toBeDisabled();
  await page.getByRole("button", { name: "復習を終える", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "今日の復習、おつかれさまでした。",
      exact: true,
    }),
  ).toBeVisible();
}

test("既存22課・890XPを保ち、新しい8課の入力・語順問題を完了し、再受講でもXPを重複しない", async ({
  page,
}) => {
  test.setTimeout(180_000);
  expect(addedLessons).toHaveLength(8);
  expect(priorLessons.flatMap((lesson) => lesson.exercises)).toHaveLength(110);
  await seedProgress(page);
  await page.goto(`/lessons/${addedLessons[0].id}`);
  let xp = 890;
  for (const [index, lesson] of addedLessons.entries()) {
    await enterQuiz(page, lesson);
    await answerLesson(page, lesson);
    await completeLesson(page);
    xp += lesson.xp;
    const saved = await storedProgress(page);
    expect(getTotalXp(saved)).toBe(xp);
    expect(saved.lessons[lesson.id]).toMatchObject({
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: 40,
    });
    if (index < addedLessons.length - 1) {
      const next = page.getByRole("link", {
        name: "次のレッスンへ",
        exact: true,
      });
      await expect(next).toHaveAttribute(
        "href",
        `/lessons/${addedLessons[index + 1].id}`,
      );
      await next.click();
    } else
      await page
        .getByRole("link", { name: "ロードマップに戻る", exact: true })
        .click();
  }
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "学びの道のり", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "学びの道のり", exact: true }),
  ).toBeVisible();
  const saved = await storedProgress(page);
  expect(getTotalXp(saved)).toBe(1210);
  expect(Object.keys(saved.lessons)).toHaveLength(30);
  expect(saved.attempts).toHaveLength(150);
  expect(saved.attempts.slice(0, 110)).toEqual(completedPriorCourse().attempts);
  for (const lesson of priorLessons)
    expect(saved.lessons[lesson.id]).toEqual(
      completedPriorCourse().lessons[lesson.id],
    );
  for (const lesson of courseLessons)
    await expect(page.getByTestId(`lesson-card-${lesson.id}`)).toContainText(
      "完了",
    );
  await expectNoOverflow(page);
  await page.goto(`/lessons/${addedLessons[0].id}`);
  await enterQuiz(page, addedLessons[0]);
  await answerLesson(page, addedLessons[0]);
  await completeLesson(page);
  expect(getTotalXp(await storedProgress(page))).toBe(1210);
});

test("新しい文法課もURL直アクセスで前提を迂回できない", async ({ page }) => {
  await page.goto(`/lessons/${addedLessons[0].id}`);
  await expect(
    page.getByRole("heading", {
      name: "まずは、前提レッスンから。",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "空欄の答え", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/lessons/${addedLessons.at(-1)?.id}`);
  await expect(
    page.getByRole("heading", {
      name: "まずは、前提レッスンから。",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
});

test("文字入力・語順の最初の誤答が固定され、60%は再挑戦・80%で完了する", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const lesson = addedLessons[0];
  const fill = lesson.exercises.find(
    (exercise) => exercise.type === "fill-in-the-blank",
  );
  const ordering = lesson.exercises.find(
    (exercise) => exercise.type === "word-ordering",
  );
  if (!fill || !ordering)
    throw new Error("First lesson must include both new exercise types");
  await seedProgress(page);
  await page.goto(`/lessons/${lesson.id}`);
  await enterQuiz(page, lesson);
  await answerLesson(page, lesson, new Set([fill.id, ordering.id]));
  await expect(page.locator(".review-score")).toContainText("60%");
  await expect(
    page.getByRole("button", { name: "レッスンを完了する", exact: true }),
  ).toHaveCount(0);
  const failed = await storedProgress(page);
  expect(getTotalXp(failed)).toBe(890);
  expect(failed.lessons[lesson.id].completedAt).toBeUndefined();
  const wrong = failed.attempts.filter(
    (attempt) => attempt.lessonId === lesson.id && !attempt.correct,
  );
  expect(wrong).toHaveLength(2);
  expect(wrong.map((attempt) => attempt.selectedOptionId)).toEqual([
    INCORRECT_INPUT_ID,
    INCORRECT_INPUT_ID,
  ]);
  expect(JSON.stringify(failed)).not.toContain("PRIVATE INPUT NOT SAVED");
  await page
    .getByRole("button", { name: "もう一度練習する", exact: true })
    .click();
  await answerLesson(page, lesson, new Set([fill.id]));
  await expect(page.locator(".review-score")).toContainText("80%");
  await completeLesson(page);
  const passed = await storedProgress(page);
  expect(getTotalXp(passed)).toBe(930);
  expect(passed.lessons[lesson.id]).toMatchObject({
    bestScore: 80,
    attemptCount: 2,
  });
});

test("並べ替えの取消し・リセットをキーボードで使え、未完成では回答を確定できない", async ({
  page,
}) => {
  const lesson = addedLessons[0];
  await seedProgress(page);
  await page.goto(`/lessons/${lesson.id}`);
  await enterQuiz(page, lesson);
  for (const exercise of lesson.exercises) {
    if (exercise.type === "word-ordering") {
      const token = exercise.tokens[0];
      const add = page.getByRole("button", {
        name: `${token.label} を追加`,
        exact: true,
      });
      await add.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("group", { name: "選んだ語句", exact: true }),
      ).toContainText(token.label);
      await expect(
        page.getByRole("button", { name: "答えを確認", exact: true }),
      ).toBeDisabled();
      const undo = page.getByRole("button", { name: "一つ戻す", exact: true });
      await undo.focus();
      await page.keyboard.press("Enter");
      await expect(add).toBeEnabled();
      await add.click();
      await page.getByRole("button", { name: "並べ直す", exact: true }).click();
      await expect(add).toBeEnabled();
      await page.setViewportSize({ width: 320, height: 844 });
      await expectNoOverflow(page);
      await answerExercise(page, exercise, false, true, false);
      return;
    }
    await answerExercise(page, exercise);
    await page.getByRole("button", { name: "次の問題へ", exact: true }).click();
  }
  throw new Error("Missing ordering exercise");
});

test("40語を検索・分類して復習に追加し、1日後の予定と既存XPを再読み込み後も保持する", async ({
  page,
}, testInfo) => {
  await seedProgress(page);
  await page.goto("/vocabulary");
  await expect(page.getByRole("article")).toHaveCount(40);
  const entry = vocabularyEntries.find((item) => item.id === "water");
  if (!entry) throw new Error("Missing water vocabulary");
  const query = page.getByLabel("単語を検索", { exact: true });
  for (const search of [entry.thai, entry.meaning, entry.ipa.slice(1, -1)]) {
    await query.fill(search);
    await expect(
      page.getByRole("article", { name: entry.thai, exact: true }),
    ).toBeVisible();
  }
  await query.fill("存在しない検索語");
  await expect(
    page.getByRole("heading", {
      name: "該当する単語がありません",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "検索条件をリセット", exact: true })
    .click();
  await page.getByLabel("カテゴリー", { exact: true }).selectOption("nouns");
  await expect(page.getByRole("article")).toHaveCount(
    vocabularyEntries.filter((item) => item.categoryId === "nouns").length,
  );
  await addVocabulary(page, entry.id);
  const added = await storedReview(page);
  expect(added.cards[entry.id]).toMatchObject({
    dueAt: now,
    intervalDays: 0,
    reviewCount: 0,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("vocabulary-mobile-width.png"),
    fullPage: true,
  });
  await reviewSingleCard(page, "思い出せた");
  const reviewed = await storedReview(page);
  expect(reviewed.history).toHaveLength(1);
  expect(reviewed.cards[entry.id]).toMatchObject({
    dueAt: new Date(Date.parse(now) + day).toISOString(),
    stage: 1,
    reviewCount: 1,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "今の予定分は、復習できています。",
      exact: true,
    }),
  ).toBeVisible();
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
  expect(await storedReview(page)).toEqual(reviewed);
});

test("もう一度は10分・迷ったは1日となり、期限前は出題されずXPは増えない", async ({
  page,
}) => {
  await seedProgress(page);
  await page.goto("/vocabulary");
  const entry = vocabularyEntries[0];
  await addVocabulary(page, entry.id);
  await reviewSingleCard(page, "もう一度");
  let state = await storedReview(page);
  expect(state.cards[entry.id]).toMatchObject({
    dueAt: "2026-10-18T09:10:00.000Z",
    stage: 0,
    lapses: 1,
    reviewCount: 1,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "今日の復習をはじめる", exact: true }),
  ).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-10-18T09:10:00.000Z"));
  await reviewSingleCard(page, "迷った");
  state = await storedReview(page);
  expect(state.cards[entry.id]).toMatchObject({
    dueAt: "2026-10-19T09:10:00.000Z",
    stage: 0,
    lapses: 1,
    reviewCount: 2,
    intervalDays: 1,
  });
  expect(state.history.map((attempt) => attempt.grade)).toEqual([
    "again",
    "hard",
  ]);
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
});

test("別タブのカード追加を反映し、後から追加しても先の記録を失わない", async ({
  page,
  context,
}) => {
  await seedProgress(page);
  await page.goto("/vocabulary");
  const second = await context.newPage();
  await second.clock.setFixedTime(new Date(now));
  await second.goto("/vocabulary");
  await addVocabulary(page, vocabularyEntries[0].id);
  const entry = vocabularyEntries[0];
  await expect(
    second.getByRole("button", {
      name: `${entry.thai} は登録済み`,
      exact: true,
    }),
  ).toBeDisabled();
  await addVocabulary(second, vocabularyEntries[1].id);
  await expect(
    page.getByRole("button", {
      name: `${vocabularyEntries[1].thai} は登録済み`,
      exact: true,
    }),
  ).toBeDisabled();
  const saved = await storedReview(page);
  expect(Object.keys(saved.cards).sort()).toEqual(
    vocabularyEntries
      .slice(0, 2)
      .map((item) => item.id)
      .sort(),
  );
  expect(saved.history).toHaveLength(0);
  await second.close();
  await page.reload();
  expect(await storedReview(page)).toEqual(saved);
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
});

test("保存できなくても画面内で復習でき、既存レッスン進捗は影響を受けない", async ({
  page,
}) => {
  await seedProgress(page);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (requestedKey, value) {
      if (requestedKey === key)
        throw new DOMException("Quota reached", "QuotaExceededError");
      return original.call(this, requestedKey, value);
    };
  }, REVIEW_STORAGE_KEY);
  await page.goto("/vocabulary");
  await addVocabulary(page, vocabularyEntries[0].id);
  await expect(
    page.getByRole("status").filter({ hasText: /復習.*保存できません/ }),
  ).toBeVisible();
  // Client-side navigation keeps this session's memory when persistent storage fails.
  await page
    .getByRole("link", { name: /^(単語の復習|復習)$/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "今日の復習をはじめる", exact: true })
    .click();
  await page.getByRole("button", { name: "答えを表示", exact: true }).click();
  await page.getByRole("button", { name: "思い出せた", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "思い出せた", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), REVIEW_STORAGE_KEY),
  ).toBeNull();
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "最初の復習カードを選びましょう",
      exact: true,
    }),
  ).toBeVisible();
});

test("不正な復習データは上書きせず警告し、既存のレッスン進捗を保持する", async ({
  page,
}) => {
  await seedProgress(page);
  const corrupt = '{"version":99,"cards":"unknown"}';
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: REVIEW_STORAGE_KEY, value: corrupt },
  );
  await page.goto("/vocabulary");
  await expect(
    page.getByRole("status").filter({ hasText: /復習.*読み込めません/ }),
  ).toBeVisible();
  await addVocabulary(page, vocabularyEntries[0].id);
  await expect(
    page.getByRole("status").filter({ hasText: /上書きしていません/ }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), REVIEW_STORAGE_KEY),
  ).toBe(corrupt);
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
  await page.reload();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), REVIEW_STORAGE_KEY),
  ).toBe(corrupt);
});

test("8項目の文法で語の役割と関連課を確認でき、検索・字体・320px幅でも使える", async ({
  page,
}, testInfo) => {
  expect(grammarPoints).toHaveLength(8);
  expect(vocabularyCategories).toHaveLength(7);
  await seedProgress(page);
  await page.goto("/grammar");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "文の仕組みを、つかむ。",
      exact: true,
    }),
  ).toBeVisible();
  const detail = page.locator("#grammar-detail");
  for (const point of grammarPoints) {
    const select = page.getByRole("button", { name: point.title, exact: true });
    await select.focus();
    await page.keyboard.press("Enter");
    await expect(
      detail.getByRole("heading", { name: point.title, exact: true }),
    ).toBeVisible();
    await expect(detail).toContainText(point.examples[0].segments[0].role);
    const lesson = courseLessons.find(
      (item) => item.id === point.relatedLessonIds[0],
    );
    if (!lesson) throw new Error("Missing related grammar lesson");
    const unlocked = lesson.prerequisites.every((id) =>
      priorLessons.some((prior) => prior.id === id),
    );
    if (unlocked)
      await expect(
        detail.getByRole("link", { name: lesson.title, exact: true }),
      ).toHaveAttribute("href", `/lessons/${lesson.id}`);
    else
      await expect(detail).toContainText(
        `${lesson.title} · 前提レッスンの完了後に学べます`,
      );
  }
  await page
    .getByLabel("文法を検索", { exact: true })
    .fill(grammarPoints[0].title);
  await page
    .getByRole("button", { name: grammarPoints[0].title, exact: true })
    .click();
  const font = page.getByRole("switch", {
    name: "ループなしのタイ語フォント",
    exact: true,
  });
  await font.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("grammar-mobile-width.png"),
    fullPage: true,
  });
  expect(await storedProgress(page)).toEqual(completedPriorCourse());
});

test("学習記録は最新の回答から苦手な概念を案内し、再受講の改善と7日の活動を反映する", async ({
  page,
}) => {
  const lesson = addedLessons[0];
  const fill = lesson.exercises.find(
    (exercise) => exercise.type === "fill-in-the-blank",
  );
  if (!fill) throw new Error("Missing fill-in-the-blank exercise");
  const original = completedPriorCourse();
  original.lessons[lesson.id] = {
    completedAt: now,
    bestScore: 80,
    attemptCount: 1,
    xpAwarded: 40,
    lastStudiedAt: now,
  };
  original.attempts.push(
    ...lesson.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      lessonId: lesson.id,
      selectedOptionId:
        exercise.id === fill.id ? INCORRECT_INPUT_ID : exercise.answerId,
      correct: exercise.id !== fill.id,
      attemptedAt: now,
    })),
  );
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ key, progress }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(progress));
    },
    { key: PROGRESS_STORAGE_KEY, progress: original },
  );
  await page.goto("/progress");
  const insights = page.getByRole("region", {
    name: "詳しい学習記録",
    exact: true,
  });
  await expect(insights).toBeVisible();
  const weak = insights.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "もう一度確かめたいこと",
      exact: true,
    }),
  });
  await expect(weak).toContainText("基本動詞");
  await expect(weak).toContainText("115問中、正答率 99%");
  const related = weak.getByRole("link", { name: lesson.title, exact: true });
  await expect(related.first()).toHaveAttribute(
    "href",
    `/lessons/${lesson.id}`,
  );
  await expect(insights.locator(".phase4-week time")).toHaveCount(7);
  await expect(insights.locator(".phase4-week")).toContainText("10/18");
  const latest = insights.getByRole("article").filter({
    has: page.getByRole("heading", { name: "直近の解答", exact: true }),
  });
  await expect(latest).toContainText(fill.prompt);
  await expect(latest).toContainText("要確認");
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoOverflow(page);
  await related.first().click();
  await enterQuiz(page, lesson);
  await answerLesson(page, lesson);
  await completeLesson(page);
  expect(getTotalXp(await storedProgress(page))).toBe(930);
  await page.goto("/progress");
  await expect(weak).toContainText("115問中、正答率 100%");
  await expect(weak).toContainText("いまの記録に誤答はありません");
  await expect(
    weak.getByRole("link", { name: lesson.title, exact: true }),
  ).toHaveCount(0);
});

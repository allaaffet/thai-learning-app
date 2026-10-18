import { expect, test, type Page } from "@playwright/test";
import { lessons } from "../src/data/curriculum";
import { alphabetCharacters as characters } from "../src/data/alphabet";
import type { Lesson } from "../src/lib/content-types";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
} from "../src/lib/progress";

const firstLesson = lessons[0];
const nextLesson = lessons[1];

async function storedProgress(page: Page) {
  const parsed: unknown = await page.evaluate((key) => {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  }, PROGRESS_STORAGE_KEY);
  expect(isLearningProgress(parsed)).toBe(true);
  if (!isLearningProgress(parsed))
    throw new Error("保存された進捗の形式が正しくありません。");
  return parsed;
}

async function enterPractice(page: Page, lesson: Lesson) {
  await expect(
    page.getByRole("heading", { level: 1, name: lesson.title }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "練習に進む", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
}

async function answerQuiz(
  page: Page,
  lesson: Lesson,
  wrongIds = new Set<string>(),
  options: { reviewViaStage?: boolean } = {},
) {
  for (const [index, exercise] of lesson.exercises.entries()) {
    const chooseWrong = wrongIds.has(exercise.id);
    const option = exercise.options.find((item) =>
      chooseWrong
        ? item.id !== exercise.answerId
        : item.id === exercise.answerId,
    );
    if (!option) throw new Error(`選択肢が見つかりません: ${exercise.id}`);
    await page.getByRole("radio", { name: option.label, exact: true }).click();
    await page.getByRole("button", { name: "答えを確認", exact: true }).click();
    const feedback = page
      .getByRole("status")
      .filter({ hasText: exercise.explanation });
    await expect(feedback).toContainText(chooseWrong ? "不正解" : "正解");
    await expect(feedback).toContainText(exercise.explanation);
    for (const answerOption of exercise.options) {
      await expect(
        page.getByRole("radio", { name: answerOption.label, exact: true }),
      ).toBeDisabled();
    }
    const isLastQuestion = index === lesson.exercises.length - 1;
    await page
      .getByRole("button", {
        name: isLastQuestion
          ? options.reviewViaStage
            ? "振り返る"
            : "結果を見る"
          : "次の問題へ",
        exact: true,
      })
      .click();
    if (!isLastQuestion) {
      await expect(
        page.getByRole("heading", {
          name: lesson.exercises[index + 1].prompt,
          exact: true,
        }),
      ).toBeFocused();
    }
  }
}

async function finishPassedLesson(page: Page) {
  await page
    .getByRole("button", { name: "レッスンを完了する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "レッスン完了！", exact: true }),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("解説・確認・誤答の理由・80%合格から次のレッスンへ進み、リロード後も記録が残る", async ({
  page,
}) => {
  test.setTimeout(60_000);
  expect(firstLesson.exercises).toHaveLength(5);
  await page.goto("/");
  await page.getByRole("link", { name: "学習をはじめる", exact: true }).click();
  await enterPractice(page, firstLesson);
  await answerQuiz(page, firstLesson, new Set([firstLesson.exercises[0].id]));
  const mistakenExercise = firstLesson.exercises[0];
  const mistakes = page.locator("details").filter({
    hasText: "まちがえた1問を、もう一度確かめる",
  });
  await mistakes
    .locator("summary")
    .filter({ hasText: "まちがえた1問を、もう一度確かめる" })
    .click();
  await expect(
    mistakes.getByText(mistakenExercise.explanation, { exact: true }),
  ).toBeVisible();
  await expect(
    mistakes.getByText(
      `関連する学習事項：${mistakenExercise.relatedConcepts.join("・")}`,
      { exact: true },
    ),
  ).toBeVisible();
  await finishPassedLesson(page);

  const saved = await storedProgress(page);
  expect(saved.lessons[firstLesson.id]).toMatchObject({
    bestScore: 80,
    attemptCount: 1,
    xpAwarded: firstLesson.xp,
  });
  expect(saved.lessons[firstLesson.id].completedAt).toBeTruthy();
  expect(saved.attempts).toHaveLength(5);
  expect(saved.studyDays).toHaveLength(1);
  expect(getTotalXp(saved)).toBe(firstLesson.xp);
  await expect(
    page.getByRole("link", { name: "次のレッスンへ", exact: true }),
  ).toHaveAttribute("href", `/lessons/${nextLesson.id}`);
  await page.getByRole("link", { name: "次のレッスンへ", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: nextLesson.title }),
  ).toBeVisible();
  await page.reload();
  expect(getTotalXp(await storedProgress(page))).toBe(firstLesson.xp);

  await page.goto("/roadmap");
  await expect(page.getByTestId(`lesson-card-${firstLesson.id}`)).toContainText(
    "完了",
  );
  await expect(
    page.getByRole("link", { name: nextLesson.title, exact: true }),
  ).toBeVisible();
});

test("不合格ではXPと次レッスンを解放せず、理由を確認して再挑戦できる", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterPractice(page, firstLesson);
  await answerQuiz(
    page,
    firstLesson,
    new Set(firstLesson.exercises.map((exercise) => exercise.id)),
  );
  await expect(
    page.getByRole("button", { name: "レッスンを完了する", exact: true }),
  ).toHaveCount(0);
  const failed = await storedProgress(page);
  expect(getTotalXp(failed)).toBe(0);
  expect(failed.lessons[firstLesson.id]).toMatchObject({
    bestScore: 0,
    attemptCount: 1,
    xpAwarded: 0,
  });
  expect(failed.lessons[firstLesson.id].completedAt).toBeUndefined();

  const lockedPage = await context.newPage();
  await lockedPage.goto(`/lessons/${nextLesson.id}`);
  await expect(lockedPage.getByText(/前提レッスン/).first()).toBeVisible();
  await expect(
    lockedPage.getByRole("button", { name: "練習に進む", exact: true }),
  ).toHaveCount(0);
  await lockedPage.close();

  await page
    .getByRole("button", { name: "もう一度練習する", exact: true })
    .click();
  await answerQuiz(page, firstLesson);
  await finishPassedLesson(page);
  const retried = await storedProgress(page);
  expect(retried.lessons[firstLesson.id]).toMatchObject({
    bestScore: 100,
    attemptCount: 2,
    xpAwarded: firstLesson.xp,
  });
  expect(retried.attempts).toHaveLength(firstLesson.exercises.length * 2);
});

test("完了済みレッスンを再受講してもXPが重複しない", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterPractice(page, firstLesson);
  await answerQuiz(page, firstLesson);
  await finishPassedLesson(page);
  const completedAt = (await storedProgress(page)).lessons[firstLesson.id]
    .completedAt;

  await page.goto("/roadmap");
  await page
    .getByRole("link", { name: firstLesson.title, exact: true })
    .click();
  await enterPractice(page, firstLesson);
  await answerQuiz(page, firstLesson);
  await finishPassedLesson(page);
  const repeated = await storedProgress(page);
  expect(getTotalXp(repeated)).toBe(firstLesson.xp);
  expect(repeated.lessons[firstLesson.id]).toMatchObject({
    completedAt,
    attemptCount: 2,
    bestScore: 100,
  });
});

test("最後の問題から上部の振り返るへ移動しても、不合格の受講回を一度だけ記録する", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterPractice(page, firstLesson);
  await answerQuiz(
    page,
    firstLesson,
    new Set(firstLesson.exercises.map((exercise) => exercise.id)),
    { reviewViaStage: true },
  );
  await expect(
    page.getByRole("button", { name: "もう一度練習する", exact: true }),
  ).toBeVisible();
  const failed = await storedProgress(page);
  expect(getTotalXp(failed)).toBe(0);
  expect(failed.lessons[firstLesson.id]).toMatchObject({
    attemptCount: 1,
    bestScore: 0,
    xpAwarded: 0,
  });
  expect(failed.lessons[firstLesson.id].completedAt).toBeUndefined();
  expect(failed.attempts).toHaveLength(firstLesson.exercises.length);

  await page.getByRole("button", { name: "練習する", exact: true }).click();
  await page.getByRole("button", { name: "振り返る", exact: true }).click();
  expect(
    (await storedProgress(page)).lessons[firstLesson.id].attemptCount,
  ).toBe(1);
});

test("同時に始めた別タブで完了しても、先に進めたレッスンの保存記録を失わない", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto(`/lessons/${firstLesson.id}`);
  await enterPractice(page, firstLesson);
  const olderTab = await context.newPage();
  await olderTab.goto(`/lessons/${firstLesson.id}`);
  await enterPractice(olderTab, firstLesson);

  await answerQuiz(page, firstLesson);
  await finishPassedLesson(page);
  await page.getByRole("link", { name: "次のレッスンへ", exact: true }).click();
  await enterPractice(page, nextLesson);
  await answerQuiz(page, nextLesson);
  await finishPassedLesson(page);

  await answerQuiz(olderTab, firstLesson);
  await finishPassedLesson(olderTab);
  const saved = await storedProgress(olderTab);
  expect(saved.lessons[firstLesson.id]).toMatchObject({
    attemptCount: 2,
    xpAwarded: firstLesson.xp,
  });
  expect(saved.lessons[nextLesson.id]).toMatchObject({
    attemptCount: 1,
    xpAwarded: nextLesson.xp,
  });
  expect(saved.lessons[nextLesson.id].completedAt).toBeTruthy();
  expect(getTotalXp(saved)).toBe(firstLesson.xp + nextLesson.xp);
  expect(saved.attempts).toHaveLength(
    firstLesson.exercises.length * 2 + nextLesson.exercises.length,
  );
  await olderTab.close();
});

test("第1章の6レッスンを順番に学習して全問正解で完了できる", async ({
  page,
}) => {
  test.setTimeout(90_000);
  expect(lessons).toHaveLength(6);
  await page.goto(`/lessons/${firstLesson.id}`);
  for (const [index, lesson] of lessons.entries()) {
    await enterPractice(page, lesson);
    await answerQuiz(page, lesson);
    await finishPassedLesson(page);
    if (index < lessons.length - 1) {
      const nextLink = page.getByRole("link", {
        name: "次のレッスンへ",
        exact: true,
      });
      await expect(nextLink).toHaveAttribute(
        "href",
        `/lessons/${lessons[index + 1].id}`,
      );
      await nextLink.click();
    } else {
      await expect(
        page.getByRole("link", { name: "次のレッスンへ", exact: true }),
      ).toHaveAttribute("href", "/lessons/mid-consonants");
      await page.goto("/roadmap");
    }
  }
  await expect(page).toHaveURL(/\/roadmap$/);
  const saved = await storedProgress(page);
  expect(getTotalXp(saved)).toBe(
    lessons.reduce((total, lesson) => total + lesson.xp, 0),
  );
  expect(saved.attempts).toHaveLength(
    lessons.reduce((total, lesson) => total + lesson.exercises.length, 0),
  );
  for (const lesson of lessons) {
    expect(saved.lessons[lesson.id]).toMatchObject({
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: lesson.xp,
    });
    expect(saved.lessons[lesson.id].completedAt).toBeTruthy();
    await expect(page.getByTestId(`lesson-card-${lesson.id}`)).toContainText(
      "完了",
    );
  }
});

test("文字ライブラリ・結合文字・絞り込み・キーボードと各画面の表示を確認する", async ({
  page,
}, testInfo) => {
  await page.goto("/characters");
  await expect(page.getByRole("button", { name: /の詳細$/ })).toHaveCount(44);
  await expect(page.locator("#character-detail-heading")).toHaveText(
    characters[0].name,
  );
  await page.evaluate(() => document.fonts.ready);
  const typography = await page
    .locator("#character-detail-heading")
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        family: style.fontFamily,
        lineHeight: parseFloat(style.lineHeight),
        fontSize: parseFloat(style.fontSize),
      };
    });
  expect(typography.family).toContain("Noto Sans Thai");
  expect(typography.lineHeight).toBeGreaterThanOrEqual(
    typography.fontSize * 1.4,
  );

  const highFilter = page.getByRole("button", { name: "高子音", exact: true });
  await highFilter.focus();
  await page.keyboard.press("Enter");
  await expect(highFilter).toHaveAttribute("aria-pressed", "true");
  const highCharacters = characters.filter(
    (character) => character.consonantClass === "high",
  );
  await expect(page.getByRole("button", { name: /の詳細$/ })).toHaveCount(
    highCharacters.length,
  );
  await expect(page.locator("#character-detail-heading")).toHaveText(
    highCharacters[0].name,
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("characters.png"),
    fullPage: true,
  });

  for (const route of [
    "/",
    "/roadmap",
    "/progress",
    `/lessons/${firstLesson.id}`,
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (route === "/")
      await page.screenshot({
        path: testInfo.outputPath("dashboard.png"),
        fullPage: true,
      });
  }

  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const practice = page.getByRole("button", {
    name: "練習に進む",
    exact: true,
  });
  await practice.focus();
  await page.keyboard.press("Enter");
  const exercise = firstLesson.exercises[0];
  const answer = exercise.options.find(
    (option) => option.id === exercise.answerId,
  );
  if (!answer) throw new Error("正答の選択肢がありません。");
  await page.getByRole("radio", { name: answer.label, exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "答えを確認", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: exercise.explanation }),
  ).toContainText("正解");
  await expectNoHorizontalOverflow(page);
});

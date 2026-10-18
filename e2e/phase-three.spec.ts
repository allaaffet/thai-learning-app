import { expect, test, type Page } from "@playwright/test";
import { courseChapters, courseLessons } from "../src/data/course";
import { lessons as chapterOneLessons } from "../src/data/curriculum";
import { phaseTwoLessons } from "../src/data/phase-two";
import { phaseThreeLessons } from "../src/data/phase-three";
import type { Lesson } from "../src/lib/content-types";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";

const priorLessons = [...chapterOneLessons, ...phaseTwoLessons];

function completedPriorCourse(): LearningProgress {
  const timestamp = "2026-10-18T01:00:00.000Z";
  return {
    version: 1,
    lessons: Object.fromEntries(
      priorLessons.map((lesson) => [
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
    attempts: priorLessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        lessonId: lesson.id,
        selectedOptionId: exercise.answerId,
        correct: true,
        attemptedAt: timestamp,
      })),
    ),
    studyDays: ["2026-10-18"],
  };
}

async function storedProgress(page: Page): Promise<LearningProgress> {
  const parsed: unknown = await page.evaluate((key) => {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  }, PROGRESS_STORAGE_KEY);
  expect(isLearningProgress(parsed)).toBe(true);
  if (!isLearningProgress(parsed))
    throw new Error("保存された進捗の形式が正しくありません。");
  return parsed;
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

async function completePerfectLesson(
  page: Page,
  lesson: Lesson,
  useKeyboard = false,
) {
  await expect(
    page.getByRole("heading", { level: 1, name: lesson.title, exact: true }),
  ).toBeVisible();
  const chapter = courseChapters.find((item) => item.id === lesson.chapterId);
  if (!chapter) throw new Error(`章が見つかりません: ${lesson.chapterId}`);
  await expect(page.locator(".lesson-heading .eyebrow")).toContainText(
    `CHAPTER ${String(chapter.number).padStart(2, "0")}`,
  );
  await expect(
    page.getByRole("heading", { name: lesson.blocks[0].title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await expect(page.locator("#explore-detail [lang=th]").first()).toHaveText(
    lesson.explore[0].thai,
  );
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();

  for (const [index, exercise] of lesson.exercises.entries()) {
    const prompt = page.getByRole("heading", {
      name: exercise.prompt,
      exact: true,
    });
    await expect(prompt).toBeVisible();
    await expect(prompt).toBeFocused();
    const answerIndex = exercise.options.findIndex(
      (option) => option.id === exercise.answerId,
    );
    const answer = exercise.options[answerIndex];
    if (!answer) throw new Error(`正答がありません: ${exercise.id}`);
    const correctRadio = page.getByRole("radio", {
      name: answer.label,
      exact: true,
    });
    if (useKeyboard && index === 0) {
      await page.getByRole("radio").first().focus();
      await page.keyboard.press("Home");
      for (let option = 0; option < answerIndex; option += 1)
        await page.keyboard.press("ArrowRight");
      await expect(correctRadio).toBeFocused();
      await expect(correctRadio).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "答えを確認", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
    } else {
      await correctRadio.click();
      await page
        .getByRole("button", { name: "答えを確認", exact: true })
        .click();
    }
    const feedback = page
      .getByRole("status")
      .filter({ hasText: exercise.explanation });
    await expect(feedback).toContainText("正解");
    await expect(feedback).toContainText(exercise.explanation);
    await expect(correctRadio).toBeDisabled();
    await page
      .getByRole("button", {
        name:
          index === lesson.exercises.length - 1 ? "結果を見る" : "次の問題へ",
        exact: true,
      })
      .click();
  }

  await page
    .getByRole("button", { name: "レッスンを完了する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "レッスン完了！", exact: true }),
  ).toBeVisible();
}

test("既存14レッスンの記録を保ち、発音・声調の追加8レッスンを完了して890XPを保存する", async ({
  page,
}) => {
  test.setTimeout(150_000);
  expect(priorLessons).toHaveLength(14);
  expect(phaseThreeLessons).toHaveLength(8);
  expect(courseLessons).toHaveLength(30);
  const originalProgress = completedPriorCourse();
  expect(isLearningProgress(originalProgress)).toBe(true);
  expect(originalProgress.attempts).toHaveLength(70);
  expect(getTotalXp(originalProgress)).toBe(570);
  expect(
    phaseThreeLessons.reduce((total, lesson) => total + lesson.xp, 0),
  ).toBe(320);
  await page.addInitScript(
    ({ key, progress }) => {
      if (window.localStorage.getItem(key) === null)
        window.localStorage.setItem(key, JSON.stringify(progress));
    },
    { key: PROGRESS_STORAGE_KEY, progress: originalProgress },
  );
  await page.goto("/roadmap");
  await page
    .getByRole("link", { name: phaseThreeLessons[0].title, exact: true })
    .click();

  let expectedXp = 570;
  for (const [index, lesson] of phaseThreeLessons.entries()) {
    await completePerfectLesson(page, lesson, index === 0);
    expectedXp += lesson.xp;
    const saved = await storedProgress(page);
    expect(getTotalXp(saved)).toBe(expectedXp);
    expect(saved.lessons[lesson.id]).toMatchObject({
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: lesson.xp,
    });
    expect(saved.lessons[lesson.id].completedAt).toBeTruthy();
    if (index < phaseThreeLessons.length - 1) {
      const nextLink = page.getByRole("link", {
        name: "次のレッスンへ",
        exact: true,
      });
      await expect(nextLink).toHaveAttribute(
        "href",
        `/lessons/${phaseThreeLessons[index + 1].id}`,
      );
      await nextLink.click();
    } else {
      await expect(
        page.getByRole("link", { name: "次のレッスンへ", exact: true }),
      ).toHaveAttribute("href", `/lessons/${courseLessons[22].id}`);
      await page.goto("/roadmap");
    }
  }

  await expect(page).toHaveURL(/\/roadmap$/);
  await page.reload();
  const restored = await storedProgress(page);
  expect(getTotalXp(restored)).toBe(890);
  expect(Object.keys(restored.lessons)).toHaveLength(22);
  expect(restored.attempts).toHaveLength(110);
  expect(restored.attempts.slice(0, originalProgress.attempts.length)).toEqual(
    originalProgress.attempts,
  );
  for (const lesson of priorLessons)
    expect(restored.lessons[lesson.id]).toEqual(
      originalProgress.lessons[lesson.id],
    );
  for (const lesson of [...priorLessons, ...phaseThreeLessons])
    await expect(page.getByTestId(`lesson-card-${lesson.id}`)).toContainText(
      "完了",
    );
  await expectNoHorizontalOverflow(page);
});

test("新しい声調レッスンも前提レッスンの完了が必要で、URLから解放を迂回できない", async ({
  page,
}) => {
  await page.goto(`/lessons/${phaseThreeLessons[0].id}`);
  await expect(
    page.getByRole("heading", {
      name: "まずは、前提レッスンから。",
      exact: true,
    }),
  ).toBeVisible();
  const prerequisite = priorLessons.find(
    (lesson) => lesson.id === phaseThreeLessons[0].prerequisites[0],
  );
  if (!prerequisite) throw new Error("Phase 3の前提レッスンがありません。");
  await expect(
    page.getByRole("link", { name: prerequisite.title, exact: true }),
  ).toHaveAttribute("href", `/lessons/${prerequisite.id}`);
  await expect(
    page.getByRole("button", { name: "文字と音を確認する", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
  await expectNoHorizontalOverflow(page);
});

test("登録語の音節と先行子音を確認でき、未知語の発音を推測しない", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pronunciation");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "声調を、仕組みから。",
      exact: true,
    }),
  ).toBeVisible();
  const words = page.getByRole("combobox", { name: "単語を選ぶ", exact: true });
  const result = page.getByRole("region", {
    name: "音節の解析結果",
    exact: true,
  });
  const shownWord = result.locator(".pronunciation-word [lang=th]");
  await expect(words).toHaveValue("ka-crow");
  await expect(shownWord).toHaveText("กา");
  await expect(result.locator(".pronunciation-ipa")).toHaveText("/kaː˧/");
  await expectNoHorizontalOverflow(page);

  await words.selectOption("ma-dog");
  await expect(shownWord).toHaveText("หมา");
  await expect(result.locator(".pronunciation-ipa")).toHaveText("/maː˩˩˦/");
  await expect(result).toContainText("ห นำ");
  await expect(result).toContainText("高子音");
  await expect(result).toContainText("上昇調");
  await expect(
    result.getByRole("list", { name: "判定の理由", exact: true }),
  ).toBeVisible();

  const fontSwitch = page.getByRole("switch", {
    name: "ループなしのタイ語フォント",
    exact: true,
  });
  await fontSwitch.focus();
  await page.keyboard.press("Space");
  await expect(fontSwitch).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  await expect
    .poll(() =>
      shownWord.evaluate((node) =>
        window
          .getComputedStyle(node)
          .fontFamily.split(",")[0]
          .replace(/["']/g, "")
          .trim(),
      ),
    )
    .toBe("Noto Sans Thai Variable");
  await expect(shownWord).toHaveText("หมา");
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("pronunciation-lab.png"),
    fullPage: true,
  });

  const query = page.getByRole("searchbox", {
    name: "タイ語の語を確認",
    exact: true,
  });
  await query.fill("กขคงจฉชซฌ");
  await query.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "この語はまだ解析できません" }),
  ).toBeVisible();
  await expect(result).toHaveCount(0);
  await expect(page.locator(".pronunciation-search-unknown")).toContainText(
    "発音や声調を推測して表示しません",
  );

  await words.selectOption("ka-crow");
  await expect(query).toHaveValue("");
  await expect(shownWord).toHaveText("กา");
  await query.fill("กิน");
  await page.getByRole("button", { name: "読み方を確認", exact: true }).click();
  await expect(shownWord).toHaveText("กิน");
  await expect(result.locator(".pronunciation-ipa")).toHaveText("/kin˧/");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page);
});

test("5声調の模式図と条件変更で規則を比較し、対応外の条件は判定しない", async ({
  page,
}) => {
  await page.goto("/pronunciation");
  const comparison = page.getByRole("region", {
    name: "5つの、高さの動き",
    exact: true,
  });
  for (const [label, ipa] of [
    ["中平調", "˧"],
    ["低調", "˨˩"],
    ["下降調", "˥˩"],
    ["高調", "˦˥"],
    ["上昇調", "˩˩˦"],
  ]) {
    const tone = comparison.getByRole("button", {
      name: `${label}を表示`,
      exact: true,
    });
    await tone.focus();
    await page.keyboard.press("Enter");
    await expect(tone).toHaveAttribute("aria-pressed", "true");
    const selected = comparison.locator(".pronunciation-selected-tone");
    await expect(
      selected.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await expect(
      selected.locator(".pronunciation-tone-title > span"),
    ).toHaveText(ipa);
    await expect(
      selected.getByRole("img", { name: new RegExp(`${label}の模式図`) }),
    ).toBeVisible();
  }
  await expect(comparison).toContainText(
    "録音の音高を計測したグラフではありません",
  );

  const manual = page.locator("details.pronunciation-manual");
  const expand = manual.locator("summary");
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(manual).toHaveAttribute("open", "");
  const conditions = page.getByRole("region", {
    name: "条件からの判定結果",
    exact: true,
  });
  const consonantClass = page.getByRole("combobox", {
    name: "初頭子音のクラス",
    exact: true,
  });
  const vowelLength = page.getByRole("combobox", {
    name: "母音の長さ",
    exact: true,
  });
  const coda = page.getByRole("combobox", {
    name: "末子音の種類",
    exact: true,
  });
  const mark = page.getByRole("combobox", { name: "声調記号", exact: true });
  const onset = page.getByRole("combobox", {
    name: "初頭子音の扱い",
    exact: true,
  });
  await consonantClass.selectOption("low");
  await vowelLength.selectOption("short");
  await coda.selectOption("stop");
  await expect(
    conditions.getByRole("heading", { name: /^高調/ }),
  ).toBeVisible();
  await expect(conditions).toContainText("死音節");
  await expect(conditions).toContainText("短母音");
  await vowelLength.selectOption("long");
  await expect(
    conditions.getByRole("heading", { name: /^下降調/ }),
  ).toBeVisible();
  await expect(conditions).toContainText("長母音");
  await coda.selectOption("none");
  await onset.selectOption("ho-nam");
  await expect(
    conditions.getByRole("heading", { name: /^上昇調/ }),
  ).toBeVisible();
  await expect(conditions).toContainText("高子音");

  await onset.selectOption("single");
  await consonantClass.selectOption("high");
  await mark.selectOption("mai-tri");
  await expect(
    conditions.getByRole("heading", {
      name: "この条件では判定できません",
      exact: true,
    }),
  ).toBeVisible();
  await expect(conditions).toContainText("中子音");
  await expect(conditions.getByRole("img")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
});

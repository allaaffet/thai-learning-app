import { expect, test, type Locator, type Page } from "@playwright/test";
import { alphabetCharacters, vowelPatterns } from "../src/data/alphabet";
import { courseChapters, courseLessons } from "../src/data/course";
import { phaseTwoLessons } from "../src/data/phase-two";
import type { Lesson } from "../src/lib/content-types";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";

const phaseTwoCourseLessons = courseLessons.filter((lesson) =>
  ["chapter-1", "chapter-2", "chapter-3"].includes(lesson.chapterId),
);

const chapterOneLessons = courseLessons.filter(
  (lesson) => lesson.chapterId === "chapter-1",
);

function completedChapterOne(): LearningProgress {
  const timestamp = "2026-10-18T01:00:00.000Z";
  return {
    version: 1,
    lessons: Object.fromEntries(
      chapterOneLessons.map((lesson) => [
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
    attempts: chapterOneLessons.flatMap((lesson) =>
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

async function completePerfectLesson(page: Page, lesson: Lesson) {
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
  await expect(page.locator("#explore-detail [lang=th]")).toHaveText(
    lesson.explore[0].thai,
  );
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();

  for (const [index, exercise] of lesson.exercises.entries()) {
    await expect(
      page.getByRole("heading", { name: exercise.prompt, exact: true }),
    ).toBeVisible();
    const answer = exercise.options.find(
      (option) => option.id === exercise.answerId,
    );
    if (!answer) throw new Error(`正答がありません: ${exercise.id}`);
    await page.getByRole("radio", { name: answer.label, exact: true }).click();
    await page.getByRole("button", { name: "答えを確認", exact: true }).click();
    const feedback = page
      .getByRole("status")
      .filter({ hasText: exercise.explanation });
    await expect(feedback).toContainText("正解");
    await expect(feedback).toContainText(exercise.explanation);
    await expect(
      page.getByRole("radio", { name: answer.label, exact: true }),
    ).toBeDisabled();
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

test("第1章の保存記録を保ちながら追加8レッスンを学習し、14レッスン・570XPを保持する", async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect(chapterOneLessons).toHaveLength(6);
  expect(phaseTwoLessons).toHaveLength(8);
  expect(phaseTwoCourseLessons).toHaveLength(14);
  const originalProgress = completedChapterOne();
  expect(isLearningProgress(originalProgress)).toBe(true);
  expect(getTotalXp(originalProgress)).toBe(240);
  expect(phaseTwoLessons.reduce((total, lesson) => total + lesson.xp, 0)).toBe(
    330,
  );
  await page.addInitScript(
    ({ key, progress }) => {
      if (window.localStorage.getItem(key) === null)
        window.localStorage.setItem(key, JSON.stringify(progress));
    },
    { key: PROGRESS_STORAGE_KEY, progress: originalProgress },
  );
  await page.goto("/roadmap");
  await page
    .getByRole("link", { name: phaseTwoLessons[0].title, exact: true })
    .click();

  let expectedXp = 240;
  for (const [index, lesson] of phaseTwoLessons.entries()) {
    await completePerfectLesson(page, lesson);
    expectedXp += lesson.xp;
    const saved = await storedProgress(page);
    expect(getTotalXp(saved)).toBe(expectedXp);
    expect(saved.lessons[lesson.id]).toMatchObject({
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: lesson.xp,
    });
    expect(saved.lessons[lesson.id].completedAt).toBeTruthy();

    if (index < phaseTwoLessons.length - 1) {
      const nextLink = page.getByRole("link", {
        name: "次のレッスンへ",
        exact: true,
      });
      await expect(nextLink).toHaveAttribute(
        "href",
        `/lessons/${phaseTwoLessons[index + 1].id}`,
      );
      await nextLink.click();
    } else {
      await expect(
        page.getByRole("link", { name: "次のレッスンへ", exact: true }),
      ).toHaveAttribute("href", "/lessons/syllable-parts");
      await page.goto("/roadmap");
    }
  }

  await expect(page).toHaveURL(/\/roadmap$/);
  await page.reload();
  const restored = await storedProgress(page);
  expect(getTotalXp(restored)).toBe(570);
  expect(Object.keys(restored.lessons)).toHaveLength(14);
  expect(restored.attempts).toHaveLength(
    phaseTwoCourseLessons.reduce(
      (total, lesson) => total + lesson.exercises.length,
      0,
    ),
  );
  expect(restored.attempts.slice(0, originalProgress.attempts.length)).toEqual(
    originalProgress.attempts,
  );
  for (const lesson of chapterOneLessons)
    expect(restored.lessons[lesson.id]).toEqual(
      originalProgress.lessons[lesson.id],
    );
  for (const lesson of phaseTwoCourseLessons)
    await expect(page.getByTestId(`lesson-card-${lesson.id}`)).toContainText(
      "完了",
    );
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("44子音と32母音を検索・絞り込み、母音の長短を比べられる", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/characters");
  await expect(page.locator(".alphabet-tile")).toHaveCount(44);
  await expect(page.locator(".obsolete-label")).toHaveCount(2);
  await expect(page.locator("#character-detail-heading")).toHaveText(
    alphabetCharacters[0].name,
  );
  await expectNoHorizontalOverflow(page);

  for (const [consonantClass, label, count] of [
    ["mid", "中子音", 9],
    ["high", "高子音", 11],
    ["low", "低子音", 24],
  ] as const) {
    const filter = page.getByRole("button", { name: label, exact: true });
    await filter.focus();
    await page.keyboard.press("Enter");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".alphabet-tile")).toHaveCount(count);
    const firstInClass = alphabetCharacters.find(
      (character) => character.consonantClass === consonantClass,
    );
    if (!firstInClass) throw new Error(`子音クラスがありません: ${label}`);
    await expect(page.locator("#character-detail-heading")).toHaveText(
      firstInClass.name,
    );
  }
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  const search = page.getByRole("searchbox", {
    name: "文字・名前・意味を検索",
  });
  await search.fill("ฃ");
  await expect(page.locator(".alphabet-tile")).toHaveCount(1);
  await expect(page.locator("#character-detail")).toContainText(
    "現在は通常使わない文字",
  );
  await search.fill("フクロウ");
  await expect(page.locator(".alphabet-tile")).toHaveCount(1);
  const owl = alphabetCharacters.find(
    (character) => character.id === "ho-nokhuk",
  );
  if (!owl) throw new Error("ฮの教材がありません。");
  await expect(page.locator("#character-detail-heading")).toHaveText(owl.name);
  await expect(
    page.getByRole("link", { name: "この文字を書いてみる", exact: true }),
  ).toHaveAttribute("href", `/writing?character=${owl.id}`);
  await search.fill("一致しない検索語123");
  await expect(page.locator(".alphabet-tile")).toHaveCount(0);
  await expect(
    page.getByText("一致する文字がありません。", { exact: false }),
  ).toBeVisible();

  const vowels = page.getByRole("button", {
    name: "母音32パターン",
    exact: true,
  });
  await vowels.focus();
  await page.keyboard.press("Space");
  await expect(vowels).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("");
  await expect(page.locator(".alphabet-tile")).toHaveCount(32);
  for (const [length, label] of [
    ["short", "短母音"],
    ["long", "長母音"],
    ["special", "特殊・変化形"],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".alphabet-tile")).toHaveCount(
      vowelPatterns.filter((vowel) => vowel.length === length).length,
    );
  }
  await page.getByRole("button", { name: "短母音", exact: true }).click();
  const shortA = vowelPatterns.find((vowel) => vowel.id === "a-short");
  const longA = vowelPatterns.find((vowel) => vowel.id === shortA?.pairId);
  if (!shortA || !longA) throw new Error("/a/の長短ペアがありません。");
  await page
    .getByRole("button", {
      name: `${shortA.pattern}、短母音の詳細`,
      exact: true,
    })
    .click();
  await expect(page.locator("#vowel-detail-heading")).toHaveText(
    shortA.pattern,
  );
  await page.getByRole("button", { name: /^長短の対を見る/ }).click();
  await expect(page.locator("#vowel-detail-heading")).toHaveText(longA.pattern);
  await expect(
    page.getByRole("button", { name: "すべて", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await search.fill("ดู");
  await expect(page.locator(".alphabet-tile")).toHaveCount(1);
  await expect(page.locator("#vowel-detail-heading")).toHaveText("-ู");
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("vowel-library.png"),
    fullPage: true,
  });
  const writeExample = page.getByRole("link", {
    name: "この用例を書いてみる",
    exact: true,
  });
  await expect(writeExample).toHaveAttribute("href", "/writing?vowel=uu-long");
  await writeExample.click();
  await expect(
    page.getByRole("combobox", { name: "練習する母音の用例" }),
  ).toHaveValue("uu-long");
  await expect(
    page.getByRole("img", { name: /の書き取り領域$/ }).locator("text"),
  ).toHaveText("ดู");
});

async function drawStroke(page: Page, surface: Locator, touch: boolean) {
  await surface.scrollIntoViewIfNeeded();
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error("書き取り領域が見つかりません。");
  const points = [
    { x: bounds.x + bounds.width * 0.25, y: bounds.y + bounds.height * 0.3 },
    { x: bounds.x + bounds.width * 0.4, y: bounds.y + bounds.height * 0.45 },
    { x: bounds.x + bounds.width * 0.7, y: bounds.y + bounds.height * 0.7 },
  ];
  if (touch) {
    const session = await page.context().newCDPSession(page);
    try {
      for (const [index, point] of points.entries())
        await session.send("Input.dispatchTouchEvent", {
          type: index === 0 ? "touchStart" : "touchMove",
          touchPoints: [{ ...point, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(points[0].x, points[0].y);
    await page.mouse.down();
    for (const point of points.slice(1))
      await page.mouse.move(point.x, point.y, { steps: 5 });
    await page.mouse.up();
  }
}

test("マウス・タッチで書き、画面幅変更・取り消し・消去と手本の切替を使える", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/characters");
  await page
    .getByRole("link", { name: "この文字を書いてみる", exact: true })
    .click();
  await expect(page).toHaveURL(/\/writing\?character=ko-kai$/);
  const characterSelect = page.getByRole("combobox", { name: "練習する子音" });
  await expect(characterSelect.locator("option")).toHaveCount(44);
  await expect(characterSelect).toHaveValue("ko-kai");
  const surface = page.getByRole("img", { name: /の書き取り領域$/ });
  const ink = page.getByTestId("handwriting-ink");
  const strokeCount = page
    .getByRole("status")
    .filter({ hasText: "描いた線：" });
  const undo = page.getByRole("button", { name: "1本戻す", exact: true });
  const clear = page.getByRole("button", { name: "すべて消す", exact: true });
  await expect(strokeCount).toContainText("描いた線：0本");
  await expect(undo).toBeDisabled();
  await expect(clear).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await drawStroke(page, surface, mobile);
  await expect(strokeCount).toContainText("描いた線：1本");
  await expect(ink.locator("polyline")).toHaveCount(1);
  const initialPoints = await ink.locator("polyline").getAttribute("points");
  if (!initialPoints) throw new Error("描いた線の座標がありません。");

  const freehand = page.getByRole("button", { name: "手本なし", exact: true });
  await freehand.focus();
  await page.keyboard.press("Enter");
  await expect(freehand).toHaveAttribute("aria-pressed", "true");
  await expect(surface.locator("text")).toHaveCount(0);
  await expect(strokeCount).toContainText("描いた線：1本");
  await page.getByRole("button", { name: "なぞり書き", exact: true }).click();
  await expect(surface.locator("text")).toHaveText("ก");
  await page
    .getByRole("switch", { name: "ループなしのタイ語フォント" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  await expect(surface.locator("text")).toHaveCSS(
    "font-family",
    '"Noto Sans Thai Looped Variable", sans-serif',
  );
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("writing.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: mobile ? 320 : 390, height: 844 });
  await expect(ink.locator("polyline")).toHaveAttribute(
    "points",
    initialPoints,
  );
  await expect(strokeCount).toContainText("描いた線：1本");
  await expectNoHorizontalOverflow(page);
  await drawStroke(page, surface, mobile);
  await expect(strokeCount).toContainText("描いた線：2本");
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(strokeCount).toContainText("描いた線：1本");
  await clear.click();
  await expect(strokeCount).toContainText("描いた線：0本");
  await expect(ink.locator("polyline")).toHaveCount(0);
  await expect(clear).toBeDisabled();
  await drawStroke(page, surface, mobile);
  await expect(strokeCount).toContainText("描いた線：1本");

  await characterSelect.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(characterSelect).toHaveValue(alphabetCharacters[1].id);
  await expect(strokeCount).toContainText("描いた線：0本");
  await expect(ink.locator("polyline")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("writing-narrow.png"),
    fullPage: true,
  });
});

test("出典付きの運筆例だけを再生し、資料のない文字と母音では未確認と示す", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/writing?character=ko-kai");
  const guide = page.getByRole("region", {
    name: "参考の運筆例（専門家監修前）",
  });
  await expect(guide).toBeVisible();
  const reference = guide.getByRole("img");
  const initialLabel = await reference.getAttribute("aria-label");
  const recordedCount = initialLabel?.match(/記録された(\d+)本の線のうち0本/);
  if (!recordedCount) throw new Error("運筆例の記録本数がありません。");
  const count = Number(recordedCount[1]);
  expect(count).toBeGreaterThan(0);
  await expect(guide).toContainText("標準筆順は未検証");
  const sourceLinks = guide.getByRole("link");
  await expect(sourceLinks).toHaveCount(2);
  for (const link of await sourceLinks.all())
    await expect(link).toHaveAttribute("href", /^https:\/\//);

  await guide
    .getByRole("button", { name: "次の1本を表示", exact: true })
    .click();
  await expect(reference).toHaveAttribute("aria-label", /うち1本を表示$/);
  await guide.getByRole("button", { name: "最初に戻す", exact: true }).click();
  await expect(reference).toHaveAttribute("aria-label", /うち0本を表示$/);
  await guide
    .getByRole("button", { name: "運筆例を再生", exact: true })
    .click();
  await expect(
    guide.getByRole("button", { name: "再生中", exact: true }),
  ).toBeDisabled();
  await expect(reference).toHaveAttribute(
    "aria-label",
    `กの参考の運筆例。記録された${count}本の線のうち${count}本を表示`,
    { timeout: Math.max(5_000, count * 1_500) },
  );
  await expect(
    guide.getByRole("button", { name: "運筆例を再生", exact: true }),
  ).toBeEnabled();
  await guide.getByRole("button", { name: "最初に戻す", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await guide
    .getByRole("button", { name: "運筆例を再生", exact: true })
    .click();
  await expect(reference).toHaveAttribute(
    "aria-label",
    `กの参考の運筆例。記録された${count}本の線のうち${count}本を表示`,
  );

  await page
    .getByRole("combobox", { name: "練習する子音" })
    .selectOption("ho-nokhuk");
  await expect(guide).toHaveCount(0);
  await expect(page.getByText(/筆順資料未確認：この文字/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "運筆例を再生", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "母音の用例", exact: true }).click();
  const vowelSelect = page.getByRole("combobox", {
    name: "練習する母音の用例",
  });
  await expect(vowelSelect.locator("option")).toHaveCount(32);
  await vowelSelect.selectOption("ii-long");
  await expect(
    page.getByRole("img", { name: /の書き取り領域$/ }).locator("text"),
  ).toHaveText("ดี");
  await expect(guide).toHaveCount(0);
  await expect(page.getByText(/筆順資料未確認：この文字/)).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
  await expectNoHorizontalOverflow(page);
});

import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  isCharacterTrainingState,
  type CharacterTrainingState,
} from "../src/lib/character-training-progress";
import {
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  REVIEW_STORAGE_KEY,
} from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });

const defaultIds = ["ko-kai", "mo-ma", "no-nu", "ngo-ngu"];
const now = "2026-10-25T09:00:00.000Z";
const earlier = "2026-10-24T09:00:00.000Z";
const setupName = "文字トレーニングの設定";
const quizName = "文字チャレンジ";
type AnswerAction = "correct" | "wrong" | "skip";

async function seedExistingLearning(page: Page, trainingRaw?: string) {
  const lesson = courseLessons[0];
  const progress: LearningProgress = {
    version: 1,
    lessons: {
      [lesson.id]: {
        completedAt: earlier,
        bestScore: 100,
        attemptCount: 1,
        xpAwarded: lesson.xp,
        lastStudiedAt: earlier,
      },
    },
    attempts: lesson.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      lessonId: lesson.id,
      selectedOptionId: exercise.answerId,
      correct: true,
      attemptedAt: earlier,
    })),
    studyDays: ["2026-10-24"],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    earlier,
  );
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ values }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
    },
    {
      values: [
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [REVIEW_STORAGE_KEY, JSON.stringify(review)],
        ...(trainingRaw === undefined
          ? []
          : [[CHARACTER_TRAINING_STORAGE_KEY, trainingRaw]]),
      ],
    },
  );
}

async function oldRecords(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => [key, localStorage.getItem(key)]),
    [PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY],
  );
}

async function trainingRaw(page: Page) {
  return page.evaluate(
    (key) => localStorage.getItem(key),
    CHARACTER_TRAINING_STORAGE_KEY,
  );
}

async function savedTraining(page: Page): Promise<CharacterTrainingState> {
  const raw = await trainingRaw(page);
  const state: unknown = raw ? JSON.parse(raw) : null;
  if (!isCharacterTrainingState(state))
    throw new Error("文字練習の保存データが不正です");
  return state;
}

async function openTraining(page: Page, query = "") {
  await page.goto(`/character-practice${query}`);
  await expect(
    page.getByRole("heading", {
      name: "文字を、楽しく覚えよう。",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "このセットで覚える", exact: true }),
  ).toBeEnabled();
}

async function openCustom(page: Page) {
  const summary = page
    .getByRole("region", { name: setupName, exact: true })
    .locator("summary")
    .filter({ hasText: "44文字からカスタム" });
  if (
    !(await summary.evaluate((node) =>
      node.parentElement?.hasAttribute("open"),
    ))
  )
    await summary.click();
  await expect(
    page.locator('[data-testid^="training-selection-"]'),
  ).toHaveCount(44);
}

async function selectedIds(page: Page) {
  return page
    .locator('[data-testid^="training-selection-"][aria-pressed="true"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        (node.getAttribute("data-testid") ?? "").replace(
          "training-selection-",
          "",
        ),
      ),
    );
}

async function chooseCharacters(page: Page, ids: readonly string[]) {
  await openCustom(page);
  for (const id of await selectedIds(page))
    if (!ids.includes(id))
      await page.getByTestId(`training-selection-${id}`).click();
  for (const id of ids) {
    const picker = page.getByTestId(`training-selection-${id}`);
    if ((await picker.getAttribute("aria-pressed")) !== "true")
      await picker.click();
  }
  expect((await selectedIds(page)).sort()).toEqual([...ids].sort());
}

async function startChallenge(page: Page) {
  await page
    .getByRole("button", { name: "すぐに8問チャレンジ", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: quizName, exact: true }),
  ).toBeVisible();
}

async function answerQuestion(page: Page, action: AnswerAction = "correct") {
  const quiz = page.getByRole("region", { name: quizName, exact: true });
  const targetId = await quiz.getAttribute("data-character-id");
  const kind = await quiz.getAttribute("data-kind");
  const target = alphabetCharacters.find((entry) => entry.id === targetId);
  if (!target || (kind !== "name-to-letter" && kind !== "letter-to-sound"))
    throw new Error("問題の文字・形式を確認できません");
  // 正答は表示中の文字の教材値から選ぶ。セッション生成・採点関数は使わない。
  const correctOptionId =
    kind === "name-to-letter" ? target.id : `ipa:${target.initialIpa}`;
  const radios = quiz.getByRole("radio");
  const optionIds = await radios.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-option-id")),
  );
  expect(optionIds.length).toBeGreaterThanOrEqual(2);
  expect(new Set(optionIds).size).toBe(optionIds.length);
  expect(optionIds).toContain(correctOptionId);
  if (kind === "letter-to-sound")
    expect(optionIds.every((id) => id?.startsWith("ipa:"))).toBe(true);
  if (action === "skip") {
    await quiz.getByRole("button", { name: "わからない", exact: true }).click();
  } else {
    const optionId =
      action === "correct"
        ? correctOptionId
        : optionIds.find((id) => id !== correctOptionId);
    if (!optionId) throw new Error("解答の選択肢がありません");
    const option = quiz.locator(`[data-option-id=${JSON.stringify(optionId)}]`);
    await option.locator("..").click();
    await expect(option).toBeChecked();
    await quiz.getByRole("button", { name: "答えを確認", exact: true }).click();
  }
  const feedback = quiz.getByRole("status");
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(
    kind === "name-to-letter" ? target.name : target.initialIpa,
  );
  await expect(feedback).toContainText(
    action === "correct" ? "そのとおり！" : "ペナルティはありません",
  );
  for (const radio of await radios.all()) await expect(radio).toBeDisabled();
  return { targetId: target.id, kind };
}

async function advanceQuestion(page: Page, index: number) {
  await page
    .getByRole("region", { name: quizName, exact: true })
    .getByRole("button", {
      name: index === 7 ? "結果を見る" : "次の文字へ",
      exact: true,
    })
    .click();
}

async function finishRound(
  page: Page,
  action: AnswerAction = "correct",
  startIndex = 0,
  expectedKind?: string,
) {
  for (let index = startIndex; index < 8; index += 1) {
    const quiz = page.getByRole("region", { name: quizName, exact: true });
    await expect(quiz).toHaveAttribute(
      "data-question-index",
      String(index + 1),
    );
    if (expectedKind)
      await expect(quiz).toHaveAttribute("data-kind", expectedKind);
    await answerQuestion(page, action);
    await advanceQuestion(page, index);
  }
  await expect(
    page.getByRole("heading", {
      name: "8問の文字練習、おつかれさま。",
      exact: true,
    }),
  ).toBeVisible();
}

function answerTotals(state: CharacterTrainingState) {
  return Object.values(state.records).reduce(
    (total, record) => ({
      correct: total.correct + record.correct,
      incorrect: total.incorrect + record.incorrect,
    }),
    { correct: 0, incorrect: 0 },
  );
}

async function dashboardStats(page: Page) {
  await expect(page.getByTestId("experience-xp")).toBeVisible();
  return {
    xp: await page.getByTestId("experience-xp").textContent(),
    quests: await Promise.all(
      ["lesson", "answers", "review"].map((id) =>
        page
          .getByTestId(`quest-${id}`)
          .getByRole("progressbar")
          .getAttribute("aria-valuenow"),
      ),
    ),
  };
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

test("4文字を見て覚え、8問完了だけを保存し、再読込み後もXP・SRS・クエストは変わらない", async ({
  page,
}) => {
  await seedExistingLearning(page);
  await page.goto("/");
  await expect(page.getByTestId("experience-xp")).toContainText(
    `${courseLessons[0].xp} XP`,
  );
  const dashboardBefore = await dashboardStats(page);
  const oldBefore = await oldRecords(page);
  await openTraining(page);
  expect((await selectedIds(page)).sort()).toEqual([...defaultIds].sort());
  expect(await trainingRaw(page)).toBeNull();
  await expect(
    page.getByText("教材のIPA・字母名・語義は未監修", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "このセットで覚える", exact: true })
    .click();
  const learn = page.getByRole("region", {
    name: "文字をおぼえる",
    exact: true,
  });
  for (const id of defaultIds) {
    const character = alphabetCharacters.find((entry) => entry.id === id);
    if (!character) throw new Error("既定文字がありません");
    await learn
      .getByRole("button", { name: `${character.thai} を確認`, exact: true })
      .click();
    await expect(learn).toContainText(character.name);
    await expect(learn).toContainText(character.example.thai);
  }
  await learn
    .getByRole("button", { name: "名前をかくす", exact: true })
    .click();
  await expect(
    learn.getByText("この文字の名前、思い出せる？", { exact: true }),
  ).toBeVisible();
  await learn.getByRole("button", { name: "名前をみる", exact: true }).click();
  expect((await savedTraining(page)).records).toEqual({});
  await learn
    .getByRole("button", { name: "8問チャレンジをはじめる", exact: true })
    .click();
  await answerQuestion(page);
  expect((await savedTraining(page)).sessionsCompleted).toBe(0);
  expect((await savedTraining(page)).records).toEqual({});
  await advanceQuestion(page, 0);
  await finishRound(page, "correct", 1, "name-to-letter");
  const completed = await savedTraining(page);
  expect(completed.sessionsCompleted).toBe(1);
  expect(answerTotals(completed)).toEqual({ correct: 8, incorrect: 0 });
  expect(Object.keys(completed.records).sort()).toEqual([...defaultIds].sort());
  expect(await oldRecords(page)).toEqual(oldBefore);
  await page.reload();
  await expect(
    page.getByRole("region", { name: setupName, exact: true }),
  ).toBeVisible();
  expect(await savedTraining(page)).toEqual(completed);
  expect((await selectedIds(page)).sort()).toEqual([...defaultIds].sort());
  await page.goto("/");
  expect(await dashboardStats(page)).toEqual(dashboardBefore);
  expect(await oldRecords(page)).toEqual(oldBefore);
});

test("最初の誤答を選び直さず、わからない回答も理由を確認して弱点セットで再練習できる", async ({
  page,
}) => {
  await openTraining(page);
  await startChallenge(page);
  const first = await answerQuestion(page, "wrong");
  const quiz = page.getByRole("region", { name: quizName, exact: true });
  await expect(
    quiz.getByRole("button", { name: "答えを確認", exact: true }),
  ).toHaveCount(0);
  await expect(
    quiz.getByRole("button", { name: "わからない", exact: true }),
  ).toHaveCount(0);
  await expect(
    quiz.locator(`[data-option-id=${JSON.stringify(first.targetId)}]`),
  ).not.toBeChecked();
  await expect(quiz.getByRole("status")).toContainText("今回の文字");
  await expect(quiz.getByRole("status")).toContainText("選んだ文字");
  await advanceQuestion(page, 0);
  await finishRound(page, "skip", 1);
  const completed = await savedTraining(page);
  expect(answerTotals(completed)).toEqual({ correct: 0, incorrect: 8 });
  expect(
    Object.values(completed.records).every((record) => !record.lastCorrect),
  ).toBe(true);
  await page
    .getByRole("button", { name: "もう一度の文字で練習", exact: true })
    .click();
  expect((await selectedIds(page)).sort()).toEqual(
    Object.keys(completed.records).sort(),
  );
  await page
    .getByRole("button", { name: "前回まちがえた文字", exact: false })
    .click();
  await startChallenge(page);
  await finishRound(page);
  expect((await savedTraining(page)).sessionsCompleted).toBe(2);
  expect(answerTotals(await savedTraining(page))).toEqual({
    correct: 8,
    incorrect: 8,
  });
  await page
    .getByRole("button", { name: "文字を選び直す", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "前回まちがえた文字", exact: false }),
  ).toBeDisabled();
});

test("44文字のカスタム選択は2〜8字で始められ、既定・見比べセットにも戻せる", async ({
  page,
}) => {
  await openTraining(page);
  await chooseCharacters(page, ["ko-kai"]);
  for (const label of ["このセットで覚える", "すぐに8問チャレンジ"])
    await expect(
      page.getByRole("button", { name: label, exact: true }),
    ).toBeDisabled();
  await chooseCharacters(page, ["ko-kai", "mo-ma"]);
  await expect(
    page.getByRole("button", { name: "すぐに8問チャレンジ", exact: true }),
  ).toBeEnabled();
  const eight = alphabetCharacters.slice(0, 8).map((entry) => entry.id);
  await chooseCharacters(page, eight);
  const ninth = page.getByTestId(
    `training-selection-${alphabetCharacters[8].id}`,
  );
  await expect(ninth).toBeDisabled();
  await expect(ninth).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("training-selection-kho-khuat")).toContainText(
    "廃用字",
  );
  await page
    .getByRole("button", { name: "見比べセット A", exact: true })
    .click();
  expect((await selectedIds(page)).sort()).toEqual(
    ["ko-kai", "tho-thung", "pho-samphao"].sort(),
  );
  await page.getByRole("button", { name: "基本の8文字", exact: true }).click();
  expect(await selectedIds(page)).toHaveLength(8);
  await page
    .getByRole("button", { name: "はじめの4文字", exact: true })
    .click();
  expect((await selectedIds(page)).sort()).toEqual([...defaultIds].sort());
  expect(await trainingRaw(page)).toBeNull();
});

test("同じ初頭音のข・คは音だけで区別させず、ミックスの代替とIPA選択肢の一意性を示す", async ({
  page,
}) => {
  await openTraining(page);
  await chooseCharacters(page, ["kho-khai", "kho-khwai"]);
  await page
    .getByRole("radio", { name: "文字から初頭音", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "すぐに8問チャレンジ", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("region", { name: setupName, exact: true }),
  ).toContainText("一意に作れません");
  await page.getByRole("radio", { name: "ミックス", exact: true }).check();
  await expect(
    page.getByRole("region", { name: setupName, exact: true }),
  ).toContainText("「名前から文字」のみ");
  await startChallenge(page);
  await expect(
    page.getByRole("region", { name: quizName, exact: true }),
  ).toContainText("同音による紛らわしさ");
  await finishRound(page, "correct", 0, "name-to-letter");
  expect(answerTotals(await savedTraining(page))).toEqual({
    correct: 8,
    incorrect: 0,
  });
  await page
    .getByRole("button", { name: "文字を選び直す", exact: true })
    .click();
  await chooseCharacters(page, ["kho-khai", "kho-khwai", "mo-ma"]);
  await page
    .getByRole("radio", { name: "文字から初頭音", exact: true })
    .check();
  await startChallenge(page);
  await finishRound(page, "correct", 0, "letter-to-sound");
  expect(answerTotals(await savedTraining(page))).toEqual({
    correct: 16,
    incorrect: 0,
  });
});

test("文字を指定したURLと不正なURLに対応し、320px幅・字体切替・キーボードで練習できる", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTraining(page, "?focus=pho-samphao");
  expect(await selectedIds(page)).toContain("pho-samphao");
  expect(await trainingRaw(page)).toBeNull();
  await openCustom(page);
  await expectNoOverflow(page);
  const font = page.getByRole("switch", {
    name: "ループなしのタイ語フォント",
    exact: true,
  });
  await font.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  const start = page.getByRole("button", {
    name: "すぐに8問チャレンジ",
    exact: true,
  });
  await start.focus();
  await page.keyboard.press("Enter");
  const quiz = page.getByRole("region", { name: quizName, exact: true });
  await expect(quiz).toBeVisible();
  await expect(quiz.locator('[lang="th"]').first()).toHaveCSS(
    "font-family",
    /Noto Sans Thai Variable/,
  );
  const firstOption = quiz.getByRole("radio").first();
  await firstOption.focus();
  await page.keyboard.press("Space");
  await expect(firstOption).toBeChecked();
  await quiz.getByRole("button", { name: "答えを確認", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(quiz.getByRole("status")).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("character-training-320px.png"),
    fullPage: true,
  });
  const saved = await savedTraining(page);
  expect(saved.sessionsCompleted).toBe(0);
  expect(saved.records).toEqual({});
  await openTraining(page, "?focus=unknown-character");
  expect((await selectedIds(page)).sort()).toEqual(
    [...saved.selectedIds].sort(),
  );
  await expectNoOverflow(page);
  expect(await savedTraining(page)).toEqual(saved);
});

test("不正な保存データは8問練習後も保持し、明示的な復旧操作で今回の記録を保存できる", async ({
  page,
}) => {
  const corrupt = '{"version":99,"records":"unknown"}';
  await seedExistingLearning(page, corrupt);
  await openTraining(page);
  const oldBefore = await oldRecords(page);
  const warning = page
    .getByRole("status")
    .filter({ hasText: "元データを保護" });
  await expect(warning).toBeVisible();
  expect(await trainingRaw(page)).toBe(corrupt);
  await startChallenge(page);
  await finishRound(page);
  expect(await trainingRaw(page)).toBe(corrupt);
  await expect(warning).toContainText("このタブだけで練習");
  expect(await oldRecords(page)).toEqual(oldBefore);
  await page
    .getByRole("button", {
      name: "保存データを初期化して保存する",
      exact: true,
    })
    .click();
  await expect(warning).toHaveCount(0);
  const recovered = await savedTraining(page);
  expect(recovered.sessionsCompleted).toBe(1);
  expect(answerTotals(recovered)).toEqual({ correct: 8, incorrect: 0 });
  await page.reload();
  await expect(
    page.getByRole("region", { name: setupName, exact: true }),
  ).toBeVisible();
  expect(await savedTraining(page)).toEqual(recovered);
  expect(await oldRecords(page)).toEqual(oldBefore);
});

test("保存を拒否されてもタブ内で8問と再練習を続けられ、再読込み後は未保存と分かる", async ({
  page,
}) => {
  await seedExistingLearning(page);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (requestedKey, value) {
      if (requestedKey === key)
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, requestedKey, value);
    };
  }, CHARACTER_TRAINING_STORAGE_KEY);
  await openTraining(page);
  const oldBefore = await oldRecords(page);
  await chooseCharacters(page, ["ko-kai", "mo-ma"]);
  await startChallenge(page);
  const warning = page
    .getByRole("status")
    .filter({ hasText: "文字練習の記録を保存できません" });
  await expect(warning).toContainText("このタブでは続けられます");
  await finishRound(page, "skip");
  expect(await trainingRaw(page)).toBeNull();
  await expect(warning).toBeVisible();
  await page
    .getByRole("button", { name: "もう一度の文字で練習", exact: true })
    .click();
  expect((await selectedIds(page)).sort()).toEqual(["ko-kai", "mo-ma"].sort());
  await expect(
    page.getByRole("button", { name: "前回まちがえた文字", exact: false }),
  ).toBeEnabled();
  await startChallenge(page);
  await finishRound(page);
  await expect(warning).toContainText("閉じると今回の記録が失われます");
  expect(await oldRecords(page)).toEqual(oldBefore);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "このセットで覚える", exact: true }),
  ).toBeEnabled();
  expect((await selectedIds(page)).sort()).toEqual([...defaultIds].sort());
  await expect(
    page.getByRole("button", { name: "前回まちがえた文字", exact: false }),
  ).toBeDisabled();
  expect(await trainingRaw(page)).toBeNull();
  expect(await oldRecords(page)).toEqual(oldBefore);
});

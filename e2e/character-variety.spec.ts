import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import { CHARACTER_TRAINING_PRESETS } from "../src/data/character-training";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
  recordCharacterTrainingSession,
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

const common = alphabetCharacters.filter((entry) => entry.usage === "common");
const recordedIds = common.slice(0, 8).map((entry) => entry.id);
const weakIds = recordedIds.slice(0, 3);
const protectedKeys = [
  CHARACTER_TRAINING_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
];

async function prepare(page: Page) {
  const timestamp = "2026-10-26T09:00:00.000Z";
  const training = recordCharacterTrainingSession(
    createEmptyCharacterTrainingState(),
    {
      id: "variety-existing-round",
      completedAt: timestamp,
      attempts: recordedIds.map((characterId, index) => ({
        characterId,
        correct: index >= 3,
      })),
    },
  );
  const lesson = courseLessons[0];
  const progress: LearningProgress = {
    version: 1,
    lessons: {
      [lesson.id]: {
        completedAt: timestamp,
        lastStudiedAt: timestamp,
        bestScore: 100,
        attemptCount: 1,
        xpAwarded: lesson.xp,
      },
    },
    attempts: [],
    studyDays: [timestamp.slice(0, 10)],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    timestamp,
  );
  await page.addInitScript(
    ({ values }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const writes: string[] = [];
      Object.defineProperty(window, "__varietyWrites", { value: writes });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        writes.push(key);
        return original.call(this, key, value);
      };
    },
    {
      values: [
        [CHARACTER_TRAINING_STORAGE_KEY, JSON.stringify(training)],
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [REVIEW_STORAGE_KEY, JSON.stringify(review)],
      ],
    },
  );
}

async function openTraining(page: Page) {
  await page.goto("/character-practice");
  await expect(
    page.getByRole("button", { name: "新しい組み合わせ", exact: true }),
  ).toBeEnabled();
}

async function selectedIds(page: Page) {
  const glyphs = await page
    .getByRole("region", { name: "練習する文字", exact: true })
    .locator(".ct-selected-letter > span.thai")
    .allTextContents();
  return glyphs.map((glyph) => {
    const entry = alphabetCharacters.find((item) => item.thai === glyph.trim());
    if (!entry) throw new Error("選択された教材の文字を確認できません。");
    return entry.id;
  });
}

async function savedBytes(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    protectedKeys,
  );
}

async function writes(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__varietyWrites");
    if (
      !Array.isArray(value) ||
      !value.every((key: unknown) => typeof key === "string")
    )
      throw new Error("保存操作の検証を開始できません。");
    return value.map(String);
  });
}

async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

function sorted(ids: readonly string[]) {
  return [...ids].sort();
}

test("おまかせで4字・8字を変え、未練習と直近の誤答を優先しても既存記録を変更しない", async ({
  page,
}) => {
  await prepare(page);
  await openTraining(page);
  const before = await savedBytes(page);
  const variety = page.getByRole("region", {
    name: "おまかせの組み合わせ",
    exact: true,
  });
  const generate = variety.getByRole("button", {
    name: "新しい組み合わせ",
    exact: true,
  });
  let previous = await selectedIds(page);
  for (let round = 0; round < 3; round += 1) {
    await generate.click();
    const chosen = await selectedIds(page);
    expect(chosen).toHaveLength(4);
    expect(new Set(chosen).size).toBe(4);
    expect(chosen.every((id) => common.some((entry) => entry.id === id))).toBe(
      true,
    );
    expect(sorted(chosen)).not.toEqual(sorted(previous));
    previous = chosen;
  }
  await variety.getByRole("radio", { name: "8文字", exact: true }).check();
  await variety
    .getByRole("combobox", { name: "おまかせの選び方", exact: true })
    .selectOption("unpracticed");
  await generate.click();
  let chosen = await selectedIds(page);
  expect(chosen).toHaveLength(8);
  expect(chosen.every((id) => !recordedIds.includes(id))).toBe(true);
  await expect(
    page.getByRole("status").filter({ hasText: "8問の練習記録がない8字" }),
  ).toBeVisible();
  await variety
    .getByRole("combobox", { name: "おまかせの選び方", exact: true })
    .selectOption("weak");
  await generate.click();
  chosen = await selectedIds(page);
  expect(chosen).toHaveLength(8);
  expect(weakIds.every((id) => chosen.includes(id))).toBe(true);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "直近にまちがえた3字と、見比べる現用字5字" }),
  ).toBeVisible();
  previous = chosen;
  await generate.click();
  chosen = await selectedIds(page);
  expect(sorted(chosen)).not.toEqual(sorted(previous));
  expect(weakIds.every((id) => chosen.includes(id))).toBe(true);
  expect(chosen.every((id) => common.some((entry) => entry.id === id))).toBe(
    true,
  );
  expect(await savedBytes(page)).toEqual(before);
  expect(await writes(page)).toEqual([]);
});

test("19種類の固定セットを選び分け、廃用字を明示した上で選んだセットのペア練習を始められる", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await prepare(page);
  await openTraining(page);
  const before = await savedBytes(page);
  await page.locator(".ct-more-presets > summary").click();
  expect(CHARACTER_TRAINING_PRESETS).toHaveLength(19);
  const covered = new Set<string>();
  for (const preset of CHARACTER_TRAINING_PRESETS) {
    const button = page.getByRole("button", {
      name: preset.title,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    const chosen = await selectedIds(page);
    expect(sorted(chosen)).toEqual(sorted(preset.characterIds));
    chosen.forEach((id) => covered.add(id));
    await expect(
      page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
    ).toBeEnabled();
  }
  expect(sorted([...covered])).toEqual(
    sorted(alphabetCharacters.map((entry) => entry.id)),
  );
  await expect(
    page.getByRole("button", { name: "廃用字も確認", exact: true }),
  ).toContainText("現在通常使わない廃用字");
  await expect(
    page.getByRole("region", { name: "練習する文字", exact: true }),
  ).toContainText("廃用字");
  const preset = CHARACTER_TRAINING_PRESETS.find(
    (item) => item.id === "sound-kh",
  );
  if (!preset) throw new Error("新しい基本音セットがありません。");
  await page.getByRole("button", { name: preset.title, exact: true }).click();
  await page
    .getByRole("radio", { name: "読み方から文字", exact: true })
    .check();
  await page
    .getByRole("button", { name: "ペアさがしで遊ぶ", exact: true })
    .click();
  const pairs = page.getByRole("region", {
    name: "文字ペアさがし",
    exact: true,
  });
  await expect(pairs).toHaveAttribute("data-game-mode", "name-to-letter");
  const cues = await pairs
    .locator("[data-cue-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-cue-id")),
    );
  expect(sorted(cues.map(String))).toEqual(sorted(preset.characterIds));
  const firstId = preset.characterIds[0];
  await pairs.locator(`[data-cue-id=${JSON.stringify(firstId)}]`).click();
  await pairs.locator(`[data-letter-id=${JSON.stringify(firstId)}]`).click();
  await expect(
    pairs.getByRole("progressbar", {
      name: "この周で見つけたペア",
      exact: true,
    }),
  ).toHaveJSProperty("value", 1);
  expect(await savedBytes(page)).toEqual(before);
  expect(await writes(page)).toEqual([]);
});

test("320px・文字200%でもキーボードで組み合わせと字体を選び、8字のペア練習へ進める", async ({
  page,
}, testInfo) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTraining(page);
  const before = await savedBytes(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const variety = page.getByRole("region", {
    name: "おまかせの組み合わせ",
    exact: true,
  });
  await variety.getByRole("radio", { name: "8文字", exact: true }).focus();
  await page.keyboard.press("Space");
  await variety
    .getByRole("button", { name: "新しい組み合わせ", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const chosen = await selectedIds(page);
  expect(chosen).toHaveLength(8);
  await noOverflow(page);
  const summary = page.locator(".ct-more-presets > summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "廃用字も確認", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
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
  await page
    .getByRole("radio", { name: "読み方から文字", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "ペアさがしで遊ぶ", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const pairs = page.getByRole("region", {
    name: "文字ペアさがし",
    exact: true,
  });
  await expect(pairs).toHaveAttribute("data-game-mode", "name-to-letter");
  await expect(pairs.locator("[data-letter-id]")).toHaveCount(8);
  await noOverflow(page);
  expect(await savedBytes(page)).toEqual(before);
  expect(
    (await writes(page)).every((key) => key === "thai-learning.thai-font.v1"),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("variety-eight-large-text.png"),
    fullPage: true,
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import type { Lesson } from "../src/lib/content-types";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
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
import { SOUND_PREFERENCES_KEY } from "../src/lib/sound-preferences";

test.use({ timezoneId: "Asia/Tokyo" });

const firstLesson = courseLessons[0];
const timestamp = "2026-10-25T09:00:00.000Z";

/** Keep old records present, and observe every write/audio request after seeding. */
async function prepare(page: Page, target = firstLesson, thaiVoice = true) {
  const earlierLessons = courseLessons.slice(0, courseLessons.indexOf(target));
  const progress: LearningProgress = {
    version: 1,
    lessons: Object.fromEntries(
      earlierLessons.map((lesson) => [
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
    attempts: [],
    studyDays: earlierLessons.length ? [timestamp.slice(0, 10)] : [],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    timestamp,
  );
  await page.addInitScript(
    ({ values, thaiVoice }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const probe = {
        writes: [] as string[],
        audioContexts: 0,
        speech: [] as { text: string; lang: string }[],
      };
      Object.defineProperty(window, "__lessonGameProbe", { value: probe });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
        return original.call(this, key, value);
      };
      // These activities should never request a sound effect, even when enabled.
      class AudioContextProbe {
        constructor() {
          probe.audioContexts += 1;
          throw new Error(
            "Unexpected sound effect during optional lesson cards",
          );
        }
      }
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: AudioContextProbe,
      });
      class Utterance {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      class Synthesis extends EventTarget {
        getVoices() {
          if (!thaiVoice) return [];
          return [
            {
              name: "Thai lesson game test voice",
              lang: "th-TH",
              voiceURI: "th-game",
              localService: true,
              default: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          probe.speech.push({ text: utterance.text, lang: utterance.lang });
          utterance.onstart?.();
          utterance.onend?.();
        }
        cancel() {}
      }
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: new Synthesis(),
      });
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
    },
    {
      thaiVoice,
      values: [
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [REVIEW_STORAGE_KEY, JSON.stringify(review)],
        [
          CHARACTER_TRAINING_STORAGE_KEY,
          JSON.stringify(createEmptyCharacterTrainingState()),
        ],
        [
          SOUND_PREFERENCES_KEY,
          JSON.stringify({ version: 1, enabled: true, volume: 0.35 }),
        ],
      ],
    },
  );
}

async function snapshot(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__lessonGameProbe");
    if (typeof value !== "object" || value === null)
      throw new Error("Missing lesson game probe");
    const writes: unknown = Reflect.get(value, "writes");
    const speech: unknown = Reflect.get(value, "speech");
    if (
      !Array.isArray(writes) ||
      !writes.every((item: unknown) => typeof item === "string") ||
      !Array.isArray(speech)
    )
      throw new Error("Invalid lesson game probe");
    return {
      writes: writes.map(String),
      audioContexts: Number(Reflect.get(value, "audioContexts")),
      speech: speech.map((item: unknown) => {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof Reflect.get(item, "text") !== "string" ||
          typeof Reflect.get(item, "lang") !== "string"
        )
          throw new Error("Invalid lesson speech call");
        return {
          text: String(Reflect.get(item, "text")),
          lang: String(Reflect.get(item, "lang")),
        };
      }),
    };
  });
}

async function openExplore(page: Page, lesson: Lesson) {
  await page.goto(`/lessons/${lesson.id}`);
  await expect(
    page.getByRole("region", { name: "発見カード", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const game = page.getByRole("region", { name: "めくって確認", exact: true });
  await expect(game).toBeVisible();
  return game;
}

async function recallItem(game: Locator, lesson: Lesson) {
  const id = await game.getAttribute("data-recall-id");
  const item = lesson.explore.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown recall source: ${id}`);
  return item;
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

test("発見カードは1枚ずつ確認でき、教材全文へ切り替えても学習記録を変えない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto(`/lessons/${firstLesson.id}`);
  const discovery = page.getByRole("region", {
    name: "発見カード",
    exact: true,
  });
  await expect(discovery).toHaveAttribute("data-discovery-view", "cards");
  await expect(discovery.locator(".learning-block")).toHaveCount(1);
  await expect(discovery).toHaveAttribute(
    "data-block-id",
    firstLesson.blocks[0].id,
  );
  const before = await snapshot(page);
  const checked = discovery.getByRole("progressbar", {
    name: "確認したカード",
    exact: true,
  });
  await expect(checked).toHaveJSProperty("value", 0);
  // Reading is optional: the existing course controls are never completion gates.
  await expect(
    page.getByRole("button", { name: "文字と音を確認する", exact: true }),
  ).toBeEnabled();
  await discovery
    .getByRole("button", { name: "このカードをチェック", exact: true })
    .click();
  await expect(checked).toHaveJSProperty("value", 1);
  await expect(
    discovery.getByRole("button", { name: "チェック済み", exact: true }),
  ).toBeDisabled();
  await discovery
    .getByRole("button", { name: "次のカードへ", exact: true })
    .click();
  await expect(discovery).toHaveAttribute(
    "data-block-id",
    firstLesson.blocks[1].id,
  );
  await expect(checked).toHaveJSProperty("value", 1);
  await discovery
    .getByRole("button", { name: "前のカードへ", exact: true })
    .click();
  await expect(
    discovery.getByRole("button", { name: "チェック済み", exact: true }),
  ).toBeDisabled();
  await discovery
    .getByRole("button", { name: "まとめて読む", exact: true })
    .click();
  await expect(discovery.locator(".learning-block")).toHaveCount(
    firstLesson.blocks.length,
  );
  for (const block of firstLesson.blocks) {
    const card = discovery.locator(".learning-block").filter({
      has: page.getByRole("heading", { name: block.title, exact: true }),
    });
    await expect(
      card.getByRole("heading", { name: block.title, exact: true }),
    ).toBeVisible();
    for (const details of await card.locator("details").all())
      await details.locator("summary").click();
    for (const paragraph of block.paragraphs)
      await expect(card.getByText(paragraph, { exact: true })).toBeVisible();
    if (block.callout)
      await expect(
        card.getByText(block.callout, { exact: true }),
      ).toBeVisible();
    for (const example of block.examples ?? []) {
      const exampleCard = card
        .locator(".example-card")
        .filter({ has: page.getByText(example.thai, { exact: true }) });
      await expect(exampleCard.locator(".example-thai")).toHaveText(
        example.thai,
      );
      await expect(exampleCard.locator(".ipa").first()).toHaveText(example.ipa);
      await expect(exampleCard.locator(".meaning")).toHaveText(example.meaning);
    }
  }
  await discovery
    .getByRole("button", { name: "1枚ずつ読む", exact: true })
    .click();
  await expect(discovery.locator(".learning-block")).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
  expect(await probe(page)).toEqual({
    writes: [],
    audioContexts: 0,
    speech: [],
  });
});

test("めくる練習は既存の読み方を表示し、選んだカードだけ1周見直して再開できる", async ({
  page,
}) => {
  await prepare(page);
  const game = await openExplore(page, firstLesson);
  const before = await snapshot(page);
  const firstPassIds = new Set<string>();
  let revisitId = "";
  for (let index = 0; index < firstLesson.explore.length; index += 1) {
    const item = await recallItem(game, firstLesson);
    expect(firstPassIds.has(item.id)).toBe(false);
    firstPassIds.add(item.id);
    await expect(game).toHaveAttribute("data-recall-phase", "first");
    await expect(game).toHaveAttribute("data-card-revealed", "false");
    await expect(game.getByText(item.ipa, { exact: true })).toHaveCount(0);
    await expect(game.getByText(item.meaning, { exact: true })).toHaveCount(0);
    await expect(game.getByText(item.note, { exact: true })).toHaveCount(0);
    await expect(game.locator('[lang="th"]').first()).toHaveText(item.thai);
    expect((await probe(page)).speech).toEqual([]);
    await game
      .getByRole("button", { name: "答えをめくる", exact: true })
      .click();
    await expect(game).toHaveAttribute("data-card-revealed", "true");
    await expect(game.getByText(item.ipa, { exact: true })).toBeVisible();
    await expect(game.getByText(item.meaning, { exact: true })).toBeVisible();
    await expect(game.getByText(item.note, { exact: true })).toBeVisible();
    await expect(
      game.getByRole("progressbar", { name: "めくったカード", exact: true }),
    ).toHaveJSProperty("value", index + 1);
    if (index === 0) {
      revisitId = item.id;
      await game
        .getByRole("button", { name: "もう一度みたい", exact: true })
        .click();
    } else
      await game
        .getByRole("button", { name: "次のカードへ", exact: true })
        .click();
  }
  expect(firstPassIds).toEqual(
    new Set(firstLesson.explore.map((item) => item.id)),
  );
  await expect(game).toHaveAttribute("data-recall-phase", "revisit");
  await expect(game).toHaveAttribute("data-recall-id", revisitId);
  await expect(game).toHaveAttribute("data-card-revealed", "false");
  await game.getByRole("button", { name: "答えをめくる", exact: true }).click();
  await expect(
    game.getByRole("button", { name: "もう一度みたい", exact: true }),
  ).toHaveCount(0);
  await game.getByRole("button", { name: "次のカードへ", exact: true }).click();
  await expect(game).toHaveAttribute("data-recall-phase", "complete");
  await expect(
    game.getByRole("heading", { name: "カードをひと巡り！", exact: true }),
  ).toBeVisible();
  await game
    .getByRole("button", { name: "もう一度めくる", exact: true })
    .click();
  await expect(game).toHaveAttribute("data-recall-phase", "first");
  await expect(game).toHaveAttribute("data-card-revealed", "false");
  await expect(
    game.getByRole("progressbar", { name: "めくったカード", exact: true }),
  ).toHaveJSProperty("value", 0);
  expect(await snapshot(page)).toEqual(before);
  expect(await probe(page)).toEqual({
    writes: [],
    audioContexts: 0,
    speech: [],
  });
});

test("子音・声調・文法の本編でも既存教材をそのままめくり、途中から通常の問題へ進める", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const selectedIds = [
    "mid-consonants",
    "tone-marks",
    "basic-word-order",
    "comparisons-connectors",
  ];
  // Seed all earlier prerequisites once; the optional game must leave these bytes alone.
  const last = courseLessons.find((lesson) => lesson.id === selectedIds.at(-1));
  if (!last) throw new Error("Later lesson missing");
  await prepare(page, last);
  await page.setViewportSize({ width: 320, height: 844 });
  for (const id of selectedIds) {
    const lesson = courseLessons.find((entry) => entry.id === id);
    if (!lesson) throw new Error(`Lesson missing: ${id}`);
    const game = await openExplore(page, lesson);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const before = await snapshot(page);
    const item = await recallItem(game, lesson);
    await game
      .getByRole("button", { name: "答えをめくる", exact: true })
      .click();
    await expect(game.getByText(item.ipa, { exact: true })).toBeVisible();
    await expect(game.getByText(item.meaning, { exact: true })).toBeVisible();
    await expect(game.getByText(item.note, { exact: true })).toBeVisible();
    await expect(page.locator("#explore-detail")).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "言葉を入力・録音する練習",
        exact: true,
      }),
    ).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "練習に進む", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "練習問題", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: lesson.exercises[0].prompt,
        exact: true,
      }),
    ).toBeVisible();
    expect(await snapshot(page)).toEqual(before);
    expect(await probe(page)).toEqual({
      writes: [],
      audioContexts: 0,
      speech: [],
    });
  }
});

test("音声は明示操作で現在のThaiだけを読み、母音の模式表記を読み上げない", async ({
  page,
}) => {
  const vowelLesson = courseLessons.find(
    (lesson) => lesson.id === "vowels-surround",
  );
  if (!vowelLesson) throw new Error("Vowel lesson missing");
  await prepare(page, vowelLesson);
  let game = await openExplore(page, firstLesson);
  const before = await snapshot(page);
  const first = await recallItem(game, firstLesson);
  expect((await probe(page)).speech).toEqual([]);
  const play = game.getByRole("button", { name: "音声でも確認", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  expect((await probe(page)).speech).toEqual([
    { text: first.thai, lang: "th-TH" },
  ]);
  await game.getByRole("button", { name: "答えをめくる", exact: true }).click();
  expect((await probe(page)).speech).toHaveLength(1);
  await game.getByRole("button", { name: "次のカードへ", exact: true }).click();
  const second = await recallItem(game, firstLesson);
  expect(second.id).not.toBe(first.id);
  expect((await probe(page)).speech).toHaveLength(1);
  await game.getByRole("button", { name: "音声でも確認", exact: true }).click();
  expect((await probe(page)).speech).toEqual([
    { text: first.thai, lang: "th-TH" },
    { text: second.thai, lang: "th-TH" },
  ]);
  expect(await snapshot(page)).toEqual(before);
  expect((await probe(page)).writes).toEqual([]);
  expect((await probe(page)).audioContexts).toBe(0);

  game = await openExplore(page, vowelLesson);
  const pattern = await recallItem(game, vowelLesson);
  expect(pattern.thai).toContain("-");
  await expect(
    game.getByRole("button", { name: "音声でも確認", exact: true }),
  ).toHaveCount(0);
  await game.getByRole("button", { name: "答えをめくる", exact: true }).click();
  await expect(game.getByText(pattern.ipa, { exact: true })).toBeVisible();
  expect(await probe(page)).toEqual({
    writes: [],
    audioContexts: 0,
    speech: [],
  });
  expect(await snapshot(page)).toEqual(before);
});

test("タイ語音声がない端末でも320px・文字200%で案内が収まり、めくって学習できる", async ({
  page,
}) => {
  await prepare(page, firstLesson, false);
  await page.setViewportSize({ width: 320, height: 844 });
  for (const fontSize of [16, 32]) {
    await page.goto(`/lessons/${firstLesson.id}`);
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);
    await page
      .getByRole("button", { name: "文字と音を確認する", exact: true })
      .click();
    const game = page.getByRole("region", {
      name: "めくって確認",
      exact: true,
    });
    await expect(game).toBeVisible();
    // The checking message and the longer unavailable message must both stay in the card.
    await noOverflow(page);
    const unavailable = game.getByText(
      "この端末ではタイ語の合成音声を利用できません。端末の音声設定でタイ語を追加するか、対応するブラウザでお試しください。",
      { exact: true },
    );
    await expect(unavailable).toBeVisible();
    await expect(
      game.getByRole("button", { name: "音声でも確認", exact: true }),
    ).toBeDisabled();
    await noOverflow(page);
    const contained = await unavailable.evaluate((element) => {
      const card = element.closest(".lg-recall-card");
      if (!card) throw new Error("The voice notice has no containing card");
      const notice = element.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      return notice.left >= bounds.left && notice.right <= bounds.right;
    });
    expect(contained).toBe(true);
    const before = await snapshot(page);
    const item = await recallItem(game, firstLesson);
    await game
      .getByRole("button", { name: "答えをめくる", exact: true })
      .click();
    await expect(game.getByText(item.ipa, { exact: true })).toBeVisible();
    await expect(game.getByText(item.note, { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "練習に進む", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "練習問題", exact: true }),
    ).toBeVisible();
    expect(await snapshot(page)).toEqual(before);
    expect(await probe(page)).toEqual({
      writes: [],
      audioContexts: 0,
      speech: [],
    });
  }
});

test("320px・文字200%でもキーボードでカードを操作し、動きを減らして学習できる", async ({
  page,
}, testInfo) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/lessons/${firstLesson.id}`);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const discovery = page.getByRole("region", {
    name: "発見カード",
    exact: true,
  });
  const check = discovery.getByRole("button", {
    name: "このカードをチェック",
    exact: true,
  });
  await check.focus();
  await page.keyboard.press("Enter");
  await expect(
    discovery.getByRole("progressbar", { name: "確認したカード", exact: true }),
  ).toHaveJSProperty("value", 1);
  await discovery
    .getByRole("button", { name: "次のカードへ", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(discovery).toHaveAttribute(
    "data-block-id",
    firstLesson.blocks[1].id,
  );
  await noOverflow(page);
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const game = page.getByRole("region", { name: "めくって確認", exact: true });
  await game.getByRole("button", { name: "答えをめくる", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(game).toHaveAttribute("data-card-revealed", "true");
  const item = await recallItem(game, firstLesson);
  await expect(game.getByText(item.note, { exact: true })).toBeVisible();
  await noOverflow(page);
  const animations = await game.evaluate(
    (element) =>
      [element, ...element.querySelectorAll("*")].filter((node) => {
        const style = window.getComputedStyle(node);
        return (
          style.animationName !== "none" &&
          style.animationDuration
            .split(",")
            .some((duration) => parseFloat(duration) > 0.001)
        );
      }).length,
  );
  expect(animations).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("lesson-cards-320-large-text.png"),
    fullPage: true,
  });
  expect(await probe(page)).toEqual({
    writes: [],
    audioContexts: 0,
    speech: [],
  });
});

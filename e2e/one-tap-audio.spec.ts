import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import { syllableEntries } from "../src/data/syllables";
import {
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  REVIEW_STORAGE_KEY,
} from "../src/lib/review";

/** These doubles test user actions and cancellation, not pronunciation quality. */
async function prepare(page: Page, manual = false) {
  const timestamp = "2026-10-30T09:00:00.000Z";
  const progress: LearningProgress = {
    version: 1,
    lessons: Object.fromEntries(
      courseLessons.map((lesson) => [
        lesson.id,
        {
          completedAt: timestamp,
          lastStudiedAt: timestamp,
          bestScore: 100,
          attemptCount: 1,
          xpAwarded: lesson.xp,
        },
      ]),
    ),
    attempts: [],
    studyDays: [timestamp.slice(0, 10)],
  };
  let review = createEmptyReview();
  for (const word of vocabularyEntries.slice(0, 2))
    review = addReviewCard(review, word.id, timestamp);
  await page.clock.setFixedTime(new Date("2026-10-31T09:00:00.000Z"));
  await page.addInitScript(
    ({ manual, progressKey, progress, reviewKey, review }) => {
      if (localStorage.getItem(progressKey) === null)
        localStorage.setItem(progressKey, JSON.stringify(progress));
      if (localStorage.getItem(reviewKey) === null)
        localStorage.setItem(reviewKey, JSON.stringify(review));
      const probe = {
        calls: [] as {
          text: string;
          lang: string;
          active: boolean;
          boundary: boolean;
        }[],
        cancels: 0,
        recognitionStarts: 0,
        recognitionAborts: 0,
        boundary: false,
      };
      const pending: Utterance[] = [];
      Object.defineProperty(window, "__oneTapAudio", {
        value: {
          probe,
          finish(index = pending.length - 1) {
            pending[index]?.onend?.();
          },
        },
      });
      class Utterance {
        lang = "";
        voice: unknown = null;
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
      class Synthesis extends EventTarget {
        getVoices() {
          return [
            {
              name: "One tap Thai voice",
              lang: "th-TH",
              voiceURI: "one-tap-th",
              default: true,
              localService: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          probe.calls.push({
            text: utterance.text,
            lang: utterance.lang,
            active: navigator.userActivation.isActive,
            boundary: probe.boundary,
          });
          pending.push(utterance);
          utterance.onstart?.();
          if (!manual) utterance.onend?.();
        }
        cancel() {
          probe.cancels += 1;
        }
      }
      class Recognition {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        start() {
          probe.recognitionStarts += 1;
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {
          probe.recognitionAborts += 1;
          this.onend?.();
        }
      }
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: new Synthesis(),
      });
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
      Object.defineProperty(window, "SpeechRecognition", {
        configurable: true,
        value: Recognition,
      });
    },
    {
      manual,
      progressKey: PROGRESS_STORAGE_KEY,
      progress,
      reviewKey: REVIEW_STORAGE_KEY,
      review,
    },
  );
}

async function audioState(page: Page) {
  return page.evaluate(() => {
    const control: unknown = Reflect.get(window, "__oneTapAudio");
    if (typeof control !== "object" || control === null)
      throw new Error("Audio probe missing");
    const value: unknown = Reflect.get(control, "probe");
    if (typeof value !== "object" || value === null)
      throw new Error("Audio state missing");
    const calls: unknown = Reflect.get(value, "calls");
    if (!Array.isArray(calls)) throw new Error("Invalid audio calls");
    return {
      calls: calls.map((call: unknown) => {
        if (typeof call !== "object" || call === null)
          throw new Error("Invalid audio call");
        return {
          text: String(Reflect.get(call, "text")),
          lang: String(Reflect.get(call, "lang")),
          active: Reflect.get(call, "active") === true,
          boundary: Reflect.get(call, "boundary") === true,
        };
      }),
      cancels: Number(Reflect.get(value, "cancels")),
      recognitionStarts: Number(Reflect.get(value, "recognitionStarts")),
      recognitionAborts: Number(Reflect.get(value, "recognitionAborts")),
    };
  });
}

async function saved(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    [PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY],
  );
}

test("文字の確認タブを押すだけで字母名を聞け、同じタブも聞き直せる", async ({
  page,
}) => {
  await prepare(page, true);
  await page.goto("/character-practice");
  await page
    .getByRole("button", { name: "このセットで覚える", exact: true })
    .click();
  const learn = page.getByRole("region", {
    name: "文字をおぼえる",
    exact: true,
  });
  await expect(
    learn.getByRole("button", { name: "文字の名前を聞く", exact: true }),
  ).toBeEnabled();
  expect((await audioState(page)).calls).toEqual([]);
  const before = await saved(page);
  const ma = alphabetCharacters.find((entry) => entry.id === "mo-ma")!;
  const ngo = alphabetCharacters.find((entry) => entry.id === "ngo-ngu")!;
  const tab = learn.getByRole("button", {
    name: `${ma.thai} を確認`,
    exact: true,
  });
  await tab.click();
  expect((await audioState(page)).calls).toEqual([
    { text: ma.name, lang: "th-TH", active: true, boundary: false },
  ]);
  // A synchronous click boundary catches deferred effect-based playback even without real TTS.
  await tab.evaluate((element) => {
    const control: unknown = Reflect.get(window, "__oneTapAudio");
    if (typeof control !== "object" || control === null)
      throw new Error("Missing probe");
    const probe: unknown = Reflect.get(control, "probe");
    if (
      typeof probe !== "object" ||
      probe === null ||
      !(element instanceof HTMLElement)
    )
      throw new Error("Missing boundary");
    Reflect.set(probe, "boundary", true);
    try {
      element.click();
    } finally {
      Reflect.set(probe, "boundary", false);
    }
  });
  expect((await audioState(page)).calls.at(-1)).toMatchObject({
    text: ma.name,
    boundary: true,
  });
  const prior = await audioState(page);
  await learn
    .getByRole("button", { name: `${ngo.thai} を確認`, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  expect((await audioState(page)).calls.at(-1)?.text).toBe(ngo.name);
  expect((await audioState(page)).cancels).toBeGreaterThan(prior.cancels);
  const playing = await audioState(page);
  await learn
    .getByRole("button", { name: "8問チャレンジをはじめる", exact: true })
    .click();
  expect((await audioState(page)).calls).toHaveLength(playing.calls.length);
  expect((await audioState(page)).cancels).toBeGreaterThan(playing.cancels);
  expect(await saved(page)).toEqual(before);
});

test("本編の比較カードは押して聞け、音声認識中と母音の模式表記では再生しない", async ({
  page,
}) => {
  await prepare(page);
  const lesson = courseLessons[0];
  await page.goto(`/lessons/${lesson.id}`);
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const detail = page.locator("#explore-detail");
  await expect(
    detail.getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeEnabled();
  expect((await audioState(page)).calls).toEqual([]);
  const before = await saved(page);
  const example = lesson.explore.find((entry) => entry.thai === "กา")!;
  await page
    .getByRole("button", { name: `${example.thai} の説明`, exact: true })
    .click();
  expect((await audioState(page)).calls.at(-1)).toMatchObject({
    text: example.thai,
    lang: "th-TH",
    active: true,
  });
  const practice = page.getByRole("region", {
    name: "言葉を入力・録音する練習",
    exact: true,
  });
  await practice
    .getByRole("button", { name: "声で確かめる", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "音声認識を始める", exact: true })
    .click();
  await expect(
    practice.getByRole("button", { name: "音声認識を取り消す", exact: true }),
  ).toBeVisible();
  const captured = await audioState(page);
  await page.getByRole("button", { name: "มา の説明", exact: true }).click();
  await expect(detail.locator(".lesson-explore-word .thai")).toHaveText("มา");
  expect(await audioState(page)).toEqual(captured);
  await expect(
    practice.getByRole("button", { name: "音声認識を取り消す", exact: true }),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "音声認識を取り消す", exact: true })
    .click();
  const afterStop = (await audioState(page)).calls.length;
  await page.getByRole("button", { name: "มา の説明", exact: true }).click();
  expect((await audioState(page)).calls).toHaveLength(afterStop + 1);
  const vowel = courseLessons.find((entry) => entry.id === "vowels-surround")!;
  await page.goto(`/lessons/${vowel.id}`);
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const count = (await audioState(page)).calls.length;
  for (const entry of vowel.explore.filter((entry) => entry.thai.includes("-")))
    await page
      .getByRole("button", { name: `${entry.thai} の説明`, exact: true })
      .click();
  expect((await audioState(page)).calls).toHaveLength(count);
  expect(await saved(page)).toEqual(before);
});

test("声調ラボは登録語を選んで聞け、曲線・条件・未登録語の操作では読み上げない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/pronunciation");
  const select = page.locator("#syllable-select");
  await expect(
    page
      .locator(".pronunciation-explorer")
      .getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeEnabled();
  expect((await audioState(page)).calls).toEqual([]);
  const selectedId = await select.inputValue();
  const index = syllableEntries.findIndex((entry) => entry.id === selectedId);
  const next = syllableEntries[index + 1];
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await expect(select).toHaveValue(next.id);
  expect((await audioState(page)).calls.at(-1)).toMatchObject({
    text: next.thai,
    lang: "th-TH",
    active: true,
  });
  const count = (await audioState(page)).calls.length;
  await page.getByRole("button", { name: "上昇調を表示", exact: true }).click();
  await page.locator(".pronunciation-manual > summary").click();
  const manualClass = page
    .locator(".pronunciation-manual")
    .getByRole("combobox", { name: "初頭子音のクラス", exact: true });
  await manualClass.selectOption("high");
  await expect(manualClass).toHaveValue("high");
  expect((await audioState(page)).calls).toHaveLength(count);
  await page
    .getByRole("searchbox", { name: "タイ語の語を確認", exact: true })
    .fill("未登録");
  await page.getByRole("button", { name: "読み方を確認", exact: true }).click();
  expect((await audioState(page)).calls).toHaveLength(count);
  const rising = syllableEntries.find(
    (entry) => entry.expectedTone === "rising",
  )!;
  await page.locator(".pronunciation-example-link").click();
  expect((await audioState(page)).calls.at(-1)).toMatchObject({
    text: rising.thai,
    lang: "th-TH",
    active: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await page.locator(".pronunciation-section-heading").scrollIntoViewIfNeeded();
  await expect(page.locator(".pronunciation-section-heading")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("単語の復習は意味を開かず1回で聞け、再生だけでは復習予定を変更しない", async ({
  page,
}) => {
  await prepare(page, true);
  await page.goto("/review");
  await page
    .getByRole("button", { name: "今日の復習をはじめる", exact: true })
    .click();
  const card = page.locator(".review-study");
  const word = await card.locator("#review-card-heading").textContent();
  const entry = vocabularyEntries.find((item) => item.thai === word?.trim())!;
  const before = await saved(page);
  const play = card.getByRole("button", {
    name: "合成音声で確認",
    exact: true,
  });
  await expect(play).toBeEnabled();
  await expect(
    card.getByRole("heading", { name: entry.meaning, exact: true }),
  ).toHaveCount(0);
  expect((await audioState(page)).calls).toEqual([]);
  await play.click();
  expect((await audioState(page)).calls.at(-1)).toMatchObject({
    text: entry.thai,
    lang: "th-TH",
    active: true,
  });
  await expect(
    card.getByRole("heading", { name: entry.meaning, exact: true }),
  ).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await card.getByRole("button", { name: "答えを表示", exact: true }).click();
  expect((await audioState(page)).calls).toHaveLength(1);
  expect(await saved(page)).toEqual(before);
  const prior = await audioState(page);
  await card.getByRole("button", { name: "思い出せた", exact: true }).click();
  await card.getByRole("button", { name: "次のカード", exact: true }).click();
  expect((await audioState(page)).calls).toHaveLength(1);
  expect((await audioState(page)).cancels).toBeGreaterThan(prior.cancels);
});

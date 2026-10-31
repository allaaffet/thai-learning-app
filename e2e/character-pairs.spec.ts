import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
  isCharacterTrainingState,
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
const pairName = "文字ペアさがし";

async function seedLearningAndWatchWrites(page: Page) {
  const lesson = courseLessons[0];
  const timestamp = "2026-10-24T09:00:00.000Z";
  const progress: LearningProgress = {
    version: 1,
    lessons: {
      [lesson.id]: {
        completedAt: timestamp,
        bestScore: 100,
        attemptCount: 1,
        xpAwarded: lesson.xp,
        lastStudiedAt: timestamp,
      },
    },
    attempts: [],
    studyDays: ["2026-10-24"],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    timestamp,
  );
  await page.clock.setFixedTime(new Date("2026-10-25T09:00:00.000Z"));
  await page.addInitScript(
    ({ values }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const writes: string[] = [];
      Object.defineProperty(window, "__pairStorageWrites", { value: writes });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        writes.push(key);
        return original.call(this, key, value);
      };
    },
    {
      values: [
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [REVIEW_STORAGE_KEY, JSON.stringify(review)],
        [
          CHARACTER_TRAINING_STORAGE_KEY,
          JSON.stringify(createEmptyCharacterTrainingState()),
        ],
      ],
    },
  );
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

async function storageWrites(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__pairStorageWrites");
    if (
      !Array.isArray(value) ||
      !value.every((item: unknown) => typeof item === "string")
    )
      throw new Error("Missing storage write probe");
    return value.map((item: unknown) => String(item));
  });
}

async function savedTraining(page: Page) {
  const state: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, CHARACTER_TRAINING_STORAGE_KEY);
  if (!isCharacterTrainingState(state))
    throw new Error("Invalid character training record");
  return state;
}

async function dashboardStats(page: Page) {
  await expect(page.getByTestId("experience-xp")).toContainText(
    `${courseLessons[0].xp} XP`,
  );
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

async function openTraining(page: Page, mode: "reading" | "audio" = "reading") {
  await page.goto("/character-practice");
  await expect(
    page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("radio", {
      name: mode === "reading" ? "読み方から文字" : "音声から文字",
      exact: true,
    })
    .check();
}

async function chooseCharacters(page: Page, ids: readonly string[]) {
  const summary = page
    .getByRole("region", { name: "文字トレーニングの設定", exact: true })
    .locator("summary")
    .filter({ hasText: "44文字からカスタム" });
  await summary.click();
  const selected = await page
    .locator('[data-testid^="training-selection-"][aria-pressed="true"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        (node.getAttribute("data-testid") ?? "").replace(
          "training-selection-",
          "",
        ),
      ),
    );
  for (const id of selected)
    if (!ids.includes(id))
      await page.getByTestId(`training-selection-${id}`).click();
  for (const id of ids) {
    const button = page.getByTestId(`training-selection-${id}`);
    if ((await button.getAttribute("aria-pressed")) !== "true")
      await button.click();
  }
}

function pairs(page: Page) {
  return page.getByRole("region", { name: pairName, exact: true });
}

function cueButton(page: Page, id: string) {
  return pairs(page).locator(`[data-cue-id=${JSON.stringify(id)}]`);
}

function letterButton(page: Page, id: string) {
  return pairs(page).locator(`[data-letter-id=${JSON.stringify(id)}]`);
}

function pairProgress(page: Page) {
  return pairs(page).getByRole("progressbar", {
    name: "この周で見つけたペア",
    exact: true,
  });
}

async function startPairs(page: Page, mode = "name-to-letter") {
  await page
    .getByRole("button", { name: "ペアさがしで遊ぶ", exact: true })
    .click();
  await expect(pairs(page)).toHaveAttribute("data-game-mode", mode);
  await expect(pairs(page)).toHaveAttribute("data-lap", "1");
  await expect(pairProgress(page)).toHaveJSProperty("value", 0);
}

async function boardOrder(page: Page) {
  return {
    cues: await pairs(page)
      .locator("[data-cue-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-cue-id")),
      ),
    letters: await pairs(page)
      .locator("[data-letter-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-letter-id")),
      ),
  };
}

function character(id: string) {
  const entry = alphabetCharacters.find((item) => item.id === id);
  if (!entry) throw new Error("Missing alphabet character");
  return entry;
}

async function expectReadingCue(page: Page, id: string) {
  const entry = character(id);
  const cue = cueButton(page, id);
  await expect(cue).toContainText(entry.ipa);
  await expect(cue).toContainText(
    entry.unicodeName.replace("THAI CHARACTER ", "").toLowerCase(),
  );
  await expect(cue).not.toContainText(entry.name);
  await expect(cue).not.toContainText(
    entry.meaning.slice(0, entry.meaning.lastIndexOf(`の ${entry.thai}`)),
  );
}

async function matchReading(page: Page, id: string) {
  await expectReadingCue(page, id);
  await cueButton(page, id).click();
  await expect(letterButton(page, id)).toBeEnabled();
  await letterButton(page, id).click();
  await expect(cueButton(page, id)).toBeDisabled();
  await expect(letterButton(page, id)).toBeDisabled();
}

async function finishReadingLap(page: Page, ids: readonly string[]) {
  const order = await boardOrder(page);
  expect([...order.cues].sort()).toEqual([...ids].sort());
  expect([...order.letters].sort()).toEqual([...ids].sort());
  await expect(pairProgress(page)).toHaveJSProperty("max", ids.length);
  let matched = Number(await pairProgress(page).getAttribute("value"));
  for (const id of ids) {
    if (await cueButton(page, id).isDisabled()) continue;
    await matchReading(page, id);
    matched += 1;
    await expect(pairProgress(page)).toHaveJSProperty("value", matched);
  }
  await expect(pairs(page)).toHaveAttribute("data-lap-complete", "true");
}

async function secondLap(page: Page) {
  const first = await boardOrder(page);
  await pairs(page)
    .getByRole("button", { name: "シャッフルしてもう1周", exact: true })
    .click();
  await expect(pairs(page)).toHaveAttribute("data-lap", "2");
  await expect(pairProgress(page)).toHaveJSProperty("value", 0);
  const second = await boardOrder(page);
  expect(second.cues).not.toEqual(first.cues);
  expect(second.letters).not.toEqual(first.letters);
}

async function finishQuiz(page: Page) {
  for (let index = 0; index < 8; index += 1) {
    const quiz = page.getByRole("region", {
      name: "文字チャレンジ",
      exact: true,
    });
    await expect(quiz).toHaveAttribute("data-kind", "name-to-letter");
    await expect(quiz).toHaveAttribute(
      "data-question-index",
      String(index + 1),
    );
    const id = await quiz.getAttribute("data-character-id");
    if (!id) throw new Error("Missing quiz target");
    const entry = character(id);
    await expect(quiz).toContainText(entry.ipa);
    await expect(quiz).not.toContainText(entry.name);
    await quiz
      .locator(`[data-option-id=${JSON.stringify(id)}]`)
      .locator("..")
      .click();
    await quiz.getByRole("button", { name: "答えを確認", exact: true }).click();
    await expect(quiz.locator('.ct-feedback[role="status"]')).toContainText(
      entry.name,
    );
    expect((await savedTraining(page)).sessionsCompleted).toBe(0);
    await quiz
      .getByRole("button", {
        name: index === 7 ? "結果を見る" : "次の文字へ",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", {
      name: "8問の文字練習、おつかれさま。",
      exact: true,
    }),
  ).toBeVisible();
}

// 合成音声の通知を制御するだけで、Thaiの発音や実機の音質は検証しない。
async function installSpeechStub(page: Page, noThai = false, delayed = false) {
  await page.addInitScript(
    ({ noThai, delayed }) => {
      class Utterance {
        text: string;
        lang = "";
        voice: { lang: string } | null = null;
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      const utterances: Utterance[] = [];
      const state = {
        calls: [] as { text: string; lang: string; voice: string | null }[],
        clicks: [] as boolean[],
        cancels: 0,
      };
      let voicesReady = !delayed;
      class Synthesis extends EventTarget {
        getVoices() {
          const japanese = {
            name: "Japanese test voice",
            lang: "ja-JP",
            voiceURI: "ja",
            default: true,
            localService: true,
          };
          const thai = {
            name: "Thai test voice",
            lang: "th-TH",
            voiceURI: "th",
            default: false,
            localService: true,
          };
          return noThai || !voicesReady ? [japanese] : [japanese, thai];
        }
        speak(utterance: Utterance) {
          utterances.push(utterance);
          state.calls.push({
            text: utterance.text,
            lang: utterance.lang,
            voice: utterance.voice?.lang ?? null,
          });
          const click = window.event;
          state.clicks.push(click?.type === "click" && click.isTrusted);
          utterance.onstart?.();
        }
        cancel() {
          state.cancels += 1;
        }
      }
      const synthesis = new Synthesis();
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: synthesis,
      });
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
      Object.defineProperty(window, "__pairSpeech", { value: state });
      Object.defineProperty(window, "__pairSpeechEvent", {
        value: (event: "end" | "error" | "voices", index?: number) => {
          if (event === "voices") {
            voicesReady = true;
            synthesis.dispatchEvent(new Event("voiceschanged"));
            return;
          }
          const utterance = utterances[index ?? utterances.length - 1];
          if (!utterance) throw new Error("Missing speech call");
          if (event === "end") utterance.onend?.();
          else utterance.onerror?.();
        },
      });
    },
    { noThai, delayed },
  );
}

async function speechState(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__pairSpeech");
    if (typeof value !== "object" || value === null)
      throw new Error("Missing pair speech stub");
    const cancels: unknown = Reflect.get(value, "cancels");
    const calls: unknown = Reflect.get(value, "calls");
    const clicks: unknown = Reflect.get(value, "clicks");
    if (
      typeof cancels !== "number" ||
      !Array.isArray(calls) ||
      !Array.isArray(clicks) ||
      !clicks.every((entry: unknown) => typeof entry === "boolean")
    )
      throw new Error("Invalid speech probe");
    return {
      cancels,
      clicks: clicks.map(Boolean),
      calls: calls.map((call: unknown) => {
        if (typeof call !== "object" || call === null)
          throw new Error("Invalid speech call");
        const text: unknown = Reflect.get(call, "text");
        const lang: unknown = Reflect.get(call, "lang");
        const voice: unknown = Reflect.get(call, "voice");
        if (
          typeof text !== "string" ||
          typeof lang !== "string" ||
          (voice !== null && typeof voice !== "string")
        )
          throw new Error("Invalid speech payload");
        return { text, lang, voice };
      }),
    };
  });
}

async function speechEvent(
  page: Page,
  event: "end" | "error" | "voices",
  index?: number,
) {
  await page.evaluate(
    ({ event, index }) => {
      const control: unknown = Reflect.get(window, "__pairSpeechEvent");
      if (typeof control !== "function")
        throw new Error("Missing speech control");
      Reflect.apply(control, undefined, [event, index]);
    },
    { event, index },
  );
}

/** Selecting an audio card is itself the playback gesture; no second button. */
async function hearCue(page: Page, id: string) {
  const before = (await speechState(page)).calls.length;
  await cueButton(page, id).click();
  await expect
    .poll(async () => (await speechState(page)).calls.length)
    .toBe(before + 1);
  const state = await speechState(page);
  expect(state.calls.at(-1)).toEqual({
    text: character(id).name,
    lang: "th-TH",
    voice: "th-TH",
  });
  expect(state.clicks.at(-1)).toBe(true);
  return before;
}

test("読み方と文字を2周つなぎ、誤答はやり直せて、8問の確認だけを独立した記録に残す", async ({
  page,
}) => {
  await seedLearningAndWatchWrites(page);
  await page.goto("/");
  const dashboardBefore = await dashboardStats(page);
  await openTraining(page);
  const before = await storageSnapshot(page);
  await startPairs(page);
  const [first, wrong] = defaultIds;
  await cueButton(page, first).click();
  await letterButton(page, wrong).click();
  const feedback = pairs(page)
    .getByRole("status")
    .filter({ hasText: character(first).name });
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(character(wrong).thai);
  await expect(pairProgress(page)).toHaveJSProperty("value", 0);
  await expect(cueButton(page, first)).toBeEnabled();
  await expect(letterButton(page, wrong)).toBeEnabled();
  await letterButton(page, first).click();
  await expect(pairProgress(page)).toHaveJSProperty("value", 1);
  await finishReadingLap(page, defaultIds);
  expect(await storageSnapshot(page)).toEqual(before);
  await secondLap(page);
  await finishReadingLap(page, defaultIds);
  await expect(
    pairs(page).getByRole("heading", { name: "2周クリア！", exact: true }),
  ).toBeVisible();
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await storageWrites(page)).toEqual([]);
  await pairs(page)
    .getByRole("button", { name: "8問で確かめる", exact: true })
    .click();
  expect((await savedTraining(page)).sessionsCompleted).toBe(0);
  expect((await savedTraining(page)).records).toEqual({});
  await finishQuiz(page);
  const saved = await savedTraining(page);
  expect(saved.sessionsCompleted).toBe(1);
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.correct + record.incorrect,
      0,
    ),
  ).toBe(8);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
  ).toBeEnabled();
  expect(await savedTraining(page)).toEqual(saved);
  await page.goto("/");
  expect(await dashboardStats(page)).toEqual(dashboardBefore);
  const after = await storageSnapshot(page);
  expect(after[PROGRESS_STORAGE_KEY]).toBe(before[PROGRESS_STORAGE_KEY]);
  expect(after[REVIEW_STORAGE_KEY]).toBe(before[REVIEW_STORAGE_KEY]);
});

test("音声カードを1回押すと再生し、切替・停止・再生し直し・エラー・遅延通知では誤って回答を解放しない", async ({
  page,
}) => {
  await installSpeechStub(page);
  await seedLearningAndWatchWrites(page);
  await openTraining(page, "audio");
  const before = await storageSnapshot(page);
  await startPairs(page, "audio-to-letter");
  expect((await speechState(page)).calls).toHaveLength(0);
  await expect(pairs(page)).toContainText("未監修");
  await expect(pairs(page)).toContainText("通信する場合があります");
  const [first, second, third] = defaultIds;
  for (const button of await pairs(page).locator("[data-letter-id]").all())
    await expect(button).toBeDisabled();
  const firstAttempt = await hearCue(page, first);
  await expect(cueButton(page, first)).toHaveAccessibleName(/音声\dのカード/);
  await expect(pairs(page)).toContainText("未監修");
  await expect(pairs(page)).toContainText("通信する場合があります");
  await expect(pairs(page)).not.toContainText(character(first).name);
  await expect(letterButton(page, first)).toBeDisabled();
  const beforeSwitch = await speechState(page);
  const secondAttempt = await hearCue(page, second);
  expect((await speechState(page)).cancels).toBeGreaterThan(
    beforeSwitch.cancels,
  );
  await speechEvent(page, "end", firstAttempt);
  await expect(letterButton(page, second)).toBeDisabled();
  const play = pairs(page).getByRole("button", {
    name: "問題の音声を聞く",
    exact: true,
  });
  await pairs(page)
    .getByRole("button", { name: "問題の音声を停止", exact: true })
    .click();
  await speechEvent(page, "end", secondAttempt);
  await expect(letterButton(page, second)).toBeDisabled();
  const errorAttempt = await hearCue(page, second);
  await speechEvent(page, "error", errorAttempt);
  await expect(
    pairs(page)
      .getByRole("status")
      .filter({ hasText: "合成音声を再生できませんでした" }),
  ).toBeVisible();
  await expect(letterButton(page, second)).toBeDisabled();
  await speechEvent(page, "end", errorAttempt);
  await expect(letterButton(page, second)).toBeDisabled();
  // The standalone play button remains a one-click retry/stop control.
  await play.click();
  const retryAttempt = (await speechState(page)).calls.length - 1;
  await speechEvent(page, "end", retryAttempt);
  await expect(letterButton(page, second)).toBeEnabled();
  expect((await speechState(page)).calls.at(-1)).toEqual({
    text: character(second).name,
    lang: "th-TH",
    voice: "th-TH",
  });
  // The same selected card replays immediately and locks its answer again.
  const replayAttempt = await hearCue(page, second);
  await expect(letterButton(page, second)).toBeDisabled();
  const latestAttempt = await hearCue(page, second);
  await speechEvent(page, "end", replayAttempt);
  await expect(letterButton(page, second)).toBeDisabled();
  await speechEvent(page, "end", latestAttempt);
  await expect(letterButton(page, second)).toBeEnabled();
  await letterButton(page, second).click();
  await expect(cueButton(page, second)).toBeDisabled();
  await expect(letterButton(page, second)).toBeDisabled();
  await expect(pairProgress(page)).toHaveJSProperty("value", 1);
  const lastAttempt = await hearCue(page, third);
  await pairs(page)
    .getByRole("button", { name: "読み方でペアさがし", exact: true })
    .click();
  await speechEvent(page, "end", lastAttempt);
  await expect(pairs(page)).toHaveAttribute("data-game-mode", "name-to-letter");
  await expect(pairs(page)).toHaveAttribute("data-lap", "1");
  await expect(pairProgress(page)).toHaveJSProperty("value", 0);
  await expectReadingCue(page, third);
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await storageWrites(page)).toEqual([]);
});

test("音声が後から準備されても勝手に再生せず、カードを1回押して2周を聞き分ける", async ({
  page,
}) => {
  await installSpeechStub(page, false, true);
  await seedLearningAndWatchWrites(page);
  await openTraining(page, "audio");
  const before = await storageSnapshot(page);
  await startPairs(page, "audio-to-letter");
  const first = defaultIds[0];
  await cueButton(page, first).click();
  expect((await speechState(page)).calls).toHaveLength(0);
  await speechEvent(page, "voices");
  await expect(
    pairs(page).getByRole("button", { name: "問題の音声を聞く", exact: true }),
  ).toBeEnabled();
  expect((await speechState(page)).calls).toHaveLength(0);

  await cueButton(page, first).focus();
  await page.keyboard.press("Space");
  const firstState = await speechState(page);
  expect(firstState.calls).toEqual([
    { text: character(first).name, lang: "th-TH", voice: "th-TH" },
  ]);
  expect(firstState.clicks).toEqual([true]);
  await expect(letterButton(page, first)).toBeDisabled();
  await speechEvent(page, "end");
  await letterButton(page, first).click();

  for (const id of defaultIds.slice(1)) {
    const index = await hearCue(page, id);
    await expect(letterButton(page, id)).toBeDisabled();
    await speechEvent(page, "end", index);
    await letterButton(page, id).click();
  }
  expect((await speechState(page)).calls).toHaveLength(defaultIds.length);
  await secondLap(page);
  expect((await speechState(page)).calls).toHaveLength(defaultIds.length);
  for (const button of await pairs(page).locator("[data-letter-id]").all())
    await expect(button).toBeDisabled();
  for (const id of defaultIds) {
    const index = await hearCue(page, id);
    await speechEvent(page, "end", index);
    await letterButton(page, id).click();
  }
  await expect(
    pairs(page).getByRole("heading", { name: "2周クリア！", exact: true }),
  ).toBeVisible();
  expect((await speechState(page)).calls).toHaveLength(defaultIds.length * 2);
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await storageWrites(page)).toEqual([]);
  await pairs(page)
    .getByRole("button", { name: "もう一度ペアさがし", exact: true })
    .click();
  await expect(pairProgress(page)).toHaveJSProperty("value", 0);
  expect((await speechState(page)).calls).toHaveLength(defaultIds.length * 2);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
  ).toBeEnabled();
  expect((await speechState(page)).calls).toHaveLength(0);
  expect(await storageSnapshot(page)).toEqual(before);
});

test("読み方の補助音声は展開せず1回で聞けて、ペア・問題の表示だけでは鳴らない", async ({
  page,
}) => {
  await installSpeechStub(page);
  await seedLearningAndWatchWrites(page);
  await openTraining(page);
  const before = await storageSnapshot(page);
  await startPairs(page);
  const first = defaultIds[0];
  await cueButton(page, first).click();
  expect((await speechState(page)).calls).toHaveLength(0);
  const play = pairs(page).getByRole("button", {
    name: "選んだ文字の名前を聞く",
    exact: true,
  });
  await expect(play).toBeVisible();
  await play.click();
  expect((await speechState(page)).calls).toEqual([
    { text: character(first).name, lang: "th-TH", voice: "th-TH" },
  ]);
  await expect(letterButton(page, first)).toBeEnabled();
  await letterButton(page, first).click();
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await storageWrites(page)).toEqual([]);
  await pairs(page)
    .getByRole("button", { name: "文字を選び直す", exact: true })
    .click();
  await page
    .getByRole("button", { name: "すぐに8問チャレンジ", exact: true })
    .click();
  const quiz = page.getByRole("region", {
    name: "文字チャレンジ",
    exact: true,
  });
  const targetId = await quiz.getAttribute("data-character-id");
  if (!targetId) throw new Error("Missing reading question target");
  const target = character(targetId);
  await expect(quiz).toHaveAttribute("data-kind", "name-to-letter");
  await expect(quiz).not.toContainText(target.name);
  expect((await speechState(page)).calls).toHaveLength(1);
  const questionAudio = quiz.getByRole("button", {
    name: "読み方を聞く",
    exact: true,
  });
  await expect(questionAudio).toBeVisible();
  await questionAudio.click();
  expect((await speechState(page)).calls.at(-1)).toEqual({
    text: target.name,
    lang: "th-TH",
    voice: "th-TH",
  });
  expect((await speechState(page)).clicks).toEqual([true, true]);
  await expect(quiz).not.toContainText(target.name);
  expect((await savedTraining(page)).records).toEqual({});
  expect((await savedTraining(page)).sessionsCompleted).toBe(0);
  const after = await storageSnapshot(page);
  expect(after[PROGRESS_STORAGE_KEY]).toEqual(before[PROGRESS_STORAGE_KEY]);
  expect(after[REVIEW_STORAGE_KEY]).toEqual(before[REVIEW_STORAGE_KEY]);
});

test("2文字と8文字の両方で全ての文字を各周1回ずつ扱い、ゲーム終了や再読込みで記録を増やさない", async ({
  page,
}) => {
  await seedLearningAndWatchWrites(page);
  for (const ids of [
    ["ko-kai", "mo-ma"],
    [
      "ko-kai",
      "mo-ma",
      "no-nu",
      "ngo-ngu",
      "cho-chan",
      "do-dek",
      "to-tao",
      "bo-baimai",
    ],
  ]) {
    await openTraining(page);
    const before = await storageSnapshot(page);
    await chooseCharacters(page, ids);
    await startPairs(page);
    await finishReadingLap(page, ids);
    await secondLap(page);
    await finishReadingLap(page, ids);
    await expect(
      pairs(page).getByRole("heading", { name: "2周クリア！", exact: true }),
    ).toBeVisible();
    expect(await storageSnapshot(page)).toEqual(before);
    expect(await storageWrites(page)).toEqual([]);
    expect((await savedTraining(page)).sessionsCompleted).toBe(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
    ).toBeEnabled();
    expect(await storageSnapshot(page)).toEqual(before);
  }
});

test("タイ語音声がない端末でも別言語で代用せず、読み方で同じ文字の2周を続けられる", async ({
  page,
}) => {
  await installSpeechStub(page, true);
  await seedLearningAndWatchWrites(page);
  await openTraining(page, "audio");
  await chooseCharacters(page, ["kho-khai", "kho-khwai"]);
  const before = await storageSnapshot(page);
  await startPairs(page, "audio-to-letter");
  await cueButton(page, "kho-khai").click();
  await expect(
    pairs(page)
      .getByRole("status")
      .filter({ hasText: "タイ語の合成音声を利用できません" }),
  ).toBeVisible();
  await expect(letterButton(page, "kho-khai")).toBeDisabled();
  expect((await speechState(page)).calls).toHaveLength(0);
  await pairs(page)
    .getByRole("button", { name: "読み方でペアさがし", exact: true })
    .click();
  await expect(pairs(page)).toHaveAttribute("data-game-mode", "name-to-letter");
  await finishReadingLap(page, ["kho-khai", "kho-khwai"]);
  await secondLap(page);
  await finishReadingLap(page, ["kho-khai", "kho-khwai"]);
  await expect(
    pairs(page).getByRole("heading", { name: "2周クリア！", exact: true }),
  ).toBeVisible();
  expect((await speechState(page)).calls).toHaveLength(0);
  expect(await storageSnapshot(page)).toEqual(before);
  expect(await storageWrites(page)).toEqual([]);
});

test("320px幅で読み方と文字をキーボードでつなぎ、字体と動きを減らす設定も維持する", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTraining(page);
  await startPairs(page);
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
  const id = defaultIds[0];
  await cueButton(page, id).focus();
  await page.keyboard.press("Space");
  const letter = letterButton(page, id);
  await expect(letter.locator('[lang="th"]')).toHaveCSS(
    "font-family",
    /Noto Sans Thai Variable/,
  );
  await letter.focus();
  await page.keyboard.press("Enter");
  await expect(pairProgress(page)).toHaveJSProperty("value", 1);
  await expect(letter).toBeDisabled();
  await expect(pairs(page).locator(".cp-stamp.is-new > .thai")).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("character-pairs-320px.png"),
    fullPage: true,
  });
  await finishReadingLap(page, defaultIds);
  await secondLap(page);
  await finishReadingLap(page, defaultIds);
  await expect(
    pairs(page).getByRole("heading", { name: "2周クリア！", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

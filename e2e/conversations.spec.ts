import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  conversationScenarios,
  conversationSources,
  conversationWords,
} from "../src/data/conversations";
import type { ConversationScenario } from "../src/lib/conversation-types";
import {
  CONVERSATION_STORAGE_KEY,
  isConversationProgress,
} from "../src/lib/conversation";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import {
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  REVIEW_STORAGE_KEY,
} from "../src/lib/review";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
} from "../src/lib/character-training-progress";
import { SOUND_PREFERENCES_KEY } from "../src/lib/sound-preferences";

test.use({ timezoneId: "Asia/Tokyo" });

const oldKeys = [
  PROGRESS_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
  CHARACTER_TRAINING_STORAGE_KEY,
];
const firstScenario = conversationScenarios[0];
const timestamp = "2026-10-26T09:00:00.000Z";

async function prepare(
  page: Page,
  options: {
    voice?: "thai" | "no-thai" | "hold";
    raw?: string;
    denyWrites?: boolean;
  } = {},
) {
  const lesson = courseLessons[0];
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
    studyDays: [timestamp.slice(0, 10)],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    timestamp,
  );
  await page.addInitScript(
    ({ values, conversationKey, raw, voice, denyWrites }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      if (raw !== undefined && localStorage.getItem(conversationKey) === null)
        localStorage.setItem(conversationKey, raw);
      const probe = {
        writes: [] as string[],
        calls: [] as { text: string; lang: string }[],
        cancels: 0,
        audioContexts: 0,
      };
      Object.defineProperty(window, "__conversationE2E", { value: probe });
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
        if (denyWrites && key === conversationKey)
          throw new DOMException(
            "Conversation write refused",
            "QuotaExceededError",
          );
        return originalSetItem.call(this, key, value);
      };
      // Conversation practice must stay silent even with sound preferences enabled.
      class AudioContextProbe {
        constructor() {
          probe.audioContexts += 1;
          throw new Error("Unexpected conversation sound effect");
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
        timer: number | undefined;
        getVoices() {
          const japanese = {
            name: "Conversation Japanese test voice",
            lang: "ja-JP",
            voiceURI: "cv-ja",
            localService: true,
            default: true,
          };
          return voice === "no-thai"
            ? [japanese]
            : [
                japanese,
                {
                  name: "Conversation Thai test voice",
                  lang: "th-TH",
                  voiceURI: "cv-th",
                  localService: true,
                  default: false,
                },
              ];
        }
        speak(utterance: Utterance) {
          probe.calls.push({ text: utterance.text, lang: utterance.lang });
          utterance.onstart?.();
          if (voice !== "hold")
            this.timer = window.setTimeout(() => utterance.onend?.(), 60);
        }
        cancel() {
          probe.cancels += 1;
          window.clearTimeout(this.timer);
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
    },
    {
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
      conversationKey: CONVERSATION_STORAGE_KEY,
      raw: options.raw,
      voice: options.voice ?? "thai",
      denyWrites: options.denyWrites ?? false,
    },
  );
}

async function oldSnapshot(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    oldKeys,
  );
}

async function conversationRaw(page: Page) {
  return page.evaluate(
    (key) => localStorage.getItem(key),
    CONVERSATION_STORAGE_KEY,
  );
}

async function savedConversation(page: Page) {
  const raw = await conversationRaw(page);
  const value: unknown = raw === null ? null : JSON.parse(raw);
  if (!isConversationProgress(value))
    throw new Error("Invalid saved conversation progress");
  return value;
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__conversationE2E");
    if (typeof value !== "object" || value === null)
      throw new Error("Conversation probe missing");
    const writes: unknown = Reflect.get(value, "writes");
    const calls: unknown = Reflect.get(value, "calls");
    if (
      !Array.isArray(writes) ||
      !writes.every((key: unknown) => typeof key === "string") ||
      !Array.isArray(calls)
    )
      throw new Error("Invalid conversation probe");
    return {
      writes: writes.map(String),
      calls: calls.map((call: unknown) => {
        if (
          typeof call !== "object" ||
          call === null ||
          typeof Reflect.get(call, "text") !== "string" ||
          typeof Reflect.get(call, "lang") !== "string"
        )
          throw new Error("Invalid model speech call");
        return {
          text: String(Reflect.get(call, "text")),
          lang: String(Reflect.get(call, "lang")),
        };
      }),
      cancels: Number(Reflect.get(value, "cancels")),
      audioContexts: Number(Reflect.get(value, "audioContexts")),
    };
  });
}

function practice(page: Page) {
  return page.getByRole("region", { name: "会話の練習", exact: true });
}

async function start(page: Page, scenario = firstScenario) {
  await page
    .getByRole("button", { name: `${scenario.title}を始める`, exact: true })
    .click();
  await expect(practice(page)).toHaveAttribute("data-scenario-id", scenario.id);
  await expect(practice(page)).toHaveAttribute("data-step-index", "1");
}

async function choose(region: Locator, id: string) {
  await region
    .locator(`[data-choice-id=${JSON.stringify(id)}]`)
    .locator("..")
    .click();
  await region
    .getByRole("button", { name: "この表現で答える", exact: true })
    .click();
}

async function finishSteps(
  page: Page,
  scenario: ConversationScenario,
  options: { wrongFirst?: boolean; alternate?: boolean } = {},
) {
  const region = practice(page);
  for (const [index, step] of scenario.steps.entries()) {
    await expect(region).toHaveAttribute("data-step-id", step.id);
    await expect(region).toHaveAttribute("data-step-index", String(index + 1));
    await expect(region.getByTestId("conversation-npc")).toHaveText(
      step.npc.thai,
    );
    await expect(
      region.getByRole("heading", { name: step.goal, exact: true }),
    ).toBeVisible();
    const check = region.getByRole("button", {
      name: "この表現で答える",
      exact: true,
    });
    await expect(check).toBeDisabled();
    if (index === 0 && options.wrongFirst) {
      const wrong = step.choices.find(
        (choice) => !step.answerIds.includes(choice.id),
      );
      if (!wrong) throw new Error("No wrong intent choice available");
      await choose(region, wrong.id);
      const feedback = region.locator(".cv-feedback");
      await expect(feedback).toHaveAttribute("data-answer-correct", "false");
      await expect(feedback).toContainText(wrong.phrase.meaning);
      await expect(feedback).toContainText(wrong.explanation);
      await expect(feedback).toContainText(step.explanation);
      await expect(
        region.getByRole("button", { name: "次のやりとりへ", exact: true }),
      ).toHaveCount(0);
      for (const choice of step.choices)
        await expect(
          region.locator(`[data-choice-id=${JSON.stringify(choice.id)}]`),
        ).toBeDisabled();
      await region
        .getByRole("button", { name: "もう一度選ぶ", exact: true })
        .click();
      await expect(check).toBeDisabled();
      await expect(region).toHaveAttribute("data-step-id", step.id);
    }
    const correctId = options.alternate
      ? step.answerIds.at(-1)
      : step.answerIds[0];
    const correct = step.choices.find((choice) => choice.id === correctId);
    if (!correct) throw new Error("No correct conversation phrase available");
    await choose(region, correct.id);
    const feedback = region.locator(".cv-feedback");
    await expect(feedback).toHaveAttribute("data-answer-correct", "true");
    await expect(feedback).toContainText(correct.phrase.meaning);
    await expect(feedback).toContainText(correct.explanation);
    await expect(feedback).toContainText(step.explanation);
    await region
      .getByRole("button", {
        name:
          index === scenario.steps.length - 1
            ? "会話を振り返る"
            : "次のやりとりへ",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("region", { name: "会話の振り返り", exact: true }),
  ).toBeVisible();
}

async function recordTwice(page: Page) {
  const save = page.getByRole("button", {
    name: "この会話の練習を記録",
    exact: true,
  });
  await save.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement))
      throw new Error("Completion button missing");
    element.click();
    element.click();
  });
  await expect(
    page.getByRole("heading", {
      name: "この会話を練習しました！",
      exact: true,
    }),
  ).toBeVisible();
}

async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
}

test("4シーンの目的に合う会話を練習し、誤答を確認してから終了操作だけで記録を残す", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await prepare(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/conversations");
  const before = await oldSnapshot(page);
  const catalog = page.getByRole("region", {
    name: "会話ミッション一覧",
    exact: true,
  });
  await expect(
    catalog.locator("article[data-testid^=conversation-card-]"),
  ).toHaveCount(4);
  await expect(
    page.getByText("教材案・専門家監修前", { exact: true }),
  ).toBeVisible();
  await page.getByText("教材・音声と出典について", { exact: true }).click();
  for (const source of conversationSources) {
    await expect(
      page.getByRole("link", { name: source.title, exact: true }),
    ).toHaveAttribute("href", source.url);
    await expect(page.getByText(source.scope, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByText("文全体のIPAは収録していません。", { exact: false }),
  ).toBeVisible();
  expect(await conversationRaw(page)).toBeNull();
  expect((await probe(page)).writes).toEqual([]);
  for (const [index, scenario] of conversationScenarios.entries()) {
    await expect(
      page.getByTestId(`conversation-card-${scenario.id}`),
    ).toContainText(scenario.objective);
    await start(page, scenario);
    await finishSteps(page, scenario, {
      wrongFirst: index === 0,
      alternate: true,
    });
    const interim = await conversationRaw(page);
    expect(
      interim === null
        ? 0
        : Object.keys((await savedConversation(page)).scenarios).length,
    ).toBe(index);
    await recordTwice(page);
    const saved = await savedConversation(page);
    expect(saved.scenarios[scenario.id].completedSessions).toBe(1);
    expect(saved.recentSessionIds).toHaveLength(index + 1);
    expect((await probe(page)).writes).toEqual(
      Array(index + 1).fill(CONVERSATION_STORAGE_KEY),
    );
    expect((await probe(page)).calls).toEqual([]);
    expect((await probe(page)).audioContexts).toBe(0);
    await page
      .getByRole("button", { name: "シーン一覧に戻る", exact: true })
      .click();
    await expect(
      page.getByTestId(`conversation-card-${scenario.id}`),
    ).toContainText("練習済み · 1回");
  }
  const saved = await savedConversation(page);
  expect(Object.keys(saved.scenarios).sort()).toEqual(
    conversationScenarios.map((scenario) => scenario.id).sort(),
  );
  expect(await oldSnapshot(page)).toEqual(before);
  expect(await conversationRaw(page)).not.toMatch(
    /[\u0e00-\u0e7f]|choiceId|answers|transcript|audio/i,
  );
  await page.reload();
  for (const scenario of conversationScenarios)
    await expect(
      page.getByTestId(`conversation-card-${scenario.id}`),
    ).toContainText("練習済み · 1回");
  expect(await savedConversation(page)).toEqual(saved);
  expect(await oldSnapshot(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("未知版の会話記録は練習後も保護し、明示した置換操作でだけ保存を再開する", async ({
  page,
}) => {
  const original =
    '{"version":99,"scenarios":{"future":{"private":"keep"}},"recentSessionIds":[]}';
  await prepare(page, { raw: original });
  await page.goto("/conversations");
  const before = await oldSnapshot(page);
  await expect(
    page.getByText(/会話の保存データを読み取れません/),
  ).toBeVisible();
  await start(page);
  await finishSteps(page, firstScenario);
  await recordTwice(page);
  expect(await conversationRaw(page)).toBe(original);
  expect((await probe(page)).writes).toEqual([]);
  await page.getByText("会話の保存を再開する", { exact: true }).click();
  await page
    .getByRole("button", { name: "会話の保存記録を置き換える", exact: true })
    .click();
  expect(
    (await savedConversation(page)).scenarios[firstScenario.id]
      .completedSessions,
  ).toBe(1);
  expect((await probe(page)).writes).toEqual([CONVERSATION_STORAGE_KEY]);
  expect(await oldSnapshot(page)).toEqual(before);
  await page.reload();
  await expect(
    page.getByTestId(`conversation-card-${firstScenario.id}`),
  ).toContainText("練習済み · 1回");
});

test("保存を拒否されても会話を進められ、タブ内の記録と未保存の案内を確認できる", async ({
  page,
}) => {
  await prepare(page, { denyWrites: true });
  await page.goto("/conversations");
  const before = await oldSnapshot(page);
  await start(page);
  await finishSteps(page, firstScenario);
  await recordTwice(page);
  await expect(
    page.getByText(
      "会話の練習記録を保存できません。このタブでは続けられますが、閉じると今回の記録が失われます。",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await conversationRaw(page)).toBeNull();
  await page
    .getByRole("button", { name: "もう一度このシーン", exact: true })
    .click();
  await finishSteps(page, firstScenario, { alternate: true });
  await recordTwice(page);
  await page
    .getByRole("button", { name: "シーン一覧に戻る", exact: true })
    .click();
  await expect(
    page.getByTestId(`conversation-card-${firstScenario.id}`),
  ).toContainText("練習済み · 2回");
  expect(await oldSnapshot(page)).toEqual(before);
  expect((await probe(page)).writes).toEqual([
    CONVERSATION_STORAGE_KEY,
    CONVERSATION_STORAGE_KEY,
  ]);
  await page.reload();
  await expect(
    page.getByTestId(`conversation-card-${firstScenario.id}`),
  ).not.toContainText("練習済み · 2回");
  expect(await oldSnapshot(page)).toEqual(before);
});

test("相手の表現は明示して再生し、表示や場面移動で自動再生せず再生中の音声を取り消す", async ({
  page,
}) => {
  await prepare(page, { voice: "hold" });
  await page.goto("/conversations");
  const before = await oldSnapshot(page);
  await start(page);
  const region = practice(page);
  const npc = region.locator(".cv-npc-bubble");
  const step = firstScenario.steps[0];
  expect((await probe(page)).calls).toEqual([]);
  await npc.getByText("単語の読み方を見る", { exact: true }).click();
  await expect(npc).toContainText("文全体の音声表記");
  for (const wordId of step.npc.wordIds) {
    const word = conversationWords.find((item) => item.id === wordId);
    if (!word) throw new Error("Source word missing");
    await expect(npc).toContainText(word.ipa);
  }
  await npc
    .getByRole("button", { name: "相手の表現を聞く", exact: true })
    .click();
  expect((await probe(page)).calls).toEqual([
    { text: step.npc.thai, lang: "th-TH" },
  ]);
  const cancellations = (await probe(page)).cancels;
  await region
    .getByRole("button", { name: "シーン一覧に戻る", exact: true })
    .click();
  await expect
    .poll(async () => (await probe(page)).cancels)
    .toBeGreaterThan(cancellations);
  await start(page, conversationScenarios[1]);
  await expect(practice(page).getByTestId("conversation-npc")).toHaveText(
    conversationScenarios[1].steps[0].npc.thai,
  );
  expect((await probe(page)).calls).toHaveLength(1);
  expect((await probe(page)).writes).toEqual([]);
  expect((await probe(page)).audioContexts).toBe(0);
  expect(await oldSnapshot(page)).toEqual(before);
});

test("音声がない端末でも320px・文字200%で日本語と読み方を確認し、キーボードで返答できる", async ({
  page,
}, testInfo) => {
  await prepare(page, { voice: "no-thai" });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: /^(会話ミッション|会話)$/ }).click();
  await expect(page).toHaveURL(/\/conversations$/);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await noOverflow(page);
  const startButton = page.getByRole("button", {
    name: `${firstScenario.title}を始める`,
    exact: true,
  });
  await startButton.focus();
  await page.keyboard.press("Enter");
  const region = practice(page);
  await expect(region).toHaveAttribute("data-scenario-id", firstScenario.id);
  const npc = region.locator(".cv-npc-bubble");
  await expect(
    npc.getByRole("button", { name: "相手の表現を聞く", exact: true }),
  ).toBeDisabled();
  await expect(
    npc.getByText(/この端末ではタイ語の合成音声を利用できません/),
  ).toBeVisible();
  await npc.getByText("日本語を見る", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    npc.getByText(firstScenario.steps[0].npc.meaning, { exact: true }),
  ).toBeVisible();
  await npc.getByText("単語の読み方を見る", { exact: true }).focus();
  await page.keyboard.press("Enter");
  const first = firstScenario.steps[0];
  const choice = first.choices.find(
    (item) => item.id === first.answerIds.at(-1),
  );
  if (!choice) throw new Error("Source answer missing");
  const radio = region.getByRole("radio", {
    name: choice.phrase.thai,
    exact: true,
  });
  await radio.focus();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();
  await region
    .getByRole("button", { name: "この表現で答える", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(region.locator(".cv-feedback")).toHaveAttribute(
    "data-answer-correct",
    "true",
  );
  await noOverflow(page);
  await page
    .getByRole("switch", { name: "ループなしのタイ語フォント", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  await noOverflow(page);
  const animated = await region.evaluate(
    (element) =>
      [element, ...element.querySelectorAll("*")].filter((node) => {
        const style = getComputedStyle(node);
        return (
          style.animationName !== "none" &&
          style.animationDuration
            .split(",")
            .some((duration) => parseFloat(duration) > 0.001)
        );
      }).length,
  );
  expect(animated).toBe(0);
  expect((await probe(page)).calls).toEqual([]);
  expect((await probe(page)).audioContexts).toBe(0);
  expect(await conversationRaw(page)).toBeNull();
  await page.screenshot({
    path: testInfo.outputPath("conversation-320-large-text.png"),
    fullPage: true,
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getRomanceCharacter,
  getRomanceQuestions,
  romanceEpisodes,
} from "../src/data/romance";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  isRomanceState,
  ROMANCE_STORAGE_KEY,
  setRomanceProfile,
  type RomanceState,
} from "../src/lib/romance";
import {
  getJourneyKeepsakes,
  getJourneyPlan,
  isRomanceLearningState,
  ROMANCE_LEARNING_STORAGE_KEY,
  type JourneyActivity,
  type JourneyAttempt,
  type JourneyPlan,
  type RomanceLearningState,
} from "../src/lib/romance-journey";
import type { JourneyRouteId } from "../src/lib/romance-journey-types";
import type { RomanceGender } from "../src/lib/romance-types";
import { createEmptyProgress, PROGRESS_STORAGE_KEY } from "../src/lib/progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";
import {
  CONVERSATION_STORAGE_KEY,
  createEmptyConversationProgress,
} from "../src/lib/conversation";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
} from "../src/lib/character-training-progress";

test.use({ timezoneId: "Asia/Tokyo" });
const now = "2026-11-03T09:00:00.000Z";
const unrelatedKeys = [
  PROGRESS_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
  CONVERSATION_STORAGE_KEY,
  CHARACTER_TRAINING_STORAGE_KEY,
];

/** The doubles test trusted gestures and cancellation, never Thai audio quality. */
async function prepare(
  page: Page,
  options: {
    old?: RomanceState;
    learningRaw?: string;
    denyLearningWrites?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ values, learningRaw, learningKey, denyWrites }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      if (
        learningRaw !== undefined &&
        localStorage.getItem(learningKey) === null
      )
        localStorage.setItem(learningKey, learningRaw);
      const probe = {
        calls: [] as { text: string; lang: string; trusted: boolean }[],
        cancels: 0,
        writes: [] as string[],
        micRequests: 0,
      };
      Object.defineProperty(window, "__journeyProbe", { value: probe });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
        if (key === learningKey && denyWrites)
          throw new DOMException("Test storage denied", "QuotaExceededError");
        return original.call(this, key, value);
      };
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
              name: "Journey Thai test voice",
              lang: "th-TH",
              voiceURI: "journey-th",
              default: true,
              localService: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          probe.calls.push({
            text: utterance.text,
            lang: utterance.lang,
            trusted: window.event?.isTrusted === true,
          });
          utterance.onstart?.();
        }
        cancel() {
          probe.cancels += 1;
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
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia() {
            probe.micRequests += 1;
            return Promise.reject(
              new Error("Journey must not request a microphone"),
            );
          },
        },
      });
    },
    {
      values: [
        [
          ROMANCE_STORAGE_KEY,
          JSON.stringify(options.old ?? createEmptyRomance()),
        ],
        [PROGRESS_STORAGE_KEY, JSON.stringify(createEmptyProgress())],
        [REVIEW_STORAGE_KEY, JSON.stringify(createEmptyReview())],
        [
          CONVERSATION_STORAGE_KEY,
          JSON.stringify(createEmptyConversationProgress()),
        ],
        [
          CHARACTER_TRAINING_STORAGE_KEY,
          JSON.stringify(createEmptyCharacterTrainingState()),
        ],
      ],
      learningRaw: options.learningRaw,
      learningKey: ROMANCE_LEARNING_STORAGE_KEY,
      denyWrites: options.denyLearningWrites ?? false,
    },
  );
}

function course(page: Page) {
  return page.getByRole("region", { name: "恋するタイ語", exact: true });
}
function player(page: Page) {
  return page.getByRole("region", {
    name: "会話と物語のレッスン",
    exact: true,
  });
}
function card(page: Page) {
  return player(page).locator("[data-activity-id]");
}
async function raw(page: Page, key: string) {
  return page.evaluate((name) => localStorage.getItem(name), key);
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
async function oldState(page: Page): Promise<RomanceState> {
  const source = await raw(page, ROMANCE_STORAGE_KEY);
  const value: unknown = source === null ? null : JSON.parse(source);
  if (!isRomanceState(value)) throw new Error("Invalid relationship state");
  return value;
}
async function learningState(page: Page): Promise<RomanceLearningState> {
  const source = await raw(page, ROMANCE_LEARNING_STORAGE_KEY);
  const value: unknown = source === null ? null : JSON.parse(source);
  if (!isRomanceLearningState(value)) throw new Error("Invalid learning state");
  return value;
}
async function probe(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__journeyProbe");
    if (!value || typeof value !== "object") throw new Error("Missing probe");
    const calls: unknown = Reflect.get(value, "calls");
    const writes: unknown = Reflect.get(value, "writes");
    if (!Array.isArray(calls) || !Array.isArray(writes))
      throw new Error("Invalid probe");
    return {
      calls: calls.map((entry: unknown) => {
        if (!entry || typeof entry !== "object")
          throw new Error("Invalid speech call");
        return {
          text: String(Reflect.get(entry, "text")),
          lang: String(Reflect.get(entry, "lang")),
          trusted: Reflect.get(entry, "trusted") === true,
        };
      }),
      cancels: Number(Reflect.get(value, "cancels")),
      micRequests: Number(Reflect.get(value, "micRequests")),
      writes: writes.map(String),
    };
  });
}
function unchangedOthers(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
) {
  for (const key of unrelatedKeys) expect(after[key]).toBe(before[key]);
}
function previousStory(
  gender: RomanceGender,
  characterId: string,
  through = 0,
) {
  let state = setRomanceProfile(createEmptyRomance(), gender, "curious");
  for (const episode of romanceEpisodes.slice(0, through)) {
    state = completeRomanceEpisode(state, {
      characterId,
      episodeId: episode.id,
      sessionId: `prior-${characterId}-${episode.id}`,
      answers: getRomanceQuestions(characterId, episode.id).map((question) => ({
        stepId: question.id,
        choiceId: question.answerIds[0],
      })),
      storyChoiceId: `${episode.id}-thoughtful`,
      now,
    }).state;
  }
  return state;
}
async function setup(page: Page, gender: RomanceGender = "male") {
  await course(page)
    .getByRole("radio", {
      name: gender === "male" ? "男性" : "女性",
      exact: true,
    })
    .click();
  await course(page)
    .getByRole("radio", { name: /^落ち着いて知的/ })
    .click();
  await course(page)
    .getByRole("button", { name: "この設定で物語をはじめる", exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "roster");
}
async function openCharacter(page: Page, id: string) {
  const character = getRomanceCharacter(id);
  if (!character) throw new Error("Missing character");
  await course(page)
    .getByRole("button", { name: `${character.name} と会話する`, exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
}
async function openEpisode(page: Page, episodeId: string) {
  const episode = romanceEpisodes.find((entry) => entry.id === episodeId);
  if (!episode) throw new Error("Missing episode");
  await course(page)
    .getByRole("button", { name: `${episode.title} をはじめる`, exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "route");
}
async function openRoute(page: Page, plan: JourneyPlan) {
  await player(page).locator(`button[data-route-id="${plan.routeId}"]`).click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "scene");
  await expect(player(page)).toContainText(plan.route.scene);
  await expect(player(page)).toContainText(plan.route.challenge);
  await player(page)
    .getByRole("button", { name: "会話をはじめる", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "activity");
}
async function models(page: Page) {
  while ((await card(page).getAttribute("data-activity-kind")) === "model") {
    const next = card(page).getByRole("button", {
      name: "次のお手本へ",
      exact: true,
    });
    if (await next.count()) await next.click();
    else
      await card(page)
        .getByRole("button", { name: "このことばを使ってみる", exact: true })
        .click();
  }
}
async function confirmActivity(
  page: Page,
  activity: Exclude<JourneyActivity, { kind: "model" }>,
  options: { correct?: boolean; variant?: number; hint?: boolean } = {},
): Promise<JourneyAttempt> {
  const { correct = true, variant = 0, hint = false } = options;
  await expect(card(page)).toHaveAttribute("data-activity-id", activity.id);
  if (hint) {
    await card(page)
      .getByRole("button", {
        name:
          activity.kind === "build"
            ? "お手本のヒント"
            : "日本語とお手本のヒントを見る",
        exact: true,
      })
      .click();
  }
  let attempt: JourneyAttempt;
  if (activity.kind === "build") {
    const ids =
      activity.acceptedWordIds[variant % activity.acceptedWordIds.length];
    for (const id of ids)
      await card(page)
        .locator(`.rj-token-bank button[data-word-id="${id}"]`)
        .click();
    attempt = {
      activityId: activity.id,
      response: { kind: "build", wordIds: [...ids] },
      usedHint: hint,
    };
    await card(page)
      .getByRole("button", { name: "組み立てた返答を確認", exact: true })
      .click();
  } else {
    const choice = activity.question.choices.find((entry) =>
      correct
        ? entry.id ===
          activity.question.answerIds[
            variant % activity.question.answerIds.length
          ]
        : !activity.question.answerIds.includes(entry.id),
    );
    if (!choice) throw new Error("Missing choice");
    await card(page)
      .getByRole("radio", { name: choice.phrase.thai, exact: true })
      .click();
    attempt = {
      activityId: activity.id,
      response: { kind: "choice", choiceId: choice.id },
      usedHint: hint,
    };
    await card(page)
      .getByRole("button", { name: "返答を確認", exact: true })
      .click();
  }
  await expect(card(page).locator(".rj-feedback")).toHaveAttribute(
    "data-correct",
    String(correct),
  );
  await expect(player(page).locator(".rj-character-scene")).toHaveAttribute(
    "data-expression",
    correct ? "happy" : "concerned",
  );
  await expect(card(page).locator(".rj-feedback-portrait")).toBeInViewport({
    ratio: 1,
  });
  return attempt;
}
async function activities(
  page: Page,
  plan: JourneyPlan,
  options: {
    variant?: number;
    wrongCoreAt?: number;
    hintCoreAt?: number;
    skipModels?: boolean;
  } = {},
) {
  const attempts: JourneyAttempt[] = [];
  let core = 0;
  for (const activity of plan.activities) {
    if (activity.kind === "model") {
      if (options.skipModels)
        await card(page)
          .getByRole("button", {
            name: "お手本を見ずに、まず挑戦する",
            exact: true,
          })
          .click();
      else await models(page);
      continue;
    }
    const isCore = activity.kind === "respond" && activity.purpose === "core";
    if (isCore) {
      await expect(card(page)).toHaveAttribute(
        "data-support",
        plan.chapter.defaultSupport,
      );
      if (plan.chapter.defaultSupport === "recall")
        await expect(card(page).locator(".rj-chat-bubble")).not.toContainText(
          activity.question.npc.meaning,
        );
    }
    const correct = !isCore || core !== options.wrongCoreAt;
    const hint = isCore && core === options.hintCoreAt;
    attempts.push(
      await confirmActivity(page, activity, {
        correct,
        hint,
        variant: options.variant,
      }),
    );
    if (!correct) {
      await expect(card(page)).toContainText("この場面で伝えたい返答");
      await expect(card(page).getByRole("radio").first()).toBeDisabled();
    }
    await card(page)
      .getByRole("button", { name: "次のステップへ", exact: true })
      .click();
    if (isCore) core += 1;
  }
  // A wrong core answer gets one separate repair; it never replaces the first attempt.
  if (options.wrongCoreAt !== undefined) {
    await expect(player(page)).toHaveAttribute("data-journey-stage", "repair");
    await expect(player(page)).toContainText("最初の記録は変わりません");
    const wrong = plan.activities.filter(
      (entry): entry is Extract<JourneyActivity, { kind: "respond" }> =>
        entry.kind === "respond" && entry.purpose === "core",
    )[options.wrongCoreAt];
    const repair = {
      ...wrong,
      id: `${wrong.id}:repair`,
      purpose: "repair" as const,
      support: "model" as const,
    };
    const repairId = await card(page).getAttribute("data-activity-id");
    if (!repairId) throw new Error("Missing repair activity");
    await confirmActivity(page, { ...repair, id: repairId });
    await card(page)
      .getByRole("button", { name: "次のステップへ", exact: true })
      .click();
  }
  await expect(player(page)).toHaveAttribute("data-journey-stage", "story");
  return attempts;
}
async function wrap(page: Page, plan: JourneyPlan) {
  const choice = plan.route.wrapChoices.find((entry) =>
    entry.storyChoiceId.endsWith("thoughtful"),
  );
  if (!choice) throw new Error("Missing story choice");
  await expect(player(page).getByRole("radio")).toHaveCount(2);
  await player(page)
    .getByRole("radio", { name: choice.label, exact: true })
    .click();
  await expect(player(page)).toContainText(choice.reaction);
  await player(page)
    .getByRole("button", { name: "今日のページを振り返る", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "review");
}
async function record(page: Page) {
  await player(page)
    .getByRole("button", { name: "今日の会話を記録する", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "result");
}
async function play(page: Page, plan: JourneyPlan) {
  await openRoute(page, plan);
  await activities(page, plan);
  await wrap(page, plan);
  await record(page);
}

test("二つの行き先で違う場面と思い出を集め、明示終了だけで会話のノートを保存する", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/romance");
  const before = await snapshot(page);
  await setup(page);
  await openCharacter(page, "mali");
  await expect(course(page).getByTestId("romance-passport")).toContainText(
    "これから",
  );
  await openEpisode(page, "meet");
  const listen = getJourneyPlan("mali", "meet", "listen", "male");
  await expect(player(page).locator(".rj-route-card")).toHaveCount(2);
  expect((await probe(page)).calls).toEqual([]);
  await openRoute(page, listen);
  await activities(page, listen, { variant: 1 });
  await wrap(page, listen);
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBeNull();
  expect((await oldState(page)).characters.mali).toBeUndefined();
  await record(page);
  const first = await learningState(page);
  expect(first.characters.mali.episodes.meet).toMatchObject({
    plays: 1,
    routes: ["listen"],
    last: { coreCorrect: 3, coreTotal: 3, buildCorrect: 1, buildTotal: 1 },
  });
  const affinity = (await oldState(page)).characters.mali.affinity;
  expect(affinity).toBe(13);
  await page.reload();
  await openCharacter(page, "mali");
  await expect(course(page).getByTestId("romance-keepsakes")).toContainText(
    listen.route.keepsake.title,
  );
  await openEpisode(page, "meet");
  const lead = getJourneyPlan("mali", "meet", "lead", "male");
  expect(lead.route.scene).not.toBe(listen.route.scene);
  expect(lead.route.keepsake.id).not.toBe(listen.route.keepsake.id);
  await play(page, lead);
  const both = await learningState(page);
  expect(both.characters.mali.episodes.meet.plays).toBe(2);
  expect(both.characters.mali.episodes.meet.routes).toEqual(["listen", "lead"]);
  expect(getJourneyKeepsakes(both, "mali")).toHaveLength(2);
  expect((await oldState(page)).characters.mali.affinity).toBe(affinity);
  unchangedOthers(before, await snapshot(page));
});

test("旧記録を新しい活動へ水増しせず、後半のヒントと修復も本番の初回成績を変えない", async ({
  page,
}) => {
  const old = previousStory("female", "kiet", 3);
  await prepare(page, { old });
  await page.goto("/romance");
  await openCharacter(page, "kiet");
  await expect(course(page).getByTestId("romance-passport")).toContainText(
    "これから",
  );
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBeNull();
  await openEpisode(page, "market");
  const plan = getJourneyPlan("kiet", "market", "lead", "female");
  expect(plan.chapter.defaultSupport).toBe("recall");
  await openRoute(page, plan);
  await activities(page, plan, {
    variant: 0,
    wrongCoreAt: 0,
    hintCoreAt: 0,
    skipModels: true,
  });
  await wrap(page, plan);
  await expect(player(page)).toContainText("2 / 3");
  await record(page);
  expect(
    (await oldState(page)).characters.kiet.episodes.market.bestCorrect,
  ).toBe(2);
  const learned = await learningState(page);
  expect(Object.keys(learned.characters.kiet.episodes)).toEqual(["market"]);
  expect(learned.characters.kiet.episodes.market.last).toMatchObject({
    coreCorrect: 2,
    coreTotal: 3,
    buildCorrect: 1,
    recallCorrect: 1,
    hints: 1,
  });
  expect((await probe(page)).micRequests).toBe(0);
});

test("未知版の会話ノートは元データを保護し、物語のしおりと分けて明示的に復旧する", async ({
  page,
}) => {
  const future = '{"version":99,"future":"preserve me"}';
  await prepare(page, {
    old: previousStory("male", "mali"),
    learningRaw: future,
  });
  await page.goto("/romance");
  const before = await snapshot(page);
  await expect(
    course(page).getByTestId("romance-learning-notice"),
  ).toContainText("元データを保護");
  await openCharacter(page, "mali");
  await openEpisode(page, "meet");
  const plan = getJourneyPlan("mali", "meet", "listen", "male");
  await play(page, plan);
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBe(future);
  expect((await oldState(page)).characters.mali.episodes.meet.plays).toBe(1);
  const savedStory = await raw(page, ROMANCE_STORAGE_KEY);
  await course(page)
    .getByRole("button", {
      name: "会話パスポートの保存を置き換える",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "会話パスポートの保存を置き換えますか",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBe(future);
  await dialog
    .getByRole("button", {
      name: "会話パスポートの記録で置き換える",
      exact: true,
    })
    .click();
  expect(
    (await learningState(page)).characters.mali.episodes.meet.routes,
  ).toEqual(["listen"]);
  expect(await raw(page, ROMANCE_STORAGE_KEY)).toBe(savedStory);
  unchangedOthers(before, await snapshot(page));
});

test("会話ノートだけ保存を拒否されてもタブ内で続け、保存済みの物語と区別する", async ({
  page,
}) => {
  await prepare(page, {
    old: previousStory("male", "mali"),
    denyLearningWrites: true,
  });
  await page.goto("/romance");
  const before = await snapshot(page);
  await openCharacter(page, "mali");
  await openEpisode(page, "meet");
  const plan = getJourneyPlan("mali", "meet", "listen", "male");
  await play(page, plan);
  await expect(player(page).locator(".rj-save-status")).toContainText(
    "物語のしおり：このブラウザに保存しました",
  );
  await expect(player(page).locator(".rj-save-status")).toContainText(
    "会話のノート：このタブの記録",
  );
  await expect(
    course(page).getByTestId("romance-learning-notice"),
  ).toContainText("保存できません");
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBeNull();
  expect((await oldState(page)).characters.mali.episodes.meet.plays).toBe(1);
  await player(page)
    .getByRole("button", { name: "次のページへ", exact: true })
    .click();
  await expect(course(page).getByTestId("romance-keepsakes")).toContainText(
    plan.route.keepsake.title,
  );
  await page.reload();
  await openCharacter(page, "mali");
  await expect(course(page).getByTestId("romance-keepsakes")).not.toContainText(
    plan.route.keepsake.title,
  );
  unchangedOthers(before, await snapshot(page));
});

async function enter(button: Locator, page: Page) {
  await button.focus();
  await page.keyboard.press("Enter");
}

test("320px・文字200%でもキーボードの1操作で聞けて、表示や移動で勝手に再生しない", async ({
  page,
}) => {
  await prepare(page, { old: previousStory("female", "kiet") });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/romance");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await openCharacter(page, "kiet");
  await openEpisode(page, "meet");
  const plan = getJourneyPlan("kiet", "meet", "listen", "female");
  expect((await probe(page)).calls).toEqual([]);
  await enter(player(page).locator('button[data-route-id="listen"]'), page);
  await enter(
    player(page).getByRole("button", { name: "会話をはじめる", exact: true }),
    page,
  );
  await enter(
    card(page).getByRole("button", { name: "相手のことばを聞く", exact: true }),
    page,
  );
  const modelActivity = plan.activities[0];
  if (modelActivity.kind !== "model") throw new Error("Missing first model");
  expect((await probe(page)).calls.map((call) => call.text)).toEqual([
    modelActivity.models[0].npc.thai,
  ]);
  await models(page);
  expect((await probe(page)).calls).toHaveLength(1);
  const build = plan.activities.find((activity) => activity.kind === "build");
  if (!build || build.kind !== "build")
    throw new Error("Missing build activity");
  for (const wordId of build.acceptedWordIds[0])
    await enter(
      card(page).locator(`.rj-token-bank button[data-word-id="${wordId}"]`),
      page,
    );
  await enter(
    card(page).getByRole("button", {
      name: "組み立てた返答を確認",
      exact: true,
    }),
    page,
  );
  await enter(
    card(page).getByRole("button", { name: "次のステップへ", exact: true }),
    page,
  );
  const response = plan.activities.find(
    (activity) => activity.kind === "respond",
  );
  if (!response || response.kind !== "respond")
    throw new Error("Missing response activity");
  const choice = response.question.choices.find(
    (entry) => entry.id === response.question.answerIds[0],
  );
  if (!choice) throw new Error("Missing response choice");
  const beforeChoice = await probe(page);
  await enter(
    card(page).getByRole("radio", { name: choice.phrase.thai, exact: true }),
    page,
  );
  const afterChoice = await probe(page);
  expect(afterChoice.calls).toHaveLength(beforeChoice.calls.length + 1);
  expect(afterChoice.calls.at(-1)).toEqual({
    text: choice.phrase.thai,
    lang: "th-TH",
    trusted: true,
  });
  expect(
    afterChoice.calls.every((call) => call.trusted && call.lang === "th-TH"),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect
    .poll(async () => (await probe(page)).cancels)
    .toBeGreaterThan(afterChoice.cancels);
  expect(await raw(page, ROMANCE_LEARNING_STORAGE_KEY)).toBeNull();
  expect((await probe(page)).micRequests).toBe(0);
});

test("5つの会話機能を順に練習し、過去の会話を思い出しながら思い出とノートを育てる", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await prepare(page, { old: previousStory("male", "mali") });
  await page.goto("/romance");
  const before = await snapshot(page);
  await openCharacter(page, "mali");
  for (const [index, episode] of romanceEpisodes.entries()) {
    await openEpisode(page, episode.id);
    const route: JourneyRouteId = index % 2 ? "lead" : "listen";
    const plan = getJourneyPlan("mali", episode.id, route, "male");
    await play(page, plan);
    const learned = await learningState(page);
    expect(learned.characters.mali.episodes[episode.id].last).toMatchObject({
      coreCorrect: 3,
      coreTotal: 3,
      buildCorrect: 1,
      recallCorrect: index === 0 ? 0 : 1,
    });
    await player(page)
      .getByRole("button", { name: "次のページへ", exact: true })
      .click();
  }
  const learned = await learningState(page);
  expect(Object.keys(learned.characters.mali.episodes)).toHaveLength(5);
  expect(getJourneyKeepsakes(learned, "mali")).toHaveLength(5);
  await expect(course(page).getByTestId("romance-passport")).toContainText(
    "練習した",
  );
  unchangedOthers(before, await snapshot(page));
});

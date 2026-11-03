import { expect, test, type Page } from "@playwright/test";
import {
  getRomanceCharacter,
  getRomanceQuestions,
  romanceEpisodes,
} from "../src/data/romance";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  isRomanceState,
  setRomanceProfile,
  type RomanceState,
} from "../src/lib/romance";
import {
  createEmptyRomanceLearning,
  getJourneyKeepsakes,
  getJourneyPlan,
  isRomanceLearningState,
  type JourneyPlan,
  type RomanceLearningState,
} from "../src/lib/romance-journey";
import { romanceSettings } from "../src/lib/romance-setting";
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
const cityKeys = romanceSettings.city;
const campusKeys = romanceSettings.campus;
const protectedKeys = [
  cityKeys.relationshipKey,
  cityKeys.learningKey,
  PROGRESS_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
  CONVERSATION_STORAGE_KEY,
  CHARACTER_TRAINING_STORAGE_KEY,
];

function cityHistory() {
  const initial = setRomanceProfile(createEmptyRomance(), "male", "warm");
  return completeRomanceEpisode(initial, {
    characterId: "mali",
    episodeId: "meet",
    sessionId: "city-before-campus",
    answers: getRomanceQuestions("mali", "meet").map((question) => ({
      stepId: question.id,
      choiceId: question.answerIds[0],
    })),
    storyChoiceId: "meet-thoughtful",
    now,
  }).state;
}

/** Speech doubles verify direct gestures and isolation, not real Thai audio quality. */
async function prepare(
  page: Page,
  options: {
    campusRelationshipRaw?: string;
    campusLearningRaw?: string;
    denyLearningWrites?: boolean;
  } = {},
) {
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ values, learningKey, denyWrites }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const probe = {
        calls: [] as { text: string; lang: string; trusted: boolean }[],
        writes: [] as string[],
        cancels: 0,
        mic: 0,
      };
      Object.defineProperty(window, "__campusProbe", { value: probe });
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
        if (key === learningKey && denyWrites)
          throw new DOMException(
            "Campus test storage denied",
            "QuotaExceededError",
          );
        return originalSetItem.call(this, key, value);
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
              name: "Campus Thai test voice",
              lang: "th-TH",
              voiceURI: "campus-th",
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
            probe.mic += 1;
            return Promise.reject(
              new Error("Campus course must not request a microphone"),
            );
          },
        },
      });
    },
    {
      values: [
        [cityKeys.relationshipKey, JSON.stringify(cityHistory())],
        [cityKeys.learningKey, JSON.stringify(createEmptyRomanceLearning())],
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
        ...(options.campusRelationshipRaw === undefined
          ? []
          : [[campusKeys.relationshipKey, options.campusRelationshipRaw]]),
        ...(options.campusLearningRaw === undefined
          ? []
          : [[campusKeys.learningKey, options.campusLearningRaw]]),
      ],
      learningKey: campusKeys.learningKey,
      denyWrites: options.denyLearningWrites ?? false,
    },
  );
}

const course = (page: Page) =>
  page.getByRole("region", { name: "恋するタイ語", exact: true });
const player = (page: Page) =>
  page.getByRole("region", { name: "会話と物語のレッスン", exact: true });
const card = (page: Page) => player(page).locator("[data-activity-id]");
async function snapshot(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}
async function raw(page: Page, key: string) {
  return page.evaluate((value) => localStorage.getItem(value), key);
}
async function campusRelationship(page: Page): Promise<RomanceState> {
  const stored = await raw(page, campusKeys.relationshipKey);
  const parsed: unknown = stored === null ? null : JSON.parse(stored);
  if (!isRomanceState(parsed))
    throw new Error("Invalid campus relationship data");
  return parsed;
}
async function campusLearning(page: Page): Promise<RomanceLearningState> {
  const stored = await raw(page, campusKeys.learningKey);
  const parsed: unknown = stored === null ? null : JSON.parse(stored);
  if (!isRomanceLearningState(parsed))
    throw new Error("Invalid campus learning data");
  return parsed;
}
async function probe(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__campusProbe");
    if (!value || typeof value !== "object")
      throw new Error("Missing campus probe");
    const calls: unknown = Reflect.get(value, "calls");
    const writes: unknown = Reflect.get(value, "writes");
    if (!Array.isArray(calls) || !Array.isArray(writes))
      throw new Error("Invalid campus probe");
    return {
      calls: calls.map((entry: unknown) => {
        if (!entry || typeof entry !== "object")
          throw new Error("Invalid campus speech call");
        return {
          text: String(Reflect.get(entry, "text")),
          lang: String(Reflect.get(entry, "lang")),
          trusted: Reflect.get(entry, "trusted") === true,
        };
      }),
      writes: writes.map(String),
      cancels: Number(Reflect.get(value, "cancels")),
      mic: Number(Reflect.get(value, "mic")),
    };
  });
}
function expectProtected(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
) {
  for (const key of protectedKeys) expect(after[key]).toBe(before[key]);
}
async function setup(page: Page, gender: RomanceGender = "male") {
  await expect(course(page)).toHaveAttribute("data-story-setting", "campus");
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
async function openCharacter(page: Page, characterId: string) {
  const character = getRomanceCharacter(characterId);
  if (!character) throw new Error("Missing campus character");
  expect(character.age).toBeGreaterThanOrEqual(27);
  await course(page)
    .getByRole("button", { name: `${character.name} と会話する`, exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
  await expect(course(page)).toContainText(`${character.age}歳`);
}
async function openEpisode(page: Page, episodeId: string) {
  const episode = romanceEpisodes.find((entry) => entry.id === episodeId);
  if (!episode) throw new Error("Missing campus chapter");
  await course(page)
    .getByRole("button", { name: `${episode.title} をはじめる`, exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "route");
}
async function startRoute(page: Page, plan: JourneyPlan) {
  await player(page).locator(`button[data-route-id="${plan.routeId}"]`).click();
  await expect(player(page)).toContainText(plan.route.scene);
  await player(page)
    .getByRole("button", { name: "会話をはじめる", exact: true })
    .click();
}
async function finishActivities(page: Page, plan: JourneyPlan, variant = 0) {
  for (const activity of plan.activities) {
    await expect(card(page)).toHaveAttribute("data-activity-id", activity.id);
    if (activity.kind === "model") {
      for (let index = 0; index < activity.models.length; index += 1)
        await card(page)
          .getByRole("button", {
            name:
              index < activity.models.length - 1
                ? "次のお手本へ"
                : "このことばを使ってみる",
            exact: true,
          })
          .click();
      continue;
    }
    if (activity.kind === "build") {
      const words =
        activity.acceptedWordIds[variant % activity.acceptedWordIds.length];
      for (const id of words)
        await card(page)
          .locator(`.rj-token-bank button[data-word-id="${id}"]`)
          .click();
      await card(page)
        .getByRole("button", { name: "組み立てた返答を確認", exact: true })
        .click();
    } else {
      const choice = activity.question.choices.find(
        (entry) =>
          entry.id ===
          activity.question.answerIds[
            variant % activity.question.answerIds.length
          ],
      );
      if (!choice) throw new Error("Missing campus response");
      await card(page)
        .getByRole("radio", { name: choice.phrase.thai, exact: true })
        .click();
      await card(page)
        .getByRole("button", { name: "返答を確認", exact: true })
        .click();
    }
    await expect(card(page).locator(".rj-feedback")).toHaveAttribute(
      "data-correct",
      "true",
    );
    await card(page)
      .getByRole("button", { name: "次のステップへ", exact: true })
      .click();
  }
  await expect(player(page)).toHaveAttribute("data-journey-stage", "story");
}
async function finishStory(
  page: Page,
  plan: JourneyPlan,
  choiceKind: "thoughtful" | "gentle" = "thoughtful",
) {
  const choice = plan.route.wrapChoices.find((entry) =>
    entry.storyChoiceId.endsWith(choiceKind),
  );
  if (!choice) throw new Error("Missing campus story choice");
  await expect(player(page).getByRole("radio")).toHaveCount(2);
  await player(page)
    .getByRole("radio", { name: choice.label, exact: true })
    .click();
  await expect(player(page)).toContainText(choice.reaction);
  await player(page)
    .getByRole("button", { name: "今日のページを振り返る", exact: true })
    .click();
}
async function record(page: Page) {
  await player(page)
    .getByRole("button", { name: "今日の会話を記録する", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "result");
}
async function play(
  page: Page,
  plan: JourneyPlan,
  variant = 0,
  choiceKind: "thoughtful" | "gentle" = "thoughtful",
) {
  await startRoute(page, plan);
  await finishActivities(page, plan, variant);
  await finishStory(page, plan, choiceKind);
  await record(page);
}
async function backToChapters(page: Page) {
  await player(page)
    .getByRole("button", { name: "次のページへ", exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
}

test("街の記録を保ったまま学園へ移り、会話を記録して学園の2キーだけを復元する", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/romance");
  await expect(course(page)).toHaveAttribute("data-story-setting", "city");
  const before = await snapshot(page);
  await page
    .getByRole("navigation", { name: "物語の舞台", exact: true })
    .getByRole("link", { name: /キャンパス恋愛編/ })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "setup");
  await expect(course(page)).toContainText("社会人");
  expect(await raw(page, campusKeys.relationshipKey)).toBeNull();
  expect(await raw(page, campusKeys.learningKey)).toBeNull();
  await setup(page);
  await openCharacter(page, "mali");
  await openEpisode(page, "meet");
  const plan = getJourneyPlan("mali", "meet", "lead", "male", "campus");
  await startRoute(page, plan);
  expect((await probe(page)).calls).toEqual([]);
  const model = plan.activities[0];
  if (model.kind !== "model") throw new Error("Missing campus model");
  await card(page)
    .getByRole("button", { name: "相手のことばを聞く", exact: true })
    .click();
  expect((await probe(page)).calls).toEqual([
    { text: model.models[0].npc.thai, lang: "th-TH", trusted: true },
  ]);
  await finishActivities(page, plan);
  await finishStory(page, plan);
  expect(await raw(page, campusKeys.learningKey)).toBeNull();
  await record(page);
  expect((await campusRelationship(page)).characters.mali.affinity).toBe(13);
  expect(
    (await campusLearning(page)).characters.mali.episodes.meet.routes,
  ).toEqual(["lead"]);
  const after = await snapshot(page);
  expectProtected(before, after);
  expect(
    Object.keys(after)
      .filter((key) => !(key in before))
      .sort(),
  ).toEqual([campusKeys.relationshipKey, campusKeys.learningKey].sort());
  expect(
    (await probe(page)).calls.every(
      (call) => call.trusted && call.lang === "th-TH",
    ),
  ).toBe(true);
  expect((await probe(page)).mic).toBe(0);
  await page.reload();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "roster");
  expect((await probe(page)).calls).toEqual([]);
  await openCharacter(page, "mali");
  await expect(course(page).getByTestId("romance-keepsakes")).toContainText(
    plan.route.keepsake.title,
  );
  await page
    .getByRole("navigation", { name: "物語の舞台", exact: true })
    .getByRole("link", { name: /街のデート編/ })
    .click();
  await expect(course(page)).toHaveAttribute("data-story-setting", "city");
  expectProtected(before, await snapshot(page));
});

test("女性主人公の成人男性との両ルートを別の思い出にし、同日再演で好感度を増やさない", async ({
  page,
}) => {
  const initial = setRomanceProfile(createEmptyRomance(), "female", "curious");
  await prepare(page, { campusRelationshipRaw: JSON.stringify(initial) });
  await page.goto("/romance/campus");
  const before = await snapshot(page);
  await openCharacter(page, "kiet");
  await openEpisode(page, "meet");
  const first = getJourneyPlan("kiet", "meet", "listen", "female", "campus");
  expect(first.activities[0].question.npc.thai).toMatch(/ครับ$/u);
  await play(page, first, 1, "gentle");
  const affinity = (await campusRelationship(page)).characters.kiet.affinity;
  await player(page)
    .getByRole("button", { name: "別のルートも試す", exact: true })
    .click();
  const second = getJourneyPlan("kiet", "meet", "lead", "female", "campus");
  await play(page, second);
  expect((await campusRelationship(page)).characters.kiet.affinity).toBe(
    affinity,
  );
  const learned = await campusLearning(page);
  expect(learned.characters.kiet.episodes.meet.routes).toEqual([
    "listen",
    "lead",
  ]);
  const memories = getJourneyKeepsakes(learned, "kiet", "campus");
  expect(memories).toHaveLength(2);
  expect(memories.every((memory) => memory.id.startsWith("campus-kiet-"))).toBe(
    true,
  );
  await player(page)
    .getByRole("button", { name: "別のルートも試す", exact: true })
    .click();
  await play(page, second);
  expect((await campusRelationship(page)).characters.kiet.affinity).toBe(
    affinity,
  );
  expect(
    getJourneyKeepsakes(await campusLearning(page), "kiet", "campus"),
  ).toHaveLength(2);
  expectProtected(before, await snapshot(page));
});

test("学園の不正な原文は明示置換まで保護し、街の2キーは復旧操作でも変更しない", async ({
  page,
}) => {
  const broken = "{broken-campus-story";
  const future = '{"version":99,"future":"campus-note"}';
  await prepare(page, {
    campusRelationshipRaw: broken,
    campusLearningRaw: future,
  });
  await page.goto("/romance/campus");
  const before = await snapshot(page);
  await setup(page);
  expect(await raw(page, campusKeys.relationshipKey)).toBe(broken);
  expect(await raw(page, campusKeys.learningKey)).toBe(future);
  await course(page)
    .getByRole("button", {
      name: "このコースの保存データを置き換える",
      exact: true,
    })
    .click();
  const relationshipDialog = page.getByRole("dialog", {
    name: "保存データを置き換えますか",
    exact: true,
  });
  await relationshipDialog
    .getByRole("button", { name: "このコースの記録で置き換える", exact: true })
    .click();
  expect((await campusRelationship(page)).profile?.gender).toBe("male");
  expect(await raw(page, campusKeys.learningKey)).toBe(future);
  await course(page)
    .getByRole("button", {
      name: "会話パスポートの保存を置き換える",
      exact: true,
    })
    .click();
  const learningDialog = page.getByRole("dialog", {
    name: "会話パスポートの保存を置き換えますか",
    exact: true,
  });
  await learningDialog
    .getByRole("button", {
      name: "会話パスポートの記録で置き換える",
      exact: true,
    })
    .click();
  expect((await campusLearning(page)).characters).toEqual({});
  expectProtected(before, await snapshot(page));
});

test("学園の会話ノートだけ保存拒否でも文字200%で続け、物語の保存と区別する", async ({
  page,
}) => {
  await prepare(page, { denyLearningWrites: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/romance/campus");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const before = await snapshot(page);
  await setup(page);
  await openCharacter(page, "mali");
  await openEpisode(page, "meet");
  await play(page, getJourneyPlan("mali", "meet", "lead", "male", "campus"));
  await expect(player(page).locator(".rj-save-status")).toContainText(
    "物語のしおり：このブラウザに保存しました",
  );
  await expect(player(page).locator(".rj-save-status")).toContainText(
    "会話のノート：このタブの記録",
  );
  await expect(
    course(page).getByTestId("romance-learning-notice"),
  ).toContainText("保存できません");
  expect(await raw(page, campusKeys.learningKey)).toBeNull();
  expect(
    (await campusRelationship(page)).characters.mali.episodes.meet,
  ).toBeDefined();
  await backToChapters(page);
  await expect(course(page).getByTestId("romance-passport")).toContainText(
    "練習した",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
  expectProtected(before, await snapshot(page));
  await page.reload();
  await openCharacter(page, "mali");
  await expect(course(page)).toContainText(
    "物語の記録あり・新しい練習はこれから",
  );
  expect(await raw(page, campusKeys.learningKey)).toBeNull();
});

test("夜間講座の5話を最後まで進め、学園だけの思い出と会話記録を残す", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await prepare(page);
  await page.goto("/romance/campus");
  const before = await snapshot(page);
  await setup(page);
  await openCharacter(page, "mali");
  for (const episode of romanceEpisodes) {
    await openEpisode(page, episode.id);
    const plan = getJourneyPlan("mali", episode.id, "lead", "male", "campus");
    await expect(player(page)).toContainText(plan.scene.intro);
    await play(page, plan);
    await expect(player(page)).toContainText(plan.route.nextHook);
    await backToChapters(page);
  }
  expect(
    Object.keys((await campusRelationship(page)).characters.mali.episodes),
  ).toHaveLength(5);
  const learned = await campusLearning(page);
  expect(Object.keys(learned.characters.mali.episodes)).toHaveLength(5);
  expect(getJourneyKeepsakes(learned, "mali", "campus")).toHaveLength(5);
  expectProtected(before, await snapshot(page));
  expect((await probe(page)).mic).toBe(0);
});

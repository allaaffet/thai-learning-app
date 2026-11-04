import { expect, test, type Page } from "@playwright/test";
import { lessons } from "../src/data/curriculum";
import {
  getRomanceCharacter,
  getRomanceQuestions,
  romanceEpisodes,
} from "../src/data/romance";
import { ROMANCE_DIALOGUE_CURRICULUM_ID } from "../src/data/romance-dialogue";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  isRomanceState,
  setRomanceProfile,
  type RomanceState,
} from "../src/lib/romance";
import {
  completeRomanceLearning,
  createEmptyRomanceLearning,
  getJourneyPlan,
  getJourneyRecoveryActivities,
  isRomanceLearningState,
  type JourneyActivity,
  type JourneyAttempt,
  type JourneyPlan,
  type RomanceLearningState,
} from "../src/lib/romance-journey";
import {
  romanceSettings,
  type RomanceSetting,
} from "../src/lib/romance-setting";
import type { RomanceGender } from "../src/lib/romance-types";
import {
  completeLesson,
  createEmptyProgress,
  getTotalXp,
  PROGRESS_STORAGE_KEY,
} from "../src/lib/progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });
const now = "2026-11-04T09:00:00.000Z";
const course = (page: Page) =>
  page.getByRole("region", { name: "恋するタイ語", exact: true });
const player = (page: Page) =>
  page.getByRole("region", { name: "会話と物語のレッスン", exact: true });
const card = (page: Page) => player(page).locator("[data-activity-id]");
const passport = (page: Page) => course(page).getByTestId("romance-passport");

interface DialogueProbe {
  calls: { text: string; lang: string; trusted: boolean }[];
  mic: number;
}
declare global {
  interface Window {
    __romanceDialogueProbe: DialogueProbe;
  }
}

function correctAttempts(plan: JourneyPlan): JourneyAttempt[] {
  return plan.activities.flatMap((activity): JourneyAttempt[] => {
    if (activity.kind === "model") return [];
    return [
      {
        activityId: activity.id,
        response:
          activity.kind === "build"
            ? { kind: "build", wordIds: [...activity.acceptedWordIds[0]] }
            : { kind: "choice", choiceId: activity.question.answerIds[0] },
        usedHint: false,
      },
    ];
  });
}

/** Old v1 stores aggregates, not the old Thai or problem IDs. */
function previousHistory(
  gender: RomanceGender,
  characterId: string,
  setting: RomanceSetting,
) {
  let relationship = setRomanceProfile(createEmptyRomance(), gender, "calm");
  let learning = createEmptyRomanceLearning();
  for (const episode of romanceEpisodes) {
    const plan = getJourneyPlan(
      characterId,
      episode.id,
      "listen",
      gender,
      setting,
    );
    relationship = completeRomanceEpisode(relationship, {
      characterId,
      episodeId: episode.id,
      sessionId: `previous-relationship-${characterId}-${episode.id}`,
      answers: getRomanceQuestions(characterId, episode.id).map((question) => ({
        stepId: question.id,
        choiceId: question.answerIds[0],
      })),
      storyChoiceId: `${episode.id}-gentle`,
      now,
    }).state;
    learning = completeRomanceLearning(learning, {
      characterId,
      episodeId: episode.id,
      routeId: "listen",
      gender,
      setting,
      sessionId: `previous-learning-${characterId}-${episode.id}`,
      attempts: correctAttempts(plan),
      storyChoiceId: `${episode.id}-gentle`,
      now,
    }).state;
    Reflect.deleteProperty(
      learning.characters[characterId].episodes[episode.id],
      "curriculumId",
    );
  }
  expect(isRomanceState(relationship)).toBe(true);
  expect(isRomanceLearningState(learning)).toBe(true);
  return { relationship, learning };
}

async function prepare(
  page: Page,
  setting: RomanceSetting,
  relationship: RomanceState,
  learning = createEmptyRomanceLearning(),
) {
  await page.clock.setFixedTime(new Date(now));
  const other = setting === "city" ? "campus" : "city";
  const firstLesson = lessons[0];
  if (!firstLesson) throw new Error("Missing main lesson");
  const mainProgress = completeLesson(createEmptyProgress(), firstLesson, {
    correct: firstLesson.exercises.length,
    total: firstLesson.exercises.length,
    now,
  }).progress;
  expect(getTotalXp(mainProgress)).toBeGreaterThan(0);
  await page.addInitScript(
    (values) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const probe: DialogueProbe = { calls: [], mic: 0 };
      window.__romanceDialogueProbe = probe;
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
              name: "Dialogue Thai test voice",
              lang: "th-TH",
              voiceURI: "dialogue-th",
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
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia() {
            probe.mic += 1;
            return Promise.reject(
              new Error("Dialogue must not request a microphone"),
            );
          },
        },
      });
    },
    [
      [romanceSettings[setting].relationshipKey, JSON.stringify(relationship)],
      [romanceSettings[setting].learningKey, JSON.stringify(learning)],
      [
        romanceSettings[other].relationshipKey,
        JSON.stringify(setRomanceProfile(createEmptyRomance(), "male", "warm")),
      ],
      [
        romanceSettings[other].learningKey,
        JSON.stringify(createEmptyRomanceLearning()),
      ],
      [PROGRESS_STORAGE_KEY, JSON.stringify(mainProgress)],
      [REVIEW_STORAGE_KEY, JSON.stringify(createEmptyReview())],
    ],
  );
}

async function snapshot(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}
function expectProtected(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
  setting: RomanceSetting,
) {
  for (const [key, value] of Object.entries(before)) {
    if (
      key === romanceSettings[setting].relationshipKey ||
      key === romanceSettings[setting].learningKey
    )
      continue;
    expect(after[key]).toBe(value);
  }
}
async function storedLearning(
  page: Page,
  setting: RomanceSetting,
): Promise<RomanceLearningState> {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    romanceSettings[setting].learningKey,
  );
  const parsed: unknown = raw === null ? null : JSON.parse(raw);
  if (!isRomanceLearningState(parsed))
    throw new Error("Invalid dialogue learning record");
  return parsed;
}
async function openCharacter(page: Page, characterId: string) {
  const person = getRomanceCharacter(characterId);
  if (!person) throw new Error("Missing dialogue character");
  await course(page)
    .getByRole("button", { name: `${person.name} と会話する`, exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
}
async function openEpisode(page: Page, episodeId: string) {
  await course(page).locator(`button[data-episode-id="${episodeId}"]`).click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "route");
  await expect(player(page)).not.toContainText(/トイレ|20バーツ|店員役/u);
}
async function answerActivity(
  page: Page,
  activity: Exclude<JourneyActivity, { kind: "model" }>,
  variant: number,
  wrong: boolean,
): Promise<JourneyAttempt> {
  await expect(card(page)).toHaveAttribute("data-activity-id", activity.id);
  const question = activity.question;
  let response: JourneyAttempt["response"];
  if (activity.kind === "build") {
    const ids =
      activity.acceptedWordIds[variant % activity.acceptedWordIds.length];
    for (const id of ids)
      await card(page)
        .locator(`.rj-token-bank button[data-word-id="${id}"]`)
        .click();
    response = { kind: "build", wordIds: [...ids] };
    await card(page)
      .getByRole("button", { name: "組み立てた返答を確認", exact: true })
      .click();
  } else {
    await expect(card(page).locator(".rj-chat-bubble")).toContainText(
      question.npc.thai,
    );
    const choice = question.choices.find((entry) =>
      wrong
        ? !question.answerIds.includes(entry.id)
        : entry.id === question.answerIds[variant % question.answerIds.length],
    );
    if (!choice) throw new Error("Missing dialogue answer");
    const before = await page.evaluate(
      () => window.__romanceDialogueProbe.calls.length,
    );
    await card(page)
      .getByRole("radio", { name: choice.phrase.thai, exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__romanceDialogueProbe.calls.length),
      )
      .toBe(before + 1);
    expect(
      await page.evaluate(() => window.__romanceDialogueProbe.calls.at(-1)),
    ).toEqual({ text: choice.phrase.thai, lang: "th-TH", trusted: true });
    response = { kind: "choice", choiceId: choice.id };
    await card(page)
      .getByRole("button", { name: "返答を確認", exact: true })
      .click();
    await expect(card(page).locator(".rj-feedback")).toContainText(
      choice.explanation,
    );
  }
  await expect(card(page).locator(".rj-feedback")).toHaveAttribute(
    "data-correct",
    wrong ? "false" : "true",
  );
  await expect(card(page).locator(".rj-feedback")).toContainText(
    question.explanation,
  );
  await card(page)
    .getByRole("button", { name: "次のステップへ", exact: true })
    .click();
  return { activityId: activity.id, response, usedHint: false };
}
async function play(
  page: Page,
  plan: JourneyPlan,
  variant: number,
  wrongFirstCore = false,
) {
  await player(page).locator(`button[data-route-id="${plan.routeId}"]`).click();
  await expect(player(page)).toContainText(plan.route.scene);
  await expect(player(page)).not.toContainText(/トイレ|20バーツ|店員役/u);
  await player(page)
    .getByRole("button", { name: "会話をはじめる", exact: true })
    .click();
  const attempts: JourneyAttempt[] = [];
  let madeMistake = false;
  for (const activity of plan.activities) {
    await expect(card(page)).toHaveAttribute("data-activity-id", activity.id);
    if (activity.kind === "model") {
      for (let index = 0; index < activity.models.length; index += 1) {
        await expect(card(page)).toContainText(activity.models[index].npc.thai);
        await card(page)
          .getByRole("button", {
            name:
              index < activity.models.length - 1
                ? "次のお手本へ"
                : "このことばを使ってみる",
            exact: true,
          })
          .click();
      }
    } else {
      const wrong =
        wrongFirstCore &&
        !madeMistake &&
        activity.kind === "respond" &&
        activity.purpose === "core";
      if (wrong) madeMistake = true;
      attempts.push(await answerActivity(page, activity, variant, wrong));
    }
  }
  for (const repair of getJourneyRecoveryActivities(plan, attempts))
    await answerActivity(page, repair, variant, false);
  await expect(player(page)).toHaveAttribute("data-journey-stage", "story");
  await player(page)
    .getByRole("radio", { name: plan.route.wrapChoices[1].label, exact: true })
    .click();
  await player(page)
    .getByRole("button", { name: "今日のページを振り返る", exact: true })
    .click();
  await player(page)
    .getByRole("button", { name: "今日の会話を記録する", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "result");
  await player(page)
    .getByRole("button", { name: "次のページへ", exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
}

for (const [setting, gender, characterId] of [
  ["city", "male", "rin"],
  ["campus", "female", "niran"],
] as const) {
  test(`${setting}: 旧5話の記録を保ち、また会いたいという新会話だけを新しい実施として保存する`, async ({
    page,
  }) => {
    const old = previousHistory(gender, characterId, setting);
    await prepare(page, setting, old.relationship, old.learning);
    await page.goto(romanceSettings[setting].href);
    const before = await snapshot(page);
    await openCharacter(page, characterId);
    await expect(
      passport(page).locator('li[data-practiced="false"]'),
    ).toHaveCount(5);
    await expect(passport(page)).toContainText("以前の会話の記録");
    await expect(passport(page).locator(".rjp-total")).toHaveText(
      /0\s*\/\s*5/u,
    );
    for (const episode of romanceEpisodes)
      await expect(
        course(page).locator(`button[data-episode-id="${episode.id}"]`),
      ).toBeEnabled();
    expect(await snapshot(page)).toEqual(before);
    await openEpisode(page, "walk");
    const plan = getJourneyPlan(characterId, "walk", "lead", gender, setting);
    expect(
      plan.activities.filter(
        (activity) =>
          activity.kind === "respond" && activity.purpose === "core",
      )[0].question.npc.thai,
    ).toContain("อยากเจอคุณอีก");
    await play(page, plan, 1);
    const learned = await storedLearning(page, setting);
    expect(learned.characters[characterId].episodes.walk.curriculumId).toBe(
      ROMANCE_DIALOGUE_CURRICULUM_ID,
    );
    for (const episode of romanceEpisodes.filter(
      (entry) => entry.id !== "walk",
    ))
      expect(
        learned.characters[characterId].episodes[episode.id].curriculumId,
      ).toBeUndefined();
    await expect(
      passport(page).locator('li[data-practiced="true"]'),
    ).toHaveCount(1);
    await expect(passport(page).locator(".rjp-total")).toHaveText(
      /1\s*\/\s*5/u,
    );
    const after = await snapshot(page);
    expectProtected(before, after, setting);
    const rawRelationship: unknown = JSON.parse(
      after[romanceSettings[setting].relationshipKey] ?? "null",
    );
    if (!isRomanceState(rawRelationship))
      throw new Error("Invalid saved relationship");
    expect(rawRelationship.characters[characterId].affinity).toBe(
      old.relationship.characters[characterId].affinity,
    );
    await page.reload();
    await openCharacter(page, characterId);
    await expect(
      passport(page).locator('li[data-practiced="true"]'),
    ).toHaveCount(1);
    await expect(passport(page).locator(".rjp-total")).toHaveText(
      /1\s*\/\s*5/u,
    );
    expect(await snapshot(page)).toEqual(after);
    expect(await page.evaluate(() => window.__romanceDialogueProbe.mic)).toBe(
      0,
    );
  });

  test(`${setting}: 出会いから隣席への恋愛会話を聞いて返し、言い直しても最初の成績を保つ`, async ({
    page,
  }) => {
    await prepare(
      page,
      setting,
      setRomanceProfile(createEmptyRomance(), gender, "calm"),
    );
    await page.goto(romanceSettings[setting].href);
    const before = await snapshot(page);
    await openCharacter(page, characterId);
    for (const [index, episodeId] of ["meet", "cafe"].entries()) {
      await openEpisode(page, episodeId);
      const plan = getJourneyPlan(
        characterId,
        episodeId,
        "lead",
        gender,
        setting,
      );
      const questions = getRomanceQuestions(characterId, episodeId);
      expect(questions[index === 0 ? 1 : 0].npc.thai).toContain(
        index === 0 ? "คุยด้วยได้ไหม" : "นั่งด้วยได้ไหม",
      );
      await play(page, plan, index, index === 0);
    }
    const after = await snapshot(page);
    expectProtected(before, after, setting);
    const rawRelationship: unknown = JSON.parse(
      after[romanceSettings[setting].relationshipKey] ?? "null",
    );
    if (!isRomanceState(rawRelationship))
      throw new Error("Invalid saved dialogue scores");
    expect(
      rawRelationship.characters[characterId].episodes.meet.bestCorrect,
    ).toBe(2);
    expect(
      rawRelationship.characters[characterId].episodes.cafe.bestCorrect,
    ).toBe(3);
    const learned = await storedLearning(page, setting);
    expect(learned.characters[characterId].episodes.meet.last.coreCorrect).toBe(
      2,
    );
    expect(learned.characters[characterId].episodes.cafe.last.coreCorrect).toBe(
      3,
    );
    for (const episodeId of ["meet", "cafe"])
      expect(
        learned.characters[characterId].episodes[episodeId].curriculumId,
      ).toBe(ROMANCE_DIALOGUE_CURRICULUM_ID);
    await expect(
      passport(page).locator('li[data-practiced="true"]'),
    ).toHaveCount(2);
    await expect(passport(page).locator(".rjp-total")).toHaveText(
      /2\s*\/\s*5/u,
    );
    expect(await page.evaluate(() => window.__romanceDialogueProbe.mic)).toBe(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
}

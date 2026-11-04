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
  setRomanceProfile,
} from "../src/lib/romance";
import {
  completeRomanceLearning,
  createEmptyRomanceLearning,
  getJourneyPlan,
  getJourneyStoryEnding,
  isRomanceLearningState,
  type JourneyAttempt,
  type JourneyPlan,
} from "../src/lib/romance-journey";
import {
  romanceExpressionIds,
  romanceExpressions,
  type RomanceExpression,
} from "../src/lib/romance-expressions";
import {
  romanceSettings,
  type RomanceSetting,
} from "../src/lib/romance-setting";
import type { RomanceCharacter, RomanceGender } from "../src/lib/romance-types";
import { createEmptyProgress, PROGRESS_STORAGE_KEY } from "../src/lib/progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });
const now = "2026-11-04T09:00:00.000Z";
const course = (page: Page) =>
  page.getByRole("region", { name: "恋するタイ語", exact: true });
const player = (page: Page) =>
  page.getByRole("region", { name: "会話と物語のレッスン", exact: true });
const card = (page: Page) => player(page).locator("[data-activity-id]");

function correctAttempts(plan: JourneyPlan): JourneyAttempt[] {
  return plan.activities.flatMap((activity): JourneyAttempt[] =>
    activity.kind === "model"
      ? []
      : [
          {
            activityId: activity.id,
            response:
              activity.kind === "build"
                ? { kind: "build", wordIds: [...activity.acceptedWordIds[0]] }
                : { kind: "choice", choiceId: activity.question.answerIds[0] },
            usedHint: false,
          },
        ],
  );
}

function priorHistory(
  gender: RomanceGender,
  characterId: string,
  setting: RomanceSetting,
) {
  let relationship = setRomanceProfile(createEmptyRomance(), gender, "calm");
  let learning = createEmptyRomanceLearning();
  for (const episode of romanceEpisodes) {
    relationship = completeRomanceEpisode(relationship, {
      characterId,
      episodeId: episode.id,
      sessionId: `portrait-prior-relationship-${characterId}-${episode.id}`,
      answers: getRomanceQuestions(characterId, episode.id).map((question) => ({
        stepId: question.id,
        choiceId: question.answerIds[0],
      })),
      storyChoiceId: `${episode.id}-gentle`,
      now,
    }).state;
    const plan = getJourneyPlan(
      characterId,
      episode.id,
      "listen",
      gender,
      setting,
    );
    learning = completeRomanceLearning(learning, {
      characterId,
      episodeId: episode.id,
      routeId: "listen",
      gender,
      setting,
      sessionId: `portrait-prior-learning-${characterId}-${episode.id}`,
      attempts: correctAttempts(plan),
      storyChoiceId: `${episode.id}-gentle`,
      now,
    }).state;
    // Simulate the pre-curriculum v1 aggregate while retaining real story IDs.
    delete learning.characters[characterId].episodes[episode.id].curriculumId;
  }
  return { relationship, learning };
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

async function expectPortrait(
  frame: Locator,
  character: RomanceCharacter,
  expression: RomanceExpression,
) {
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("data-expression", expression);
  await expect(frame).toHaveAttribute(
    "aria-label",
    `${character.name}（${character.age}歳）のイラスト・${romanceExpressions[expression].label}`,
  );
  const img = frame.locator("img");
  await expect
    .poll(async () => {
      const src = await img.getAttribute("src");
      if (!src) return null;
      const url = new URL(src, "http://127.0.0.1:3000");
      return url.searchParams.get("url") ?? url.pathname;
    })
    .toBe(romanceExpressions[expression].src);
  await expect(img).toHaveJSProperty("complete", true);
  expect(
    await img.evaluate((image) =>
      image instanceof HTMLImageElement ? image.naturalWidth : 0,
    ),
  ).toBeGreaterThan(0);
  expect(
    await img.evaluate((image) => ({
      left: image.style.left,
      top: image.style.top,
      width: image.style.width,
      height: image.style.height,
    })),
  ).toEqual({
    left: `${character.portrait.column * -100}%`,
    top: `${character.portrait.row * -100}%`,
    width: "300%",
    height: "200%",
  });
  const bounds = await frame.boundingBox();
  if (!bounds) throw new Error("Missing portrait frame");
  expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(1);
}

async function playToStory(page: Page, plan: JourneyPlan) {
  await player(page).locator(`button[data-route-id="${plan.routeId}"]`).click();
  await player(page)
    .getByRole("button", { name: "会話をはじめる", exact: true })
    .click();
  for (const activity of plan.activities) {
    await expect(card(page)).toHaveAttribute("data-activity-id", activity.id);
    if (activity.kind === "model") {
      for (let index = 0; index < activity.models.length; index++)
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
      for (const wordId of activity.acceptedWordIds[0])
        await card(page)
          .locator(`.rj-token-bank button[data-word-id="${wordId}"]`)
          .click();
      await card(page)
        .getByRole("button", { name: "組み立てた返答を確認", exact: true })
        .click();
    } else {
      const accepted = activity.question.choices.find(
        (choice) => choice.id === activity.question.answerIds[0],
      );
      if (!accepted) throw new Error("Missing registered reply");
      await card(page)
        .getByRole("radio", { name: accepted.phrase.thai, exact: true })
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

test("既存4枚と夜の2表情をPNGとして配信し、6人の3列2行を保持する", async ({
  page,
}) => {
  expect(romanceExpressionIds).toContain("romantic");
  expect(romanceExpressionIds).toContain("blushing");
  for (const expression of romanceExpressionIds) {
    const response = await page.request.get(romanceExpressions[expression].src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect([...bytes.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
      1536, 1024,
    ]);
  }
});

for (const [setting, gender, characterId] of [
  ["city", "male", "rin"],
  ["campus", "female", "niran"],
] as const) {
  test(`${setting}: 締めの選択で夜の表情が変わり、保存した選択を再読込後の肖像へ戻す`, async ({
    page,
  }) => {
    const person = getRomanceCharacter(characterId);
    if (!person) throw new Error("Missing portrait character");
    const history = priorHistory(gender, characterId, setting);
    const previousEnding = getJourneyStoryEnding(
      history.learning,
      characterId,
      setting,
    );
    if (!previousEnding) throw new Error("Missing saved story ending");
    await page.clock.setFixedTime(new Date(now));
    const other = setting === "city" ? "campus" : "city";
    await page.addInitScript(
      (entries) => {
        for (const [key, value] of entries)
          if (localStorage.getItem(key) === null)
            localStorage.setItem(key, value);
      },
      [
        [
          romanceSettings[setting].relationshipKey,
          JSON.stringify(history.relationship),
        ],
        [
          romanceSettings[setting].learningKey,
          JSON.stringify(history.learning),
        ],
        [
          romanceSettings[other].relationshipKey,
          JSON.stringify(
            setRomanceProfile(createEmptyRomance(), "male", "warm"),
          ),
        ],
        [
          romanceSettings[other].learningKey,
          JSON.stringify(createEmptyRomanceLearning()),
        ],
        [PROGRESS_STORAGE_KEY, JSON.stringify(createEmptyProgress())],
        [REVIEW_STORAGE_KEY, JSON.stringify(createEmptyReview())],
      ],
    );
    await page.goto(romanceSettings[setting].href);
    await course(page)
      .getByRole("button", { name: `${person.name} と会話する`, exact: true })
      .click();
    await expectPortrait(
      course(page).locator(".rc-character-portrait"),
      person,
      previousEnding.expression,
    );
    await expect(course(page).locator(".rc-ending")).toContainText(
      previousEnding.reaction,
    );
    const before = await snapshot(page);
    await course(page).locator('button[data-episode-id="walk"]').click();
    const plan = getJourneyPlan(characterId, "walk", "lead", gender, setting);
    expect(
      new Set(plan.route.wrapChoices.map((choice) => choice.expression)),
    ).toEqual(new Set(["romantic", "blushing"]));
    await playToStory(page, plan);
    for (const choice of plan.route.wrapChoices) {
      await player(page)
        .getByRole("radio", { name: choice.label, exact: true })
        .click();
      await expect(player(page)).toContainText(choice.reaction);
      await expectPortrait(
        player(page).locator(".rj-portrait"),
        person,
        choice.expression,
      );
      expect(await snapshot(page)).toEqual(before);
    }
    const picked = plan.route.wrapChoices[1];
    await player(page)
      .getByRole("button", { name: "今日のページを振り返る", exact: true })
      .click();
    await player(page)
      .getByRole("button", { name: "今日の会話を記録する", exact: true })
      .click();
    await expect(player(page)).toHaveAttribute("data-journey-stage", "result");
    await expectPortrait(
      player(page).locator(".rj-portrait"),
      person,
      picked.expression,
    );
    await expect(player(page)).toContainText(
      picked.nextHook ?? plan.route.nextHook,
    );
    const after = await snapshot(page);
    for (const [key, value] of Object.entries(before))
      if (
        key !== romanceSettings[setting].learningKey &&
        key !== romanceSettings[setting].relationshipKey
      )
        expect(after[key]).toBe(value);
    const replayed: unknown = JSON.parse(
      after[romanceSettings[setting].relationshipKey] ?? "null",
    );
    if (!isRomanceState(replayed))
      throw new Error("Invalid replayed relationship");
    expect(replayed.characters[characterId].affinity).toBe(
      history.relationship.characters[characterId].affinity,
    );
    expect(replayed.characters[characterId].episodes.walk.plays).toBe(
      history.relationship.characters[characterId].episodes.walk.plays + 1,
    );
    const saved: unknown = JSON.parse(
      after[romanceSettings[setting].learningKey] ?? "null",
    );
    if (!isRomanceLearningState(saved))
      throw new Error("Invalid stored portrait choice");
    expect(saved.characters[characterId].episodes.walk.lastStory).toEqual({
      routeId: "lead",
      choiceId: picked.storyChoiceId,
    });
    expect(getJourneyStoryEnding(saved, characterId, setting)?.expression).toBe(
      picked.expression,
    );
    await page.reload();
    await course(page)
      .getByRole("button", { name: `${person.name} と会話する`, exact: true })
      .click();
    await expectPortrait(
      course(page).locator(".rc-character-portrait"),
      person,
      picked.expression,
    );
    await expect(course(page).locator(".rc-ending")).toContainText(
      picked.reaction,
    );
    await expect(course(page).locator(".rc-ending")).toContainText(
      picked.nextHook ?? plan.route.nextHook,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
}

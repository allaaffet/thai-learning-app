import { expect, test, type Page } from "@playwright/test";
import { getRomanceCharacter, getRomanceQuestions } from "../src/data/romance";
import { getEnsembleCast } from "../src/data/romance-ensemble";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  setRomanceProfile,
  type RomanceState,
} from "../src/lib/romance";
import {
  createEmptyRomanceLearning,
  getJourneyPlan,
  isRomanceLearningState,
  type JourneyPlan,
} from "../src/lib/romance-journey";
import {
  romanceSettings,
  type RomanceSetting,
} from "../src/lib/romance-setting";
import type { RomanceGender } from "../src/lib/romance-types";
import { createEmptyProgress, PROGRESS_STORAGE_KEY } from "../src/lib/progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });
const now = "2026-11-03T09:00:00.000Z";
const course = (page: Page) =>
  page.getByRole("region", { name: "恋するタイ語", exact: true });
const ensemble = (page: Page) =>
  page.getByRole("region", { name: "三人からのお誘い", exact: true });
const player = (page: Page) =>
  page.getByRole("region", { name: "会話と物語のレッスン", exact: true });
const card = (page: Page) => player(page).locator("[data-activity-id]");

function relationship(gender: RomanceGender, characterId?: string) {
  const initial = setRomanceProfile(createEmptyRomance(), gender, "curious");
  return characterId
    ? completeRomanceEpisode(initial, {
        characterId,
        episodeId: "meet",
        sessionId: `prior-${characterId}-meet`,
        answers: getRomanceQuestions(characterId, "meet").map((question) => ({
          stepId: question.id,
          choiceId: question.answerIds[0],
        })),
        storyChoiceId: "meet-thoughtful",
        now,
      }).state
    : initial;
}

async function prepare(
  page: Page,
  setting: RomanceSetting,
  state: RomanceState,
) {
  await page.clock.setFixedTime(new Date(now));
  const other = setting === "city" ? "campus" : "city";
  await page.addInitScript(
    (values) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
    },
    [
      [romanceSettings[setting].relationshipKey, JSON.stringify(state)],
      [
        romanceSettings[setting].learningKey,
        JSON.stringify(createEmptyRomanceLearning()),
      ],
      [
        romanceSettings[other].relationshipKey,
        JSON.stringify(relationship("male", "mali")),
      ],
      [
        romanceSettings[other].learningKey,
        JSON.stringify(createEmptyRomanceLearning()),
      ],
      [PROGRESS_STORAGE_KEY, JSON.stringify(createEmptyProgress())],
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

async function startInvitation(page: Page, characterId: string) {
  await ensemble(page)
    .locator(`button[data-ensemble-person-id="${characterId}"]`)
    .click();
  await expect(ensemble(page)).toHaveAttribute(
    "data-ensemble-stage",
    "reaction",
  );
  await ensemble(page)
    .getByRole("button", { name: "二人の場面へ", exact: true })
    .click();
  await expect(player(page)).toHaveAttribute("data-journey-stage", "route");
}

async function completeActivities(page: Page, plan: JourneyPlan) {
  await player(page).locator(`button[data-route-id="${plan.routeId}"]`).click();
  await player(page)
    .getByRole("button", { name: "会話をはじめる", exact: true })
    .click();
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
      for (const id of activity.acceptedWordIds[0])
        await card(page)
          .locator(`.rj-token-bank button[data-word-id="${id}"]`)
          .click();
      await card(page)
        .getByRole("button", { name: "組み立てた返答を確認", exact: true })
        .click();
    } else {
      const choice = activity.question.choices.find(
        (entry) => entry.id === activity.question.answerIds[0],
      );
      if (!choice) throw new Error("Missing registered answer");
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

for (const [setting, gender, characterId] of [
  ["city", "male", "mali"],
  ["campus", "female", "kiet"],
] as const) {
  test(`${setting}: 三人の掛け合いと反応は保存せず、選んだ相手の続きへ進む`, async ({
    page,
  }) => {
    await prepare(page, setting, relationship(gender, characterId));
    await page.goto(romanceSettings[setting].href);
    await expect(ensemble(page)).toHaveAttribute(
      "data-ensemble-stage",
      "invites",
    );
    const before = await snapshot(page);
    const cast = getEnsembleCast(gender);
    await expect(
      ensemble(page).locator("button[data-ensemble-person-id]"),
    ).toHaveCount(3);
    expect(
      await ensemble(page)
        .locator("button[data-ensemble-person-id]")
        .evaluateAll((buttons) =>
          buttons
            .map((button) => button.getAttribute("data-ensemble-person-id"))
            .sort(),
        ),
    ).toEqual([...cast].sort());
    await expect(course(page).locator("button[data-character-id]")).toHaveCount(
      3,
    );
    await ensemble(page)
      .getByRole("button", { name: "みんなと話す", exact: true })
      .click();
    await expect(ensemble(page)).toHaveAttribute(
      "data-ensemble-stage",
      "group",
    );
    await expect(
      ensemble(page).getByRole("heading", {
        name: "今は、みんなと一緒に。",
        exact: true,
      }),
    ).toBeFocused();
    expect(
      await ensemble(page).locator(".re-dialogue li").count(),
    ).toBeGreaterThanOrEqual(4);
    for (const id of cast) {
      const person = getRomanceCharacter(id);
      if (!person) throw new Error("Missing invited person");
      await expect(ensemble(page).locator(".re-dialogue")).toContainText(
        person.name,
      );
    }
    expect(await snapshot(page)).toEqual(before);
    await ensemble(page)
      .locator(`button[data-ensemble-person-id="${characterId}"]`)
      .click();
    await expect(ensemble(page)).toHaveAttribute(
      "data-ensemble-stage",
      "reaction",
    );
    await expect(ensemble(page).locator(".re-dialogue li")).toHaveCount(3);
    expect(await snapshot(page)).toEqual(before);
    await ensemble(page)
      .getByRole("button", { name: "二人の場面へ", exact: true })
      .click();
    await expect(player(page)).toHaveAttribute("data-journey-stage", "route");
    await expect(player(page)).toContainText(
      getJourneyPlan(characterId, "cafe", "listen", gender, setting).chapter
        .skillTitle,
    );
    expect(await snapshot(page)).toEqual(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

for (const [setting, gender, characterId] of [
  ["city", "male", "rin"],
  ["campus", "female", "niran"],
] as const) {
  test(`${setting}: 選んだ返事の表情と予告を記録し、再読込後の次話に引き継ぐ`, async ({
    page,
  }) => {
    await prepare(page, setting, relationship(gender));
    await page.goto(romanceSettings[setting].href);
    await expect(ensemble(page)).toBeVisible();
    const before = await snapshot(page);
    await startInvitation(page, characterId);
    const plan = getJourneyPlan(characterId, "meet", "lead", gender, setting);
    const choice = plan.route.wrapChoices.find(
      (entry) => entry.storyChoiceId === "meet-gentle",
    );
    if (!choice?.nextHook)
      throw new Error("Choice must have its own next scene");
    await completeActivities(page, plan);
    await player(page)
      .getByRole("radio", { name: choice.label, exact: true })
      .click();
    await expect(player(page)).toContainText(choice.reaction);
    await expect(player(page).locator(".rj-character-scene")).toHaveAttribute(
      "data-expression",
      choice.expression,
    );
    expect(await snapshot(page)).toEqual(before);
    await player(page)
      .getByRole("button", { name: "今日のページを振り返る", exact: true })
      .click();
    await player(page)
      .getByRole("button", { name: "今日の会話を記録する", exact: true })
      .click();
    await expect(player(page)).toHaveAttribute("data-journey-stage", "result");
    await expect(player(page).locator(".rj-character-scene")).toHaveAttribute(
      "data-expression",
      choice.expression,
    );
    await expect(player(page)).toContainText(choice.nextHook);
    const after = await snapshot(page);
    const stored: unknown = JSON.parse(
      after[romanceSettings[setting].learningKey] ?? "null",
    );
    if (!isRomanceLearningState(stored))
      throw new Error("Invalid saved choice data");
    expect(stored.characters[characterId].episodes.meet.lastStory).toEqual({
      routeId: "lead",
      choiceId: "meet-gentle",
    });
    for (const [key, value] of Object.entries(before)) {
      if (
        key === romanceSettings[setting].relationshipKey ||
        key === romanceSettings[setting].learningKey
      )
        continue;
      expect(after[key]).toBe(value);
    }
    await page.reload();
    await expect(ensemble(page)).toHaveAttribute(
      "data-ensemble-stage",
      "invites",
    );
    await startInvitation(page, characterId);
    const echo = player(page).getByRole("complementary", {
      name: "前の選択の続き",
      exact: true,
    });
    await expect(echo).toContainText(choice.label);
    await expect(echo).toContainText(choice.nextHook);
    expect(await snapshot(page)).toEqual(after);
  });
}

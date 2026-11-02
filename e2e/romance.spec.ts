import { expect, test, type Page } from "@playwright/test";
import {
  getRomanceCharacter,
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
} from "../src/data/romance";
import {
  createEmptyRomance,
  getRomanceCharacterProgress,
  isRomanceState,
  ROMANCE_STORAGE_KEY,
  setRomanceProfile,
  type RomanceState,
} from "../src/lib/romance";
import type {
  RomanceGender,
  RomancePreference,
} from "../src/lib/romance-types";
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
const today = "2026-11-02T09:00:00.000Z";
const otherKeys = [
  PROGRESS_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
  CONVERSATION_STORAGE_KEY,
  CHARACTER_TRAINING_STORAGE_KEY,
];

/** Speech doubles check gestures and cancellation, never the quality of Thai audio. */
async function prepare(
  page: Page,
  options: { raw?: string; denyWrites?: boolean } = {},
) {
  await page.clock.setFixedTime(new Date(today));
  await page.addInitScript(
    ({ values, raw, key, denyWrites }) => {
      for (const [name, value] of values)
        if (localStorage.getItem(name) === null)
          localStorage.setItem(name, value);
      if (raw !== undefined && localStorage.getItem(key) === null)
        localStorage.setItem(key, raw);
      const probe = {
        calls: [] as { text: string; lang: string; trusted: boolean }[],
        cancels: 0,
        writes: [] as string[],
        micRequests: 0,
      };
      Object.defineProperty(window, "__romanceProbe", { value: probe });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        probe.writes.push(name);
        if (name === key && denyWrites)
          throw new DOMException("Test storage denied", "QuotaExceededError");
        return original.call(this, name, value);
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
              name: "Romance Thai test voice",
              lang: "th-TH",
              voiceURI: "romance-th",
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
              new Error("Romance must not request the microphone"),
            );
          },
        },
      });
    },
    {
      values: [
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
      raw: options.raw,
      key: ROMANCE_STORAGE_KEY,
      denyWrites: options.denyWrites ?? false,
    },
  );
}

function course(page: Page) {
  return page.getByRole("region", { name: "恋するタイ語", exact: true });
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
async function rawRomance(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), ROMANCE_STORAGE_KEY);
}
async function savedRomance(page: Page): Promise<RomanceState> {
  const raw = await rawRomance(page);
  const parsed: unknown = raw === null ? null : JSON.parse(raw);
  if (!isRomanceState(parsed)) throw new Error("Invalid saved romance state");
  return parsed;
}
async function probe(page: Page) {
  return page.evaluate(() => {
    const state: unknown = Reflect.get(window, "__romanceProbe");
    if (!state || typeof state !== "object")
      throw new Error("Missing romance probe");
    const calls: unknown = Reflect.get(state, "calls");
    const writes: unknown = Reflect.get(state, "writes");
    if (!Array.isArray(calls) || !Array.isArray(writes))
      throw new Error("Invalid romance probe");
    return {
      calls: calls.map((call: unknown) => {
        if (!call || typeof call !== "object")
          throw new Error("Invalid speech call");
        return {
          text: String(Reflect.get(call, "text")),
          lang: String(Reflect.get(call, "lang")),
          trusted: Reflect.get(call, "trusted") === true,
        };
      }),
      writes: writes.map(String),
      cancels: Number(Reflect.get(state, "cancels")),
      micRequests: Number(Reflect.get(state, "micRequests")),
    };
  });
}
function expectOthersUnchanged(
  before: Record<string, string | null>,
  after: Record<string, string | null>,
) {
  for (const key of otherKeys) expect(after[key]).toBe(before[key]);
}
async function setup(
  page: Page,
  gender: RomanceGender,
  preference: RomancePreference,
) {
  await expect(course(page)).toHaveAttribute("data-romance-stage", "setup");
  await course(page)
    .getByRole("radio", {
      name: gender === "male" ? "男性" : "女性",
      exact: true,
    })
    .click();
  const labels = {
    warm: "明るく親しみやすい",
    calm: "穏やかで優しい",
    curious: "落ち着いて知的",
  };
  await course(page)
    .getByRole("radio", { name: new RegExp(`^${labels[preference]}`) })
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
  return character;
}
async function openEpisode(page: Page, id = "meet") {
  const episode = romanceEpisodes.find((entry) => entry.id === id);
  if (!episode) throw new Error("Missing episode");
  await course(page)
    .getByRole("button", { name: `${episode.title} をはじめる`, exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "episode");
  await expect(course(page)).toHaveAttribute("data-episode-id", id);
}
async function answerCurrent(
  page: Page,
  characterId: string,
  episodeId: string,
  correct = true,
  variant = 0,
) {
  const id = await course(page)
    .locator(".rc-player[data-step-id]")
    .getAttribute("data-step-id");
  const question = getRomanceQuestions(characterId, episodeId).find(
    (entry) => entry.id === id,
  );
  if (!question) throw new Error(`Missing question ${id}`);
  const choice = question.choices.find((entry) =>
    correct
      ? entry.id === question.answerIds[variant % question.answerIds.length]
      : !question.answerIds.includes(entry.id),
  );
  if (!choice) throw new Error("Missing answer choice");
  await course(page)
    .getByRole("radio", { name: choice.phrase.thai, exact: true })
    .click();
  await course(page)
    .getByRole("button", { name: "返答を確認", exact: true })
    .click();
  const feedback = course(page).locator('.rc-feedback[role="status"]');
  await expect(feedback).toHaveAttribute("data-correct", String(correct));
  await expect(feedback).toContainText(question.explanation);
  return question;
}
async function finishLanguage(
  page: Page,
  characterId: string,
  episodeId: string,
  correct = true,
  variant = 0,
) {
  const seen = new Set<string>();
  for (let count = 0; count < 5; count += 1) {
    if ((await course(page).getAttribute("data-romance-stage")) === "story")
      return;
    const question = await answerCurrent(
      page,
      characterId,
      episodeId,
      correct,
      variant,
    );
    if (seen.has(question.id))
      throw new Error("Question repeated without finite progress");
    seen.add(question.id);
    await course(page)
      .getByRole("button", { name: /^(次のやりとりへ|物語の選択へ)$/ })
      .click();
  }
  throw new Error("Episode exceeded its finite question count");
}
async function chooseStory(
  page: Page,
  characterId: string,
  episodeId: string,
  positive = true,
) {
  await expect(course(page)).toHaveAttribute("data-romance-stage", "story");
  const options = [...getRomanceStoryOptions(characterId, episodeId)].sort(
    (a, b) => a.affinityDelta - b.affinityDelta,
  );
  const option = positive ? options.at(-1)! : options[0];
  await course(page)
    .getByRole("radio", { name: option.label, exact: true })
    .click();
  await course(page)
    .getByRole("button", { name: "この選択で振り返る", exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "review");
  return option;
}
async function record(page: Page, twice = false) {
  const save = course(page).getByRole("button", {
    name: "今日の会話を記録する",
    exact: true,
  });
  if (twice)
    await save.evaluate((button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error("Missing record button");
      button.click();
      button.click();
    });
  else await save.click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "result");
  await expect(course(page).getByTestId("romance-receipt")).toBeVisible();
}
async function playMeet(
  page: Page,
  characterId = "mali",
  correct = true,
  positive = true,
) {
  await openEpisode(page);
  await finishLanguage(page, characterId, "meet", correct);
  await chooseStory(page, characterId, "meet", positive);
  await record(page);
}
async function backToCharacter(page: Page, id: string) {
  const character = getRomanceCharacter(id)!;
  await course(page)
    .getByTestId("romance-receipt")
    .getByRole("button", {
      name: `${character.name} のエピソードへ`,
      exact: true,
    })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "character");
}

test("主人公と好みを選ぶと成人の異性3人・おすすめ2人が現れ、元の学習記録は変わらない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/romance?view=classic");
  await expect(course(page)).toHaveAttribute("data-romance-stage", "setup");
  const before = await snapshot(page);
  expect((await probe(page)).writes).toEqual([]);
  await setup(page, "male", "warm");
  const roster = course(page).locator("button[data-character-id]");
  await expect(roster).toHaveCount(3);
  await expect(
    course(page).locator('button[data-character-id][data-recommended="true"]'),
  ).toHaveCount(2);
  for (const character of romanceCharacters.filter(
    (entry) => entry.gender === "female",
  )) {
    const card = course(page).locator(
      `button[data-character-id="${character.id}"]`,
    );
    await expect(card).toContainText(character.name);
    await expect(card).toContainText(String(character.age));
    expect(character.age).toBeGreaterThanOrEqual(18);
  }
  await course(page)
    .getByRole("button", { name: "主人公の設定を変更", exact: true })
    .click();
  await setup(page, "female", "curious");
  await expect(course(page).locator("button[data-character-id]")).toHaveCount(
    3,
  );
  await expect(
    course(page).locator('button[data-character-id][data-recommended="true"]'),
  ).toHaveCount(2);
  for (const character of romanceCharacters.filter(
    (entry) => entry.gender === "male",
  ))
    await expect(
      course(page).locator(`button[data-character-id="${character.id}"]`),
    ).toContainText(character.name);
  expect((await savedRomance(page)).profile).toEqual({
    gender: "female",
    preference: "curious",
  });
  expectOthersUnchanged(before, await snapshot(page));
  const image = await page.request.get("/romance/cast.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toMatch(/^image\//);
  expect((await image.body()).byteLength).toBeGreaterThan(10_000);
  expect((await probe(page)).calls).toEqual([]);
  expect((await probe(page)).micRequests).toBe(0);
});

test("会話と物語の選択を終えてから一度だけ記録し、再読込みと同日再練習で好感度を水増ししない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/romance?view=classic");
  await setup(page, "male", "calm");
  await openCharacter(page, "mali");
  const before = await snapshot(page);
  const raw = await rawRomance(page);
  const writes = (await probe(page)).writes.length;
  await openEpisode(page);
  expect((await probe(page)).calls).toEqual([]);
  await finishLanguage(page, "mali", "meet");
  await chooseStory(page, "mali", "meet");
  expect(await rawRomance(page)).toBe(raw);
  expect((await probe(page)).writes).toHaveLength(writes);
  await record(page, true);
  const first = await savedRomance(page);
  expect(first.characters.mali.affinity).toBe(13);
  expect(first.characters.mali.episodes.meet).toMatchObject({
    bestCorrect: 3,
    total: 3,
    plays: 1,
  });
  expect(first.characters.mali.lastBonusDay).toBe("2026-11-02");
  expect(first.recentSessionIds).toHaveLength(1);
  expect((await probe(page)).writes).toHaveLength(writes + 1);
  expectOthersUnchanged(before, await snapshot(page));
  await page.reload();
  await openCharacter(page, "mali");
  await playMeet(page);
  const replay = await savedRomance(page);
  expect(replay.characters.mali.affinity).toBe(first.characters.mali.affinity);
  expect(replay.characters.mali.episodes.meet.plays).toBe(2);
  expect(replay.recentSessionIds).toHaveLength(2);
  expectOthersUnchanged(before, await snapshot(page));
});

test("誤答と配慮を欠く選択では小さく下がり、翌日の継続で増え、休んだ日には下がらない", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const initial = setRomanceProfile(createEmptyRomance(), "male", "warm");
  initial.characters.mali = {
    ...getRomanceCharacterProgress(initial, "mali"),
    affinity: 40,
  };
  await prepare(page, { raw: JSON.stringify(initial) });
  await page.goto("/romance?view=classic");
  await openCharacter(page, "mali");
  await expect(
    course(page).locator('button[data-episode-id="cafe"]'),
  ).toBeDisabled();
  await playMeet(page, "mali", false, false);
  expect((await savedRomance(page)).characters.mali.affinity).toBe(39);
  await backToCharacter(page, "mali");
  await playMeet(page);
  expect((await savedRomance(page)).characters.mali.affinity).toBe(39);
  await page.clock.setFixedTime(new Date("2026-11-03T09:00:00.000Z"));
  await page.reload();
  await openCharacter(page, "mali");
  await playMeet(page);
  const nextDay = await savedRomance(page);
  expect(nextDay.characters.mali.affinity).toBe(42);
  expect(nextDay.characters.mali.streak).toBe(2);
  await page.clock.setFixedTime(new Date("2026-11-06T09:00:00.000Z"));
  await page.reload();
  await openCharacter(page, "mali");
  expect((await savedRomance(page)).characters.mali.affinity).toBe(42);
  expect((await probe(page)).writes).toEqual([]);
});

test("女性主人公では男性の相手が話し、両方の丁寧な返答を受け付け、設定変更でも関係を残す", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/romance?view=classic");
  await setup(page, "female", "curious");
  await openCharacter(page, "kiet");
  await openEpisode(page);
  const questions = getRomanceQuestions("kiet", "meet");
  await expect(course(page)).toContainText(questions[0].npc.thai);
  expect(questions[0].npc.thai).toMatch(/ครับ$/u);
  await answerCurrent(page, "kiet", "meet", true, 0);
  await course(page)
    .getByRole("button", { name: "次のやりとりへ", exact: true })
    .click();
  await finishLanguage(page, "kiet", "meet", true, 1);
  await chooseStory(page, "kiet", "meet");
  await record(page);
  const affinity = (await savedRomance(page)).characters.kiet.affinity;
  await course(page)
    .getByRole("button", { name: "ほかの人と話す", exact: true })
    .click();
  await course(page)
    .getByRole("button", { name: "主人公の設定を変更", exact: true })
    .click();
  await setup(page, "male", "calm");
  await expect(
    course(page).locator('button[data-character-id="kiet"]'),
  ).toHaveCount(0);
  expect((await savedRomance(page)).characters.kiet.affinity).toBe(affinity);
  await course(page)
    .getByRole("button", { name: "主人公の設定を変更", exact: true })
    .click();
  await setup(page, "female", "curious");
  await openCharacter(page, "kiet");
  await expect(
    course(page).getByRole("progressbar", {
      name: `${getRomanceCharacter("kiet")!.name} の好感度`,
      exact: true,
    }),
  ).toHaveJSProperty("value", affinity);
  expect((await probe(page)).micRequests).toBe(0);
});

test("不正・未知版の元データを読込みや設定選択では壊さず、このコースだけ明示的に置き換える", async ({
  page,
}) => {
  await prepare(page);
  for (const raw of ["{broken-romance", '{"version":99,"future":"keep"}']) {
    await page.goto("/romance?view=classic");
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key: ROMANCE_STORAGE_KEY,
      raw,
    });
    await page.reload();
    await expect(course(page)).toHaveAttribute("data-romance-stage", "setup");
    const before = await snapshot(page);
    expect(await rawRomance(page)).toBe(raw);
    await setup(page, "male", "warm");
    expect(await rawRomance(page)).toBe(raw);
    await course(page)
      .getByRole("button", {
        name: "このコースの保存データを置き換える",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "保存データを置き換えますか",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    expect(await rawRomance(page)).toBe(raw);
    await dialog
      .getByRole("button", {
        name: "このコースの記録で置き換える",
        exact: true,
      })
      .click();
    expect((await savedRomance(page)).profile).toEqual({
      gender: "male",
      preference: "warm",
    });
    expectOthersUnchanged(before, await snapshot(page));
  }
});

test("保存拒否で主人公の性別変更が未保存でも、新しい相手の会話をタブ内で記録できる", async ({
  page,
}) => {
  const initial = setRomanceProfile(createEmptyRomance(), "male", "warm");
  await prepare(page, { raw: JSON.stringify(initial), denyWrites: true });
  await page.goto("/romance?view=classic");
  const before = await snapshot(page);
  await course(page)
    .getByRole("button", { name: "主人公の設定を変更", exact: true })
    .click();
  await setup(page, "female", "curious");
  await openCharacter(page, "kiet");
  await playMeet(page, "kiet");
  await expect(course(page).getByTestId("romance-receipt")).toContainText(
    "このタブでは続けられます",
  );
  await expect(
    course(page).locator('.rc-storage-notice[role="status"]'),
  ).toContainText("保存できません");
  await backToCharacter(page, "kiet");
  await expect(
    course(page).getByRole("progressbar", { name: "キエット の好感度" }),
  ).toHaveJSProperty("value", 13);
  await expect(
    course(page).locator('button[data-episode-id="cafe"]'),
  ).toBeEnabled();
  expect(await snapshot(page)).toEqual(before);
});

test("未保存の設定がある場合も、別タブで性別を変更した後の古い相手の記録を拒否する", async ({
  page,
}) => {
  const initial = setRomanceProfile(createEmptyRomance(), "male", "warm");
  await prepare(page, { raw: JSON.stringify(initial), denyWrites: true });
  await page.goto("/romance?view=classic");
  await course(page)
    .getByRole("button", { name: "主人公の設定を変更", exact: true })
    .click();
  // Keep the role, but create an unsaved local preference change.
  await setup(page, "male", "calm");
  await openCharacter(page, "mali");
  await openEpisode(page);
  await finishLanguage(page, "mali", "meet");
  await chooseStory(page, "mali", "meet");
  const elsewhere = setRomanceProfile(initial, "female", "curious");
  const otherTab = await page.context().newPage();
  await otherTab.goto("/romance?view=classic");
  await otherTab.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: ROMANCE_STORAGE_KEY,
    raw: JSON.stringify(elsewhere),
  });
  await otherTab.close();
  await course(page)
    .getByRole("button", { name: "今日の会話を記録する", exact: true })
    .click();
  await expect(course(page)).toHaveAttribute("data-romance-stage", "review");
  await expect(
    course(page).locator('.rc-storage-notice[role="status"]'),
  ).toContainText("別のタブで主人公の設定が変わりました");
  await expect(course(page).getByTestId("romance-receipt")).toHaveCount(0);
  expect(await savedRomance(page)).toEqual(elsewhere);
});

test("保存拒否でも320px・文字200%で1操作の音声と会話を続け、マイクや他の記録へ触れない", async ({
  page,
}) => {
  const initial = setRomanceProfile(createEmptyRomance(), "male", "warm");
  await prepare(page, { raw: JSON.stringify(initial), denyWrites: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/romance?view=classic");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const before = await snapshot(page);
  await openCharacter(page, "mali");
  await openEpisode(page);
  expect((await probe(page)).calls).toEqual([]);
  const npc = course(page).getByRole("button", {
    name: "相手のことばを聞く",
    exact: true,
  });
  await npc.focus();
  await page.keyboard.press("Enter");
  const questions = getRomanceQuestions("mali", "meet");
  const chosen = questions[0].choices.find(
    (choice) => choice.id === questions[0].answerIds[0],
  )!;
  await course(page)
    .getByRole("radio", { name: chosen.phrase.thai, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await course(page)
    .getByRole("radio", { name: chosen.phrase.thai, exact: true })
    .click();
  const active = await probe(page);
  expect(active.calls.map((call) => call.text)).toEqual([
    questions[0].npc.thai,
    chosen.phrase.thai,
    chosen.phrase.thai,
  ]);
  expect(
    active.calls.every((call) => call.lang === "th-TH" && call.trusted),
  ).toBe(true);
  await course(page)
    .getByRole("button", { name: "返答を確認", exact: true })
    .click();
  await course(page)
    .getByRole("button", { name: "次のやりとりへ", exact: true })
    .click();
  expect((await probe(page)).calls).toHaveLength(3);
  await finishLanguage(page, "mali", "meet");
  await chooseStory(page, "mali", "meet");
  await record(page);
  await expect(
    course(page).locator('.rc-storage-notice[role="status"]'),
  ).toContainText("保存できません");
  expect(await snapshot(page)).toEqual(before);
  expect((await probe(page)).micRequests).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  await backToCharacter(page, "mali");
  await openEpisode(page);
  await course(page)
    .getByRole("button", { name: "相手のことばを聞く", exact: true })
    .click();
  const beforeLeave = await probe(page);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect
    .poll(async () => (await probe(page)).cancels)
    .toBeGreaterThan(beforeLeave.cancels);
});

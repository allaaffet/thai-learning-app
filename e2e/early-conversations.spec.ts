import { expect, test, type Locator, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import { conversationScenarios } from "../src/data/conversations";
import {
  getCourseConversation,
  getCourseConversationSteps,
} from "../src/data/course-conversations";
import {
  createEmptyProgress,
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
} from "../src/lib/progress";
import {
  CONVERSATION_STORAGE_KEY,
  createEmptyConversationProgress,
} from "../src/lib/conversation";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
} from "../src/lib/character-training-progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";
import type { Exercise } from "../src/lib/content-types";

test.use({ timezoneId: "Asia/Tokyo" });
const first = courseLessons[0];
const at = "2026-11-01T09:00:00.000Z";

/** Gesture and cancellation probes do not evaluate pronunciation quality. */
async function prepare(page: Page, completed = 0) {
  const progress = createEmptyProgress();
  for (const lesson of courseLessons.slice(0, completed))
    progress.lessons[lesson.id] = {
      completedAt: at,
      lastStudiedAt: at,
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: lesson.xp,
    };
  await page.addInitScript(
    ({ values }) => {
      for (const [key, value] of values) localStorage.setItem(key, value);
      const probe = {
        calls: [] as { text: string; lang: string; trusted: boolean }[],
        cancels: 0,
        writes: [] as string[],
        micRequests: 0,
      };
      Object.defineProperty(window, "__earlyDialogueProbe", { value: probe });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
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
              name: "Early dialogue Thai test voice",
              lang: "th-TH",
              voiceURI: "early-th",
              default: true,
              localService: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          probe.calls.push({
            text: utterance.text,
            lang: utterance.lang,
            trusted: window.event?.type === "click" && window.event.isTrusted,
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
              new Error("Microphone must not be requested"),
            );
          },
        },
      });
    },
    {
      values: [
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [
          CONVERSATION_STORAGE_KEY,
          JSON.stringify(createEmptyConversationProgress()),
        ],
        [REVIEW_STORAGE_KEY, JSON.stringify(createEmptyReview())],
        [
          CHARACTER_TRAINING_STORAGE_KEY,
          JSON.stringify(createEmptyCharacterTrainingState()),
        ],
      ],
    },
  );
}

function mission(page: Page) {
  return page.getByRole("region", { name: "学習ミッション", exact: true });
}
function dialogue(page: Page) {
  return mission(page).getByRole("region", {
    name: "会話チャレンジ",
    exact: true,
  });
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
    const value: unknown = Reflect.get(window, "__earlyDialogueProbe");
    if (!value || typeof value !== "object")
      throw new Error("Missing dialogue probe");
    const calls: unknown = Reflect.get(value, "calls");
    const writes: unknown = Reflect.get(value, "writes");
    if (!Array.isArray(calls) || !Array.isArray(writes))
      throw new Error("Invalid dialogue probe");
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
      cancels: Number(Reflect.get(value, "cancels")),
      micRequests: Number(Reflect.get(value, "micRequests")),
    };
  });
}
async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
}

async function completeDialogue(page: Page, variant = 0, wrong = false) {
  const box = dialogue(page);
  const spoken: string[] = [];
  for (let count = 0; count < 10; count += 1) {
    const phase = await box.getAttribute("data-dialogue-phase");
    if (phase === "complete") {
      await expect(
        box.getByRole("heading", {
          name: "会話の返し方を確認しました",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        mission(page).getByRole("button", {
          name: "次のカードへ",
          exact: true,
        }),
      ).toBeEnabled();
      return spoken;
    }
    const id = await box.getAttribute("data-step-id");
    const step = conversationScenarios
      .flatMap((scene) => scene.steps)
      .find((entry) => entry.id === id);
    if (!step) throw new Error("Unknown embedded dialogue step");
    if (phase === "model") {
      await expect(box).toContainText(step.npc.thai);
      await expect(box).toContainText(step.npc.meaning);
      for (const accepted of step.choices.filter((choice) =>
        step.answerIds.includes(choice.id),
      )) {
        await expect(box).toContainText(accepted.phrase.thai);
        await expect(box).toContainText(accepted.phrase.meaning);
      }
      const before = (await probe(page)).calls.length;
      await box
        .getByRole("button", { name: "会話で使ってみる", exact: true })
        .click();
      expect((await probe(page)).calls).toHaveLength(before);
      continue;
    }
    if (phase !== "practice")
      throw new Error("Unexpected embedded dialogue phase");
    const choice = step.choices.find((choice) =>
      wrong
        ? !step.answerIds.includes(choice.id)
        : choice.id === step.answerIds[variant % step.answerIds.length],
    );
    if (!choice) throw new Error("Missing reply for the goal");
    const before = await probe(page);
    await box
      .getByRole("radio", { name: choice.phrase.thai, exact: true })
      .click();
    spoken.push(choice.phrase.thai);
    const afterSelect = await probe(page);
    expect(afterSelect.calls).toHaveLength(before.calls.length + 1);
    expect(afterSelect.calls.at(-1)).toEqual({
      text: choice.phrase.thai,
      lang: "th-TH",
      trusted: true,
    });
    await box.getByRole("button", { name: "返答を確認", exact: true }).click();
    const feedback = box.locator('.cd-feedback[role="status"]');
    await expect(feedback).toHaveAttribute("data-correct", String(!wrong));
    await expect(feedback).toContainText(step.explanation);
    await expect(feedback).toContainText(choice.explanation);
    if (wrong)
      for (const accepted of step.choices.filter((choice) =>
        step.answerIds.includes(choice.id),
      ))
        await expect(box).toContainText(accepted.phrase.thai);
    await box
      .getByRole("button", { name: /^(次のやりとりへ|会話を終える)$/ })
      .click();
    expect((await probe(page)).calls).toHaveLength(afterSelect.calls.length);
    expect((await probe(page)).cancels).toBeGreaterThan(afterSelect.cancels);
  }
  throw new Error("Embedded dialogue did not terminate");
}

async function answerExercise(
  region: Locator,
  exercise: Exercise,
  correct: boolean,
) {
  if (
    exercise.type === "multiple-choice" ||
    exercise.type === "character-recognition"
  ) {
    const choice = exercise.options.find((option) =>
      correct
        ? option.id === exercise.answerId
        : option.id !== exercise.answerId,
    );
    if (!choice) throw new Error("Missing exercise choice");
    await region
      .getByRole("radio", { name: choice.label, exact: true })
      .click();
  } else if (exercise.type === "fill-in-the-blank") {
    await region
      .getByRole("textbox", { name: "空欄の答え", exact: true })
      .fill(correct ? exercise.acceptedAnswers[0] : "__wrong__");
  } else {
    const ids = [...exercise.answerOrder];
    if (!correct) {
      if (ids.length < 2) throw new Error("No wrong ordering available");
      [ids[0], ids[1]] = [ids[1], ids[0]];
    }
    for (const id of ids) {
      const token = exercise.tokens.find((token) => token.id === id);
      if (!token) throw new Error("Missing ordering token");
      await region
        .getByRole("button", { name: `${token.label} を追加`, exact: true })
        .click();
    }
  }
  await region.getByRole("button", { name: "答えを確認", exact: true }).click();
}

async function finishMission(page: Page, missCore = false) {
  const box = mission(page);
  let missed = false;
  let conversationCards = 0;
  for (let index = 0; index < 70; index += 1) {
    const kind = await box.getAttribute("data-card-kind");
    if (kind === "summary") return conversationCards;
    if (kind === "conversation") {
      const recall =
        (await box.getAttribute("data-conversation-mode")) === "recall";
      await expect(dialogue(page)).toHaveAttribute(
        "data-dialogue-phase",
        recall ? "practice" : "model",
      );
      await completeDialogue(page, recall ? 1 : 0);
      conversationCards += 1;
    } else if (kind === "explore") {
      await box
        .getByRole("button", { name: "意味をめくる", exact: true })
        .click();
    } else if (kind === "question") {
      const lessonId = await box.getAttribute("data-lesson-id");
      const exerciseId = await box.getAttribute("data-exercise-id");
      const exercise = courseLessons
        .find((lesson) => lesson.id === lessonId)
        ?.exercises.find((exercise) => exercise.id === exerciseId);
      if (!exercise) throw new Error("Unknown mission exercise");
      const wrong =
        missCore &&
        !missed &&
        (await box.getAttribute("data-purpose")) === "core";
      if (wrong) missed = true;
      await answerExercise(box, exercise, !wrong);
    } else if (kind !== "learn") throw new Error("Unknown mission card");
    await box
      .getByRole("button", { name: "次のカードへ", exact: true })
      .click();
  }
  throw new Error("Mission was not finite");
}

test("初回から挨拶のお手本を使い、2つの丁寧表現を1操作で聞いて本編の会話に戻れる", async ({
  page,
}) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/play/${first.id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "conversation");
  await expect(dialogue(page)).toHaveAttribute("data-dialogue-phase", "model");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const unit = getCourseConversation(first.id);
  if (!unit) throw new Error("Missing beginner conversation");
  const [step] = getCourseConversationSteps(unit);
  await expect(dialogue(page)).toContainText(unit.context);
  await expect(dialogue(page)).toContainText("未監修");
  await expect(dialogue(page)).toContainText("通信");
  expect((await probe(page)).calls).toEqual([]);
  const before = await snapshot(page);
  await noOverflow(page);
  const learned = await completeDialogue(page, 0);
  await noOverflow(page);
  await mission(page)
    .getByRole("button", { name: "次のカードへ", exact: true })
    .click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
  });
  expect(await finishMission(page)).toBe(1);
  const recall = step.choices.find((choice) => choice.id === step.answerIds[1]);
  if (!recall) throw new Error("Missing second accepted polite form");
  expect((await probe(page)).calls.map((call) => call.text)).toEqual([
    ...learned,
    recall.phrase.thai,
  ]);
  expect((await probe(page)).writes).toEqual([]);
  expect((await probe(page)).micRequests).toBe(0);
  expect(await snapshot(page)).toEqual(before);
  await mission(page)
    .getByRole("button", { name: "結果を記録する", exact: true })
    .click();
  const raw = (await snapshot(page))[PROGRESS_STORAGE_KEY];
  const saved: unknown = raw ? JSON.parse(raw) : null;
  if (!isLearningProgress(saved))
    throw new Error("Invalid saved lesson progress");
  expect(saved.attempts).toHaveLength(5);
  expect(
    saved.attempts.every((answer) =>
      first.exercises.some((exercise) => exercise.id === answer.exerciseId),
    ),
  ).toBe(true);
  expect(getTotalXp(saved)).toBe(first.xp);
  for (const key of [
    CONVERSATION_STORAGE_KEY,
    CHARACTER_TRAINING_STORAGE_KEY,
    REVIEW_STORAGE_KEY,
  ])
    expect((await snapshot(page))[key]).toBe(before[key]);
});

test("会話は誤答でも理由を見て有限に進め、確認5問の80%と既存の会話記録を変えない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto(`/play/${first.id}`);
  await expect(dialogue(page)).toHaveAttribute("data-dialogue-phase", "model");
  const before = await snapshot(page);
  await completeDialogue(page, 0, true);
  await mission(page)
    .getByRole("button", { name: "次のカードへ", exact: true })
    .click();
  expect(await finishMission(page, true)).toBe(1);
  expect((await probe(page)).writes).toEqual([]);
  await mission(page)
    .getByRole("button", { name: "結果を記録する", exact: true })
    .click();
  const raw = (await snapshot(page))[PROGRESS_STORAGE_KEY];
  const saved: unknown = raw ? JSON.parse(raw) : null;
  if (!isLearningProgress(saved)) throw new Error("Invalid saved progress");
  expect(saved.lessons[first.id]).toMatchObject({
    bestScore: 80,
    xpAwarded: first.xp,
    attemptCount: 1,
  });
  expect(saved.attempts).toHaveLength(5);
  expect(saved.attempts.filter((attempt) => !attempt.correct)).toHaveLength(1);
  expect((await probe(page)).writes).toEqual([PROGRESS_STORAGE_KEY]);
  for (const key of [
    CONVERSATION_STORAGE_KEY,
    CHARACTER_TRAINING_STORAGE_KEY,
    REVIEW_STORAGE_KEY,
  ])
    expect((await snapshot(page))[key]).toBe(before[key]);
});

test("最初の6課から会話の目標が見え、文脈付きのお礼と後半の複数往復も同じ本編で学べる", async ({
  page,
}) => {
  await prepare(page, 22);
  for (const lesson of courseLessons.slice(0, 6)) {
    const unit = getCourseConversation(lesson.id);
    if (!unit) throw new Error("Missing early conversational objective");
    await page.goto(`/play/${lesson.id}`);
    await expect(dialogue(page)).toHaveAttribute(
      "data-dialogue-phase",
      "model",
    );
    await expect(mission(page)).toContainText(unit.objective);
    await expect(dialogue(page)).toContainText(unit.context);
  }
  expect((await probe(page)).calls).toEqual([]);
  expect((await probe(page)).writes).toEqual([]);
  const thanksLesson = courseLessons[1];
  const thanks = getCourseConversation(thanksLesson.id);
  if (!thanks) throw new Error("Missing thanks goal");
  expect(thanks.stepIds).toContain("cafe-water-thanks");
  await page.goto(`/lessons/${thanksLesson.id}`);
  const preview = page.getByRole("region", {
    name: "このレッスンの会話",
    exact: true,
  });
  await expect(preview).toContainText(thanks.title);
  await expect(preview).toContainText(thanks.context);
  await preview.getByText("今回使う表現を見る", { exact: true }).click();
  for (const step of getCourseConversationSteps(thanks)) {
    await expect(preview).toContainText(step.npc.thai);
    await expect(preview).toContainText(step.npc.meaning);
  }
  const later = courseLessons[22];
  const laterUnit = getCourseConversation(later.id);
  if (!laterUnit || laterUnit.stepIds.length < 2)
    throw new Error("Later lesson lacks multi-turn review");
  await page.goto("/play");
  await expect(
    page.getByRole("heading", { name: laterUnit.title, exact: true }),
  ).toBeVisible();
  await page.goto(`/play/${later.id}`);
  const before = await snapshot(page);
  expect(await finishMission(page)).toBe(2);
  expect((await probe(page)).calls).toHaveLength(laterUnit.stepIds.length * 2);
  expect((await probe(page)).micRequests).toBe(0);
  expect((await probe(page)).writes).toEqual([]);
  expect(await snapshot(page)).toEqual(before);
});

import { expect, test, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import { conversationScenarios } from "../src/data/conversations";
import { getCourseWordBuilder } from "../src/lib/course-word-builder";
import { createEmptyProgress, PROGRESS_STORAGE_KEY } from "../src/lib/progress";
import { createEmptyReview, REVIEW_STORAGE_KEY } from "../src/lib/review";

async function prepare(page: Page, completed = 0) {
  const progress = createEmptyProgress();
  for (const lesson of courseLessons.slice(0, completed))
    progress.lessons[lesson.id] = {
      completedAt: "2026-11-03T00:00:00.000Z",
      lastStudiedAt: "2026-11-03T00:00:00.000Z",
      bestScore: 100,
      attemptCount: 1,
      xpAwarded: lesson.xp,
    };
  await page.addInitScript(
    ({ values }) => {
      for (const [key, value] of values) localStorage.setItem(key, value);
      const probe = {
        calls: [] as { text: string; trusted: boolean; lang: string }[],
        cancels: 0,
        mic: 0,
      };
      Object.defineProperty(window, "__builderProbe", { value: probe });
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
              name: "Builder Thai mock",
              lang: "th-TH",
              voiceURI: "builder-th",
              default: true,
              localService: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          probe.calls.push({
            text: utterance.text,
            trusted: window.event?.isTrusted === true,
            lang: utterance.lang,
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
            return Promise.reject(new Error("No microphone in word ordering"));
          },
        },
      });
    },
    {
      values: [
        [PROGRESS_STORAGE_KEY, JSON.stringify(progress)],
        [REVIEW_STORAGE_KEY, JSON.stringify(createEmptyReview())],
      ],
    },
  );
}
const mission = (page: Page) =>
  page.getByRole("region", { name: "学習ミッション", exact: true });
const builder = (page: Page) => page.getByTestId("course-word-builder");
async function snapshot(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
    ),
  );
}
async function probe(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__builderProbe");
    if (!value || typeof value !== "object")
      throw new Error("Missing audio probe");
    const calls: unknown = Reflect.get(value, "calls");
    if (!Array.isArray(calls)) throw new Error("Missing audio calls");
    return {
      calls: calls.map((call: unknown) => {
        if (!call || typeof call !== "object")
          throw new Error("Invalid audio call");
        return {
          text: String(Reflect.get(call, "text")),
          trusted: Reflect.get(call, "trusted") === true,
          lang: String(Reflect.get(call, "lang")),
        };
      }),
      cancels: Number(Reflect.get(value, "cancels")),
      mic: Number(Reflect.get(value, "mic")),
    };
  });
}
async function reachBuilder(page: Page) {
  const region = mission(page);
  for (let guard = 0; guard < 35; guard += 1) {
    const kind = await region.getAttribute("data-card-kind");
    if (kind === "word-builder") return;
    if (kind === "conversation") {
      const dialogue = region.getByRole("region", {
        name: "会話チャレンジ",
        exact: true,
      });
      for (let turn = 0; turn < 10; turn += 1) {
        const phase = await dialogue.getAttribute("data-dialogue-phase");
        if (phase === "complete") break;
        if (phase === "model") {
          await dialogue
            .getByRole("button", { name: "会話で使ってみる", exact: true })
            .click();
          continue;
        }
        if (phase !== "practice") throw new Error("Unexpected dialogue stage");
        const id = await dialogue.getAttribute("data-step-id");
        const step = conversationScenarios
          .flatMap((scenario) => scenario.steps)
          .find((entry) => entry.id === id);
        const choice = step?.choices.find(
          (entry) => entry.id === step.answerIds[0],
        );
        if (!choice) throw new Error("Missing model reply");
        await dialogue
          .getByRole("radio", { name: choice.phrase.thai, exact: true })
          .click();
        await dialogue
          .getByRole("button", { name: "返答を確認", exact: true })
          .click();
        await dialogue
          .getByRole("button", { name: /^(次のやりとりへ|会話を終える)$/ })
          .click();
      }
    } else if (kind === "explore")
      await region
        .getByRole("button", { name: "意味をめくる", exact: true })
        .click();
    else if (kind === "question") {
      await expect(region).toHaveAttribute("data-purpose", "review");
      const lessonId = await region.getAttribute("data-lesson-id");
      const exerciseId = await region.getAttribute("data-exercise-id");
      const exercise = courseLessons
        .find((lesson) => lesson.id === lessonId)
        ?.exercises.find((entry) => entry.id === exerciseId);
      if (!exercise) throw new Error("Missing earlier review question");
      if (
        exercise.type === "multiple-choice" ||
        exercise.type === "character-recognition"
      ) {
        const option = exercise.options.find(
          (entry) => entry.id === exercise.answerId,
        )!;
        await region
          .getByRole("radio", { name: option.label, exact: true })
          .click();
      } else if (exercise.type === "fill-in-the-blank") {
        await region
          .getByRole("textbox", { name: "空欄の答え", exact: true })
          .fill(exercise.acceptedAnswers[0]);
      } else {
        for (const id of exercise.answerOrder) {
          const token = exercise.tokens.find((entry) => entry.id === id)!;
          await region
            .getByRole("button", { name: `${token.label} を追加`, exact: true })
            .click();
        }
      }
      await region
        .getByRole("button", { name: "答えを確認", exact: true })
        .click();
    } else if (kind !== "learn")
      throw new Error(`A scored question preceded word construction: ${kind}`);
    await region
      .getByRole("button", { name: "次のカードへ", exact: true })
      .click();
  }
  throw new Error("Word builder missing from the finite lesson");
}

test("最初の課でも返答を組み、誤答とヒントを確認してから採点問題へ進める", async ({
  page,
}) => {
  await prepare(page);
  await page.goto(`/play/${courseLessons[0].id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "conversation");
  const before = await snapshot(page);
  await reachBuilder(page);
  const data = getCourseWordBuilder(courseLessons[0].id)!;
  await expect(
    mission(page).getByRole("button", { name: "次のカードへ", exact: true }),
  ).toBeDisabled();
  const audioBefore = await probe(page);
  await builder(page)
    .getByRole("button", { name: "お手本のヒント", exact: true })
    .click();
  expect((await probe(page)).calls.length).toBe(audioBefore.calls.length);
  for (const id of [...data.acceptedWordIds[0]].reverse())
    await builder(page).locator(`button[data-word-id="${id}"]`).click();
  await builder(page)
    .getByRole("button", { name: "組み立てた返答を確認", exact: true })
    .click();
  await expect(builder(page).locator(".cwb-feedback")).toHaveAttribute(
    "data-correct",
    "false",
  );
  await expect(builder(page)).toContainText(data.step.explanation);
  await expect(
    builder(page).locator(".cwb-bank button").first(),
  ).toBeDisabled();
  expect(await snapshot(page)).toEqual(before);
  await mission(page)
    .getByRole("button", { name: "次のカードへ", exact: true })
    .click();
  await expect(mission(page)).toHaveAttribute("data-purpose", "core");
  expect(await snapshot(page)).toEqual(before);
});

test("後半の課でも両方の丁寧詞を含む返答を組み、取り外しと並べ直しができる", async ({
  page,
}) => {
  const index = courseLessons.findIndex(
    (lesson) => lesson.id === "requests-modals",
  );
  await prepare(page, index);
  await page.goto(`/play/${courseLessons[index].id}`);
  await reachBuilder(page);
  const before = await snapshot(page);
  const data = getCourseWordBuilder(courseLessons[index].id)!;
  const ids = data.acceptedWordIds[1];
  const firstWord = data.bank.find((word) => word.id === ids[0])!;
  await builder(page).locator(`button[data-word-id="${ids[0]}"]`).click();
  await builder(page)
    .getByRole("button", {
      name: `${firstWord.thai} を返答から戻す`,
      exact: true,
    })
    .click();
  await expect(
    builder(page).getByText("下のことばを、ここに並べよう。", { exact: true }),
  ).toBeVisible();
  await builder(page).locator(`button[data-word-id="${ids[0]}"]`).click();
  await builder(page)
    .getByRole("button", { name: "並べ直す", exact: true })
    .click();
  for (const id of ids)
    await builder(page).locator(`button[data-word-id="${id}"]`).click();
  await builder(page)
    .getByRole("button", { name: "組み立てた返答を確認", exact: true })
    .click();
  await expect(builder(page).locator(".cwb-feedback")).toHaveAttribute(
    "data-correct",
    "true",
  );
  expect(await snapshot(page)).toEqual(before);
});

test("320px・文字200%でも語句をキーボードで選ぶ同じ操作内に音が出て、離脱で止まる", async ({
  page,
}) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`/play/${courseLessons[0].id}`);
  await reachBuilder(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const data = getCourseWordBuilder(courseLessons[0].id)!;
  const word = data.bank.find(
    (entry) => entry.id === data.acceptedWordIds[0][0],
  )!;
  const before = await probe(page);
  await builder(page).locator(`button[data-word-id="${word.id}"]`).focus();
  await page.keyboard.press("Enter");
  const after = await probe(page);
  expect(after.calls.slice(before.calls.length)).toEqual([
    { text: word.thai, trusted: true, lang: "th-TH" },
  ]);
  expect(after.mic).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: "ホーム", exact: true }).click();
  await expect
    .poll(async () => (await probe(page)).cancels)
    .toBeGreaterThan(after.cancels);
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import type { Exercise } from "../src/lib/content-types";
import { INCORRECT_INPUT_ID } from "../src/lib/exercise-grading";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
} from "../src/lib/character-training-progress";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  REVIEW_STORAGE_KEY,
} from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });

const first = courseLessons[0];
const recordedAt = "2026-10-30T09:00:00.000Z";
const now = "2026-10-31T09:00:00.000Z";

/** Mock speech tests gestures/cancellation only; it does not validate Thai audio. */
async function prepare(page: Page, completed = 0, refuseProgress = false) {
  const oldLessons = courseLessons.slice(0, completed);
  const progress: LearningProgress = {
    version: 1,
    lessons: Object.fromEntries(
      oldLessons.map((lesson) => [
        lesson.id,
        {
          completedAt: recordedAt,
          lastStudiedAt: recordedAt,
          bestScore: 80,
          attemptCount: 1,
          xpAwarded: lesson.xp,
        },
      ]),
    ),
    attempts: oldLessons.flatMap((lesson) =>
      lesson.exercises.map((exercise, index) => ({
        lessonId: lesson.id,
        exerciseId: exercise.id,
        selectedOptionId:
          index === 0
            ? (exercise.options.find(
                (option) => option.id !== exercise.answerId,
              )?.id ?? INCORRECT_INPUT_ID)
            : exercise.answerId,
        correct: index !== 0,
        attemptedAt: recordedAt,
      })),
    ),
    studyDays: completed ? [recordedAt.slice(0, 10)] : [],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    recordedAt,
  );
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ({ values, progressKey, refuseProgress }) => {
      for (const [key, value] of values)
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, value);
      const probe = {
        writes: [] as string[],
        progressValues: [] as string[],
        calls: [] as { text: string; lang: string; trusted: boolean }[],
        cancels: 0,
      };
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        probe.writes.push(key);
        if (key === progressKey) {
          probe.progressValues.push(String(value));
          if (refuseProgress) throw new Error("Test storage is full");
        }
        return original.call(this, key, value);
      };
      class Utterance {
        lang = "";
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
      let current: Utterance | null = null;
      class Synthesis extends EventTarget {
        getVoices() {
          return [
            {
              name: "Mission Thai test voice",
              lang: "th-TH",
              voiceURI: "mission-th",
              localService: true,
              default: true,
            },
          ];
        }
        speak(utterance: Utterance) {
          current = utterance;
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
      Object.defineProperty(window, "__courseMissionProbe", {
        value: { probe, finish: () => current?.onend?.() },
      });
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
      progressKey: PROGRESS_STORAGE_KEY,
      refuseProgress,
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
  return progress;
}

function mission(page: Page) {
  return page.getByRole("region", { name: "学習ミッション", exact: true });
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

async function progressFromStorage(page: Page) {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    PROGRESS_STORAGE_KEY,
  );
  const parsed: unknown = raw === null ? null : JSON.parse(raw);
  if (!isLearningProgress(parsed)) throw new Error("Invalid saved progress");
  return parsed;
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const root: unknown = Reflect.get(window, "__courseMissionProbe");
    if (!root || typeof root !== "object") throw new Error("Missing probe");
    const value: unknown = Reflect.get(root, "probe");
    if (!value || typeof value !== "object") throw new Error("Missing state");
    const writes: unknown = Reflect.get(value, "writes");
    const progressValues: unknown = Reflect.get(value, "progressValues");
    const calls: unknown = Reflect.get(value, "calls");
    if (
      !Array.isArray(writes) ||
      !Array.isArray(progressValues) ||
      !Array.isArray(calls)
    )
      throw new Error("Invalid probe arrays");
    return {
      writes: writes.map(String),
      progressValues: progressValues.map(String),
      cancels: Number(Reflect.get(value, "cancels")),
      calls: calls.map((call: unknown) => {
        if (!call || typeof call !== "object")
          throw new Error("Invalid speech call");
        return {
          text: String(Reflect.get(call, "text")),
          lang: String(Reflect.get(call, "lang")),
          trusted: Reflect.get(call, "trusted") === true,
        };
      }),
    };
  });
}

async function answer(region: Locator, exercise: Exercise, correct: boolean) {
  if (
    exercise.type === "multiple-choice" ||
    exercise.type === "character-recognition"
  ) {
    const option = exercise.options.find((entry) =>
      correct ? entry.id === exercise.answerId : entry.id !== exercise.answerId,
    );
    if (!option) throw new Error("No valid test response");
    await region
      .getByRole("radio", { name: option.label, exact: true })
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
      const token = exercise.tokens.find((entry) => entry.id === id);
      if (!token) throw new Error("Unknown token");
      await region
        .getByRole("button", { name: `${token.label} を追加`, exact: true })
        .click();
    }
  }
  await region.getByRole("button", { name: "答えを確認", exact: true }).click();
  const feedback = region.locator('.mission-feedback[role="status"]');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(exercise.explanation);
  if (!correct)
    await expect(feedback).toContainText(
      exercise.options.find((option) => option.id === exercise.answerId)!.label,
    );
}

interface SeenCard {
  kind: string;
  purpose: string | null;
  lessonId: string | null;
  exerciseId: string | null;
}

/** Finite walk; a repeat bug cannot silently turn this into an endless test. */
async function finishCards(
  page: Page,
  shouldMiss: (card: SeenCard, seen: SeenCard[]) => boolean = () => false,
) {
  const region = mission(page);
  const seen: SeenCard[] = [];
  for (let count = 0; count < 70; count += 1) {
    const kind = await region.getAttribute("data-card-kind");
    if (kind === "summary") return seen;
    const card: SeenCard = {
      kind: kind ?? "",
      purpose: await region.getAttribute("data-purpose"),
      lessonId: await region.getAttribute("data-lesson-id"),
      exerciseId: await region.getAttribute("data-exercise-id"),
    };
    if (kind === "explore") {
      const reveal = region.getByRole("button", {
        name: "意味をめくる",
        exact: true,
      });
      await expect(
        region.getByRole("button", { name: "次のカードへ", exact: true }),
      ).toBeDisabled();
      await reveal.click();
    } else if (kind === "question") {
      const source = courseLessons.find((entry) => entry.id === card.lessonId);
      const exercise = source?.exercises.find(
        (entry) => entry.id === card.exerciseId,
      );
      if (!exercise)
        throw new Error(`Unknown question ${JSON.stringify(card)}`);
      if (card.purpose === "review" && source)
        await expect(
          region.getByText(`この問題のレッスン：${source.title}`, {
            exact: true,
          }),
        ).toBeVisible();
      await answer(region, exercise, !shouldMiss(card, seen));
    } else if (kind !== "learn") {
      throw new Error(`Unexpected card kind: ${kind}`);
    }
    seen.push(card);
    const index = await region.getAttribute("data-step-index");
    await region
      .getByRole("button", { name: "次のカードへ", exact: true })
      .click();
    await expect(region).not.toHaveAttribute("data-step-index", index ?? "");
  }
  throw new Error("Mission exceeded the finite card limit");
}

async function saveTwice(page: Page) {
  await mission(page)
    .getByRole("button", { name: "結果を記録する", exact: true })
    .evaluate((button) => {
      if (!(button instanceof HTMLButtonElement))
        throw new Error("Missing record button");
      button.click();
      button.click();
    });
}

test("冒険の入口から全カードを遊び、5問の初回回答と一度だけのXPを保存して教科書にも戻れる", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/play");
  const start = page.locator(`a[href="/play/${first.id}"]`).first();
  await expect(start).toBeVisible();
  await expect(page.locator('a[href="/play/mix"]')).toHaveCount(0);
  await start.click();
  await expect(mission(page)).toHaveAttribute("data-mission-mode", "lesson");
  const before = await snapshot(page);
  const seen = await finishCards(page);
  expect(seen.filter((card) => card.kind === "learn")).toHaveLength(
    first.blocks.length,
  );
  expect(seen.filter((card) => card.kind === "explore")).toHaveLength(
    first.explore.length,
  );
  expect(seen.filter((card) => card.purpose === "core")).toHaveLength(5);
  expect(seen.filter((card) => card.purpose === "recall")).toHaveLength(2);
  expect(await snapshot(page)).toEqual(before);
  expect((await probe(page)).writes).toEqual([]);
  expect((await probe(page)).calls).toEqual([]);
  await saveTwice(page);
  await expect(
    mission(page).getByRole("heading", {
      name: "ミッションクリア！",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    mission(page).getByRole("heading", {
      name: "ミッションクリア！",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    mission(page).getByRole("heading", {
      name: "ミッションクリア！",
      exact: true,
    }),
  ).toBeInViewport();
  const saved = await progressFromStorage(page);
  expect(saved.lessons[first.id]).toMatchObject({
    bestScore: 100,
    attemptCount: 1,
    xpAwarded: first.xp,
  });
  expect(saved.attempts).toHaveLength(5);
  expect(saved.attempts.every((attempt) => attempt.lessonId === first.id)).toBe(
    true,
  );
  expect((await probe(page)).writes).toEqual([PROGRESS_STORAGE_KEY]);
  expect((await snapshot(page))[REVIEW_STORAGE_KEY]).toBe(
    before[REVIEW_STORAGE_KEY],
  );
  expect((await snapshot(page))[CHARACTER_TRAINING_STORAGE_KEY]).toBe(
    before[CHARACTER_TRAINING_STORAGE_KEY],
  );
  await page.reload();
  expect(getTotalXp(await progressFromStorage(page))).toBe(first.xp);
  await finishCards(page);
  await saveTwice(page);
  expect(getTotalXp(await progressFromStorage(page))).toBe(first.xp);
  expect((await progressFromStorage(page)).lessons[first.id].attemptCount).toBe(
    2,
  );
  await page.goto(`/lessons/${first.id}`);
  await expect(
    page.getByRole("region", { name: "発見カード", exact: true }),
  ).toBeVisible();
});

test("まちがいは有限の再挑戦で確かめられ、解き直しても最初の60%を合格へ変えない", async ({
  page,
}) => {
  await prepare(page);
  await page.goto(`/play/${first.id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "learn");
  const seen = await finishCards(
    page,
    (card, previous) =>
      card.purpose === "core" &&
      previous.filter((entry) => entry.purpose === "core").length < 2,
  );
  expect(seen.filter((card) => card.purpose === "retry")).toHaveLength(2);
  expect((await probe(page)).writes).toEqual([]);
  await saveTwice(page);
  await expect(
    mission(page).getByRole("heading", {
      name: "もう一度、確かめよう",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await progressFromStorage(page);
  expect(saved.lessons[first.id]).toMatchObject({
    bestScore: 60,
    xpAwarded: 0,
    attemptCount: 1,
  });
  expect(saved.lessons[first.id].completedAt).toBeUndefined();
  expect(saved.attempts).toHaveLength(5);
  expect(saved.attempts.filter((attempt) => !attempt.correct)).toHaveLength(2);
  expect((await probe(page)).writes).toEqual([PROGRESS_STORAGE_KEY]);
  const next = courseLessons.find((lesson) =>
    lesson.prerequisites.includes(first.id),
  )!;
  await page.goto(`/play/${next.id}`);
  await expect(
    page.getByRole("heading", { name: "ここから、一歩ずつ。", exact: true }),
  ).toBeVisible();
  await expect(mission(page)).toHaveCount(0);
});

test("既習を混ぜて思い出しつつ、新しい課の初回5問だけで進捗を引き継ぐ", async ({
  page,
}) => {
  const original = await prepare(page, 2);
  const target = courseLessons[2];
  await page.goto(`/play/${target.id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "learn");
  const before = await snapshot(page);
  const seen = await finishCards(page);
  const old = seen.filter((card) => card.purpose === "review");
  expect(old).toHaveLength(2);
  expect(
    old.every((card) => Object.hasOwn(original.lessons, card.lessonId ?? "")),
  ).toBe(true);
  const firstCore = seen.findIndex((card) => card.purpose === "core");
  expect(
    seen
      .slice(firstCore)
      .some((card) => card.kind === "learn" || card.kind === "explore"),
  ).toBe(false);
  expect(seen.filter((card) => card.purpose === "recall")).toHaveLength(2);
  expect((await probe(page)).writes).toEqual([]);
  await saveTwice(page);
  const saved = await progressFromStorage(page);
  expect(saved.attempts.slice(0, original.attempts.length)).toEqual(
    original.attempts,
  );
  expect(saved.attempts.slice(original.attempts.length)).toHaveLength(5);
  expect(
    saved.attempts
      .slice(original.attempts.length)
      .every((attempt) => attempt.lessonId === target.id),
  ).toBe(true);
  for (const [id, progress] of Object.entries(original.lessons))
    expect(saved.lessons[id]).toEqual(progress);
  expect(getTotalXp(saved)).toBe(getTotalXp(original) + target.xp);
  expect((await snapshot(page))[REVIEW_STORAGE_KEY]).toBe(
    before[REVIEW_STORAGE_KEY],
  );
  expect((await probe(page)).writes).toEqual([PROGRESS_STORAGE_KEY]);
  await expect(
    mission(page).getByRole("link", { name: "次のミッションへ", exact: true }),
  ).toBeVisible();
});

test("おさらいミックスは既習だけの6問と一度の再挑戦で終わり、XPや復習予定へ書き込まない", async ({
  page,
}) => {
  const original = await prepare(page, 3);
  await page.goto("/play/mix");
  await expect(mission(page)).toHaveAttribute("data-mission-mode", "mix");
  const before = await snapshot(page);
  const seen = await finishCards(
    page,
    (card, previous) => card.purpose === "review" && previous.length === 0,
  );
  const initial = seen.filter((card) => card.purpose === "review");
  expect(initial).toHaveLength(6);
  expect(
    new Set(initial.map((card) => `${card.lessonId}:${card.exerciseId}`)).size,
  ).toBe(6);
  expect(
    initial.every((card) =>
      Object.hasOwn(original.lessons, card.lessonId ?? ""),
    ),
  ).toBe(true);
  expect(seen.filter((card) => card.purpose === "retry")).toHaveLength(1);
  await expect(
    mission(page).getByRole("heading", {
      name: "ミックス練習、おつかれさま！",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    mission(page).getByRole("button", { name: "結果を記録する", exact: true }),
  ).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
  expect((await probe(page)).writes).toEqual([]);
  await mission(page)
    .getByRole("button", { name: "新しい組み合わせでもう一度", exact: true })
    .click();
  const next = await finishCards(page);
  expect(next.map((card) => `${card.lessonId}:${card.exerciseId}`)).not.toEqual(
    initial.map((card) => `${card.lessonId}:${card.exerciseId}`),
  );
  expect(await snapshot(page)).toEqual(before);
  expect((await probe(page)).writes).toEqual([]);
});

test("空欄と並べ替えも混ぜて学べ、保存不可でも入力の生データを残さずタブ内でクリアできる", async ({
  page,
}) => {
  const target = courseLessons.find(
    (lesson) =>
      lesson.exercises.some(
        (exercise) => exercise.type === "fill-in-the-blank",
      ) &&
      lesson.exercises.some((exercise) => exercise.type === "word-ordering"),
  );
  if (!target) throw new Error("No lesson exercises both input formats");
  const original = await prepare(page, courseLessons.indexOf(target), true);
  const fill = target.exercises.find(
    (exercise) => exercise.type === "fill-in-the-blank",
  )!;
  await page.goto(`/play/${target.id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "learn");
  const before = await snapshot(page);
  const seen = await finishCards(
    page,
    (card) => card.purpose === "core" && card.exerciseId === fill.id,
  );
  const core = seen.filter((card) => card.purpose === "core");
  expect(core).toHaveLength(5);
  for (const type of ["fill-in-the-blank", "word-ordering"])
    expect(
      core.some(
        (card) =>
          target.exercises.find((exercise) => exercise.id === card.exerciseId)
            ?.type === type,
      ),
    ).toBe(true);
  expect((await probe(page)).writes).toEqual([]);
  await saveTwice(page);
  await expect(
    mission(page).getByRole("heading", {
      name: "ミッションクリア！",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".storage-notice")).toContainText(
    "進捗を保存できません",
  );
  await expect(mission(page)).toContainText(
    "保存について、画面上部のお知らせを確認してください。",
  );
  await expect(mission(page)).not.toContainText(
    "このブラウザに学習の記録を保存しました。",
  );
  const state = await probe(page);
  expect(state.writes).toEqual([PROGRESS_STORAGE_KEY]);
  expect(state.progressValues).toHaveLength(1);
  const attempted: unknown = JSON.parse(state.progressValues[0]);
  if (!isLearningProgress(attempted))
    throw new Error("Invalid attempted save payload");
  expect(attempted.lessons[target.id]).toMatchObject({
    bestScore: 80,
    xpAwarded: target.xp,
    attemptCount: 1,
  });
  const attempts = attempted.attempts.slice(original.attempts.length);
  expect(attempts).toHaveLength(5);
  expect(attempts.every((attempt) => attempt.lessonId === target.id)).toBe(
    true,
  );
  expect(
    attempts.find((attempt) => attempt.exerciseId === fill.id),
  ).toMatchObject({
    correct: false,
    selectedOptionId: INCORRECT_INPUT_ID,
  });
  expect(JSON.stringify(attempts)).not.toContain("__wrong__");
  for (const attempt of attempts)
    expect(Object.keys(attempt).sort()).toEqual([
      "attemptedAt",
      "correct",
      "exerciseId",
      "lessonId",
      "selectedOptionId",
    ]);
  expect(getTotalXp(attempted)).toBe(getTotalXp(original) + target.xp);
  expect(await snapshot(page)).toEqual(before);
  expect(await progressFromStorage(page)).toEqual(original);
});

test("前提を飛ばせず、320px・文字拡大・キーボードでも1回の操作で音を聞いて進める", async ({
  page,
}) => {
  await prepare(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/play/${courseLessons.at(-1)!.id}`);
  await expect(
    page.getByRole("heading", { name: "ここから、一歩ずつ。", exact: true }),
  ).toBeVisible();
  await expect(mission(page)).toHaveCount(0);
  await page.goto(`/play/${first.id}`);
  await expect(mission(page)).toHaveAttribute("data-card-kind", "learn");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect((await probe(page)).calls).toEqual([]);
  const next = mission(page).getByRole("button", {
    name: "次のカードへ",
    exact: true,
  });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(mission(page)).toHaveAttribute("data-card-kind", "explore");
  const id = await mission(page).getAttribute("data-explore-id");
  const entry = first.explore.find((item) => item.id === id);
  if (!entry) throw new Error("Missing explore source");
  const play = mission(page).getByRole("button", {
    name: `${entry.thai} を聞く`,
    exact: true,
  });
  await expect(play).toBeEnabled();
  await play.focus();
  await page.keyboard.press("Enter");
  expect((await probe(page)).calls).toEqual([
    { text: entry.thai, lang: "th-TH", trusted: true },
  ]);
  const cancels = (await probe(page)).cancels;
  await mission(page)
    .getByRole("button", { name: "意味をめくる", exact: true })
    .click();
  await next.click();
  expect((await probe(page)).calls).toHaveLength(1);
  expect((await probe(page)).cancels).toBeGreaterThan(cancels);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
  expect((await probe(page)).writes).toEqual([]);
});

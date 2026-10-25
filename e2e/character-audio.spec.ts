import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import { courseLessons } from "../src/data/course";
import { vocabularyEntries } from "../src/data/language";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  isCharacterTrainingState,
} from "../src/lib/character-training-progress";
import {
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "../src/lib/progress";
import {
  addReviewCard,
  createEmptyReview,
  REVIEW_STORAGE_KEY,
} from "../src/lib/review";

test.use({ timezoneId: "Asia/Tokyo" });

// Web Speech操作と完了通知の検証用。実音声の発音・声調の品質は評価しない。
async function installSpeechStub(
  page: Page,
  voices: "thai" | "no-thai" | "delayed" = "thai",
  playback: "automatic" | "manual" = "automatic",
) {
  await page.addInitScript(
    ({ voices, playback }) => {
      class Utterance {
        text: string;
        lang = "";
        voice: { name: string; lang: string } | null = null;
        rate = 1;
        pitch = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      const state = {
        calls: [] as { text: string; lang: string; voice: string | null }[],
        cancels: 0,
        ready: voices !== "delayed",
      };
      const utterances: Utterance[] = [];
      const timers = new Set<number>();
      let throwNext = false;
      class Synthesis extends EventTarget {
        getVoices() {
          if (!state.ready) return [];
          const japanese = {
            name: "Japanese test voice",
            lang: "ja-JP",
            voiceURI: "ja",
            default: true,
            localService: true,
          };
          const thai = {
            name: "Thai test voice",
            lang: "th-TH",
            voiceURI: "th",
            default: false,
            localService: true,
          };
          return voices === "no-thai" ? [japanese] : [japanese, thai];
        }
        speak(utterance: Utterance) {
          state.calls.push({
            text: utterance.text,
            lang: utterance.lang,
            voice: utterance.voice?.lang ?? null,
          });
          if (throwNext) {
            throwNext = false;
            throw new Error("Speech backend rejected playback");
          }
          utterances.push(utterance);
          utterance.onstart?.();
          if (playback === "automatic") {
            const timer = window.setTimeout(() => {
              timers.delete(timer);
              utterance.onend?.();
            }, 60);
            timers.add(timer);
          }
        }
        cancel() {
          state.cancels += 1;
          for (const timer of timers) window.clearTimeout(timer);
          timers.clear();
        }
      }
      const synthesis = new Synthesis();
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: synthesis,
      });
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: Utterance,
      });
      Object.defineProperty(window, "__characterSpeech", { value: state });
      Object.defineProperty(window, "__characterSpeechControl", {
        value: (
          action: "finish" | "error" | "voices" | "throw-next",
          index?: number,
        ) => {
          if (action === "throw-next") {
            throwNext = true;
            return;
          }
          if (action === "voices") {
            state.ready = true;
            synthesis.dispatchEvent(new Event("voiceschanged"));
            return;
          }
          const utterance = utterances[index ?? utterances.length - 1];
          if (!utterance) throw new Error("No recorded speech request");
          // 取消後のブラウザから遅れて到着する通知も意図的に再現する。
          if (action === "finish") utterance.onend?.();
          else utterance.onerror?.();
        },
      });
    },
    { voices, playback },
  );
}

async function speechState(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__characterSpeech");
    if (typeof value !== "object" || value === null)
      throw new Error("Missing speech stub");
    const calls: unknown = Reflect.get(value, "calls");
    const cancels: unknown = Reflect.get(value, "cancels");
    if (!Array.isArray(calls) || typeof cancels !== "number")
      throw new Error("Invalid speech probe");
    return {
      cancels,
      calls: calls.map((call: unknown) => {
        if (typeof call !== "object" || call === null)
          throw new Error("Invalid speech call");
        const text: unknown = Reflect.get(call, "text");
        const lang: unknown = Reflect.get(call, "lang");
        const voice: unknown = Reflect.get(call, "voice");
        if (
          typeof text !== "string" ||
          typeof lang !== "string" ||
          (voice !== null && typeof voice !== "string")
        )
          throw new Error("Invalid speech payload");
        return { text, lang, voice };
      }),
    };
  });
}

async function speechEvent(
  page: Page,
  action: "finish" | "error" | "voices" | "throw-next",
  index?: number,
) {
  await page.evaluate(
    ({ action, index }) => {
      const control: unknown = Reflect.get(window, "__characterSpeechControl");
      if (typeof control !== "function")
        throw new Error("Missing speech control");
      Reflect.apply(control, undefined, [action, index]);
    },
    { action, index },
  );
}

async function savedTraining(page: Page) {
  const state: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, CHARACTER_TRAINING_STORAGE_KEY);
  if (!isCharacterTrainingState(state))
    throw new Error("Invalid training record");
  return state;
}

async function seedExistingLearning(page: Page) {
  const lesson = courseLessons[0];
  const timestamp = "2026-10-24T09:00:00.000Z";
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
    studyDays: ["2026-10-24"],
  };
  const review = addReviewCard(
    createEmptyReview(),
    vocabularyEntries[0].id,
    timestamp,
  );
  await page.clock.setFixedTime(new Date("2026-10-25T09:00:00.000Z"));
  await page.addInitScript(
    ({ progressKey, reviewKey, progress, review }) => {
      if (localStorage.getItem(progressKey) === null)
        localStorage.setItem(progressKey, JSON.stringify(progress));
      if (localStorage.getItem(reviewKey) === null)
        localStorage.setItem(reviewKey, JSON.stringify(review));
    },
    {
      progressKey: PROGRESS_STORAGE_KEY,
      reviewKey: REVIEW_STORAGE_KEY,
      progress,
      review,
    },
  );
}

async function oldRecords(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => [key, localStorage.getItem(key)]),
    [PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY],
  );
}

async function openTraining(page: Page) {
  await page.goto("/character-practice");
  await expect(
    page.getByRole("button", { name: "このセットで覚える", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("radio", { name: "音声から文字", exact: true }),
  ).toBeChecked();
  expect((await speechState(page)).calls).toHaveLength(0);
}

function quizRegion(page: Page) {
  return page.getByRole("region", { name: "文字チャレンジ", exact: true });
}

async function startChallenge(page: Page) {
  await page
    .getByRole("button", { name: "すぐに8問チャレンジ", exact: true })
    .click();
  await expect(quizRegion(page)).toHaveAttribute(
    "data-kind",
    "audio-to-letter",
  );
}

async function currentTarget(page: Page) {
  const id = await quizRegion(page).getAttribute("data-character-id");
  const entry = alphabetCharacters.find((entry) => entry.id === id);
  if (!entry) throw new Error("Missing question character");
  return entry;
}

async function expectHiddenName(page: Page) {
  const quiz = quizRegion(page);
  const target = await currentTarget(page);
  await expect(
    quiz.getByRole("heading", { name: "聞こえた名前の文字は？", exact: true }),
  ).toBeVisible();
  await expect(quiz).not.toContainText(target.name);
  const cue = target.meaning.slice(
    0,
    target.meaning.lastIndexOf(`の ${target.thai}`),
  );
  await expect(quiz).not.toContainText(cue);
  await expect(quiz).not.toContainText(target.initialIpa);
  await expect(
    quiz.getByRole("button", { name: "答えを確認", exact: true }),
  ).toBeDisabled();
  await expect(
    quiz.getByRole("button", { name: "わからない", exact: true }),
  ).toBeDisabled();
  return target;
}

async function selectOption(page: Page, id: string) {
  const option = quizRegion(page).locator(
    `[data-option-id=${JSON.stringify(id)}]`,
  );
  await option.locator("..").click();
  await expect(option).toBeChecked();
}

async function answerAudioQuestion(
  page: Page,
  action: "correct" | "wrong" | "skip" = "correct",
) {
  const quiz = quizRegion(page);
  const target = await expectHiddenName(page);
  const callsBefore = (await speechState(page)).calls.length;
  if (action !== "skip") {
    const optionIds = await quiz
      .getByRole("radio")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-option-id")),
      );
    const optionId =
      action === "correct"
        ? target.id
        : optionIds.find((id) => id !== target.id);
    if (!optionId) throw new Error("Missing answer option");
    await selectOption(page, optionId);
    await expect(
      quiz.getByRole("button", { name: "答えを確認", exact: true }),
    ).toBeDisabled();
  }
  await quiz
    .getByRole("button", { name: "問題の音声を聞く", exact: true })
    .click();
  await expect(
    quiz.getByRole("button", {
      name: action === "skip" ? "わからない" : "答えを確認",
      exact: true,
    }),
  ).toBeEnabled();
  const calls = (await speechState(page)).calls;
  expect(calls).toHaveLength(callsBefore + 1);
  expect(calls.at(-1)).toEqual({
    text: target.name,
    lang: "th-TH",
    voice: "th-TH",
  });
  await quiz
    .getByRole("button", {
      name: action === "skip" ? "わからない" : "答えを確認",
      exact: true,
    })
    .click();
  const feedback = quiz.getByRole("status").filter({ hasText: target.name });
  await expect(feedback).toContainText("対応する文字は");
  await expect(feedback).toContainText(
    action === "correct" ? "そのとおり！" : "ペナルティはありません",
  );
  await expect(
    feedback.getByRole("button", { name: "正解の文字名を聞く", exact: true }),
  ).toBeEnabled();
  await expect(
    feedback.getByRole("button", { name: "正解の例語を聞く", exact: true }),
  ).toBeEnabled();
  for (const option of await quiz.getByRole("radio").all())
    await expect(option).toBeDisabled();
  return target;
}

async function nextQuestion(page: Page, index: number) {
  await quizRegion(page)
    .getByRole("button", {
      name: index === 7 ? "結果を見る" : "次の文字へ",
      exact: true,
    })
    .click();
}

test("聞いて覚える操作から8問の音声問題を完了し、最初の回答と独立した記録だけを保存する", async ({
  page,
}) => {
  await installSpeechStub(page);
  await seedExistingLearning(page);
  await openTraining(page);
  const before = await oldRecords(page);
  await page
    .getByRole("button", { name: "このセットで覚える", exact: true })
    .click();
  const learn = page.getByRole("region", {
    name: "文字をおぼえる",
    exact: true,
  });
  await expect(
    learn.getByRole("heading", { name: "聞く。読む。思い出す。", exact: true }),
  ).toBeVisible();
  await expect(learn).toContainText("端末合成音声（未監修）");
  await expect(learn).toContainText("通信する場合があります");
  expect((await speechState(page)).calls).toHaveLength(0);
  const first = alphabetCharacters.find((entry) => entry.id === "ko-kai");
  if (!first) throw new Error("Missing first character");
  await learn
    .getByRole("button", { name: "文字の名前を聞く", exact: true })
    .click();
  await expect(
    learn.getByRole("button", { name: "文字の名前を聞く", exact: true }),
  ).toBeVisible();
  expect((await speechState(page)).calls.at(-1)?.text).toBe(first.name);
  await learn.getByRole("button", { name: "例語を聞く", exact: true }).click();
  await expect(
    learn.getByRole("button", { name: "例語を聞く", exact: true }),
  ).toBeVisible();
  expect((await speechState(page)).calls.at(-1)?.text).toBe(first.example.thai);
  await learn
    .getByRole("button", { name: "名前をかくす", exact: true })
    .click();
  await expect(learn).not.toContainText(first.name);
  await expect(
    learn.getByRole("button", { name: "文字の名前を聞く", exact: true }),
  ).toBeEnabled();
  await expect(
    learn.getByRole("button", { name: "例語を聞く", exact: true }),
  ).toBeEnabled();
  await learn
    .getByRole("button", { name: "8問チャレンジをはじめる", exact: true })
    .click();
  for (let index = 0; index < 8; index += 1) {
    await expect(quizRegion(page)).toHaveAttribute(
      "data-question-index",
      String(index + 1),
    );
    const count = (await speechState(page)).calls.length;
    await answerAudioQuestion(
      page,
      index === 1 ? "wrong" : index === 2 ? "skip" : "correct",
    );
    expect((await savedTraining(page)).sessionsCompleted).toBe(0);
    expect((await savedTraining(page)).records).toEqual({});
    await nextQuestion(page, index);
    expect((await speechState(page)).calls).toHaveLength(count + 1);
  }
  await expect(
    page.getByRole("heading", {
      name: "8問の文字練習、おつかれさま。",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await savedTraining(page);
  expect(saved.mode).toBe("audio-to-letter");
  expect(saved.sessionsCompleted).toBe(1);
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.correct,
      0,
    ),
  ).toBe(6);
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.incorrect,
      0,
    ),
  ).toBe(2);
  expect(await oldRecords(page)).toEqual(before);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "音声から文字", exact: true }),
  ).toBeChecked();
  expect(await savedTraining(page)).toEqual(saved);
  expect((await speechState(page)).calls).toHaveLength(0);
  expect(await oldRecords(page)).toEqual(before);
});

test("停止・再生エラー・遅延した完了通知では回答を解放せず、画面移動で再生を破棄する", async ({
  page,
}) => {
  await installSpeechStub(page, "thai", "manual");
  await openTraining(page);
  await startChallenge(page);
  const target = await expectHiddenName(page);
  await selectOption(page, target.id);
  const quiz = quizRegion(page);
  const check = quiz.getByRole("button", { name: "答えを確認", exact: true });
  const play = quiz.getByRole("button", {
    name: "問題の音声を聞く",
    exact: true,
  });
  await play.click();
  await expect(check).toBeDisabled();
  await expect(
    quiz.getByRole("button", { name: "わからない", exact: true }),
  ).toBeDisabled();
  await quiz
    .getByRole("button", { name: "問題の音声を停止", exact: true })
    .click();
  await speechEvent(page, "finish", 0);
  await expect(check).toBeDisabled();
  await play.click();
  await speechEvent(page, "error", 1);
  await expect(
    quiz
      .getByRole("status")
      .filter({ hasText: "合成音声を再生できませんでした" }),
  ).toBeVisible();
  await expect(
    quiz.getByRole("button", {
      name: "文字だけの練習に切り替える",
      exact: true,
    }),
  ).toBeVisible();
  await speechEvent(page, "finish", 1);
  await expect(check).toBeDisabled();
  await play.click();
  const beforeNavigation = await speechState(page);
  await page.locator('a[href="/characters"]:visible').first().click();
  await expect(page).toHaveURL(/\/characters$/);
  expect((await speechState(page)).cancels).toBeGreaterThan(
    beforeNavigation.cancels,
  );
  await speechEvent(page, "finish", 2);
  await page.locator('a[href="/character-practice"]:visible').first().click();
  await expect(
    page.getByRole("button", { name: "すぐに8問チャレンジ", exact: true }),
  ).toBeEnabled();
  await startChallenge(page);
  await expectHiddenName(page);
  expect((await speechState(page)).calls).toHaveLength(3);
  await selectOption(page, (await currentTarget(page)).id);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await speechEvent(page, "throw-next");
    await play.click();
    await expect(
      quiz
        .getByRole("status")
        .filter({ hasText: "合成音声を開始できませんでした" }),
    ).toBeVisible();
    await expect(play).toBeEnabled();
    await expect(check).toBeDisabled();
  }
  expect((await speechState(page)).calls).toHaveLength(5);
  expect((await savedTraining(page)).records).toEqual({});
  expect((await savedTraining(page)).sessionsCompleted).toBe(0);
});

test("タイ語音声がない場合は日本語で代用せず、文字だけの練習へ切り替えられる", async ({
  page,
}) => {
  await installSpeechStub(page, "no-thai");
  await openTraining(page);
  await startChallenge(page);
  await expectHiddenName(page);
  await expect(
    quizRegion(page)
      .getByRole("status")
      .filter({ hasText: "タイ語の合成音声を利用できません" }),
  ).toBeVisible();
  await expect(
    quizRegion(page).getByRole("button", {
      name: "問題の音声を聞く",
      exact: true,
    }),
  ).toBeDisabled();
  expect((await speechState(page)).calls).toHaveLength(0);
  await quizRegion(page)
    .getByRole("button", { name: "文字だけの練習に切り替える", exact: true })
    .click();
  const learn = page.getByRole("region", {
    name: "文字をおぼえる",
    exact: true,
  });
  await expect(learn).toContainText("途中の回答は記録しません");
  await learn
    .getByRole("button", { name: "8問チャレンジをはじめる", exact: true })
    .click();
  const quiz = quizRegion(page);
  await expect(quiz).toHaveAttribute("data-kind", "name-to-letter");
  const target = await currentTarget(page);
  await selectOption(page, target.id);
  await expect(
    quiz.getByRole("button", { name: "答えを確認", exact: true }),
  ).toBeEnabled();
  await quiz.getByRole("button", { name: "答えを確認", exact: true }).click();
  await expect(quiz.getByRole("status")).toContainText(target.name);
  expect((await speechState(page)).calls).toHaveLength(0);
  expect((await savedTraining(page)).mode).toBe("name-to-letter");
  expect((await savedTraining(page)).records).toEqual({});
});

test("遅れて利用可能になった音声を自動再生せず、320px幅・字体切替・キーボードで聞いて答える", async ({
  page,
}, testInfo) => {
  await installSpeechStub(page, "delayed", "manual");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTraining(page);
  await startChallenge(page);
  const target = await expectHiddenName(page);
  const quiz = quizRegion(page);
  const play = quiz.getByRole("button", {
    name: "問題の音声を聞く",
    exact: true,
  });
  await expect(play).toBeDisabled();
  await speechEvent(page, "voices");
  await expect(play).toBeEnabled();
  expect((await speechState(page)).calls).toHaveLength(0);
  const font = page.getByRole("switch", {
    name: "ループなしのタイ語フォント",
    exact: true,
  });
  await font.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    "loopless",
  );
  const option = quiz.locator(`[data-option-id=${JSON.stringify(target.id)}]`);
  await option.focus();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  await expect(quiz.locator('[lang="th"]').first()).toHaveCSS(
    "font-family",
    /Noto Sans Thai Variable/,
  );
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(
    quiz.getByRole("button", { name: "問題の音声を停止", exact: true }),
  ).toBeVisible();
  await expect(
    quiz.getByRole("button", { name: "答えを確認", exact: true }),
  ).toBeDisabled();
  await speechEvent(page, "finish");
  const check = quiz.getByRole("button", { name: "答えを確認", exact: true });
  await expect(check).toBeEnabled();
  await check.focus();
  await page.keyboard.press("Enter");
  await expect(
    quiz.getByRole("status").filter({ hasText: target.name }),
  ).toContainText("そのとおり！");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.evaluate(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  await page.screenshot({
    path: testInfo.outputPath("character-audio-320px.png"),
    fullPage: true,
  });
  await nextQuestion(page, 0);
  await expectHiddenName(page);
  expect((await speechState(page)).calls).toHaveLength(1);
});

test("初頭音が同じข・คも全文の字母名を聞いて区別し、8問を完了できる", async ({
  page,
}) => {
  await installSpeechStub(page);
  await openTraining(page);
  const setup = page.getByRole("region", {
    name: "文字トレーニングの設定",
    exact: true,
  });
  await setup
    .locator("summary")
    .filter({ hasText: "44文字からカスタム" })
    .click();
  for (const id of ["ko-kai", "mo-ma", "no-nu", "ngo-ngu"])
    await page.getByTestId(`training-selection-${id}`).click();
  for (const id of ["kho-khai", "kho-khwai"])
    await page.getByTestId(`training-selection-${id}`).click();
  await startChallenge(page);
  const names = new Set<string>();
  for (let index = 0; index < 8; index += 1) {
    await expect(quizRegion(page).getByRole("radio")).toHaveCount(2);
    names.add((await answerAudioQuestion(page)).name);
    await nextQuestion(page, index);
  }
  expect([...names].sort()).toEqual(["ข ไข่", "ค ควาย"].sort());
  const calls = (await speechState(page)).calls;
  expect(calls).toHaveLength(8);
  expect(new Set(calls.map((call) => call.text))).toEqual(names);
  expect(
    calls.every((call) => call.lang === "th-TH" && call.voice === "th-TH"),
  ).toBe(true);
  const saved = await savedTraining(page);
  expect(saved.sessionsCompleted).toBe(1);
  expect(saved.mode).toBe("audio-to-letter");
  expect(saved.selectedIds.sort()).toEqual(["kho-khai", "kho-khwai"].sort());
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.correct,
      0,
    ),
  ).toBe(8);
});

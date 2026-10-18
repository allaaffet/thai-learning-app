import { expect, test, type Page } from "@playwright/test";
import { lessons } from "../src/data/curriculum";
import { vocabularyEntries } from "../src/data/language";
import {
  getTotalXp,
  isLearningProgress,
  PROGRESS_STORAGE_KEY,
} from "../src/lib/progress";
import { REVIEW_STORAGE_KEY } from "../src/lib/review";

const SOUND_KEY = "thai-learning.sound.v1";
const lesson = lessons[0];

// Test doubles exercise scheduling and controls; they do not assess audible quality.
async function installAudio(
  page: Page,
  mode: "working" | "unsupported" | "failure" = "working",
) {
  await page.addInitScript((audioMode) => {
    const state = { contexts: 0, resumes: 0, starts: [] as number[], stops: 0 };
    Object.defineProperty(window, "__soundEffectsTest", { value: state });
    class Param {
      value = 0;
      setValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      linearRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      exponentialRampToValueAtTime(value: number) {
        this.value = value;
        return this;
      }
      setTargetAtTime(value: number) {
        this.value = value;
        return this;
      }
      cancelScheduledValues() {
        return this;
      }
    }
    class Oscillator {
      frequency = new Param();
      type = "sine";
      onended: (() => void) | null = null;
      timer: number | undefined;
      connect() {
        return this;
      }
      disconnect() {}
      start() {
        state.starts.push(this.frequency.value);
      }
      stop(when?: number) {
        state.stops += 1;
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(
          () => this.onended?.(),
          Math.max(0, ((when ?? 0) - performance.now() / 1_000) * 1_000),
        );
      }
    }
    class Context {
      state = "suspended";
      destination = {};
      onstatechange: (() => void) | null = null;
      constructor() {
        state.contexts += 1;
        if (audioMode === "failure") throw new Error("Audio unavailable");
      }
      get currentTime() {
        return performance.now() / 1_000;
      }
      async resume() {
        state.resumes += 1;
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createOscillator() {
        return new Oscillator();
      }
      createGain() {
        return { gain: new Param(), connect() {}, disconnect() {} };
      }
      addEventListener() {}
      removeEventListener() {}
    }
    for (const name of ["AudioContext", "webkitAudioContext"])
      Object.defineProperty(window, name, {
        configurable: true,
        value: audioMode === "unsupported" ? undefined : Context,
      });
  }, mode);
}

async function audioState(page: Page) {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__soundEffectsTest");
    if (typeof value !== "object" || value === null)
      throw new Error("Missing audio double");
    const starts: unknown = Reflect.get(value, "starts");
    if (
      !Array.isArray(starts) ||
      !starts.every((note: unknown) => typeof note === "number")
    )
      throw new Error("Invalid notes");
    return {
      contexts: Number(Reflect.get(value, "contexts")),
      resumes: Number(Reflect.get(value, "resumes")),
      stops: Number(Reflect.get(value, "stops")),
      starts: starts as number[],
    };
  });
}

async function settings(page: Page) {
  await page.getByRole("button", { name: "効果音の設定", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "効果音の設定", exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function enableSound(page: Page) {
  const panel = await settings(page);
  await panel
    .getByRole("switch", { name: "効果音を有効にする", exact: true })
    .check();
  await panel
    .getByRole("button", { name: "設定を閉じる", exact: true })
    .click();
}

async function enterQuiz(page: Page) {
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
}

async function expectXp(page: Page, xp: number) {
  const value: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PROGRESS_STORAGE_KEY);
  if (value === null) {
    expect(xp).toBe(0);
    return;
  }
  if (!isLearningProgress(value)) throw new Error("Invalid progress");
  expect(getTotalXp(value)).toBe(xp);
}

test("効果音は初期OFFで勝手に再生せず、音量とON/OFFを保存できる", async ({
  page,
}) => {
  await installAudio(page);
  await page.goto("/");
  expect((await audioState(page)).contexts).toBe(0);
  let panel = await settings(page);
  const toggle = panel.getByRole("switch", {
    name: "効果音を有効にする",
    exact: true,
  });
  await expect(toggle).not.toBeChecked();
  await expect(
    panel.getByRole("slider", { name: "効果音の音量", exact: true }),
  ).toHaveValue("35");
  await expect(
    panel.getByRole("button", { name: "効果音を試す", exact: true }),
  ).toBeDisabled();
  await toggle.check();
  const volume = panel.getByRole("slider", {
    name: "効果音の音量",
    exact: true,
  });
  await volume.focus();
  await volume.press("Home");
  for (let step = 0; step < 4; step++) await volume.press("ArrowRight");
  await panel
    .getByRole("button", { name: "効果音を試す", exact: true })
    .click();
  await expect
    .poll(async () => (await audioState(page)).starts.length)
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      SOUND_KEY,
    ),
  ).toEqual({ version: 1, enabled: true, volume: 0.2 });
  await page.reload();
  expect((await audioState(page)).contexts).toBe(0);
  panel = await settings(page);
  await expect(
    panel.getByRole("switch", { name: "効果音を有効にする", exact: true }),
  ).toBeChecked();
  await expect(
    panel.getByRole("slider", { name: "効果音の音量", exact: true }),
  ).toHaveValue("20");
  await panel
    .getByRole("slider", { name: "効果音の音量", exact: true })
    .press("Home");
  await expect(
    panel.getByRole("button", { name: "効果音を試す", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole("switch", { name: "効果音を有効にする", exact: true })
    .uncheck();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "効果音の設定", exact: true }),
  ).toBeFocused();
  await page.goto(`/lessons/${lesson.id}`);
  await enterQuiz(page);
  await page
    .getByRole("radio", {
      name: lesson.exercises[0].options[0].label,
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "答えを確認", exact: true }).click();
  expect((await audioState(page)).contexts).toBe(0);
  await expectXp(page, 0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
});

test("正解と再確認は異なる短い音で伝え、完了音は完了操作の一度だけ鳴る", async ({
  page,
}) => {
  await installAudio(page);
  await page.goto(`/lessons/${lesson.id}`);
  await enableSound(page);
  await enterQuiz(page);
  const patterns: number[][] = [];
  for (const [index, exercise] of lesson.exercises.entries()) {
    const wrong = index === 0;
    const answer = exercise.options.find((option) =>
      wrong ? option.id !== exercise.answerId : option.id === exercise.answerId,
    );
    if (!answer) throw new Error("Missing answer");
    const before = (await audioState(page)).starts.length;
    await page.getByRole("radio", { name: answer.label, exact: true }).check();
    expect((await audioState(page)).starts).toHaveLength(before);
    const confirm = page.getByRole("button", {
      name: "答えを確認",
      exact: true,
    });
    await confirm.click();
    await expect(confirm).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: answer.label, exact: true }),
    ).toBeDisabled();
    await expect
      .poll(async () => (await audioState(page)).starts.length)
      .toBeGreaterThan(before);
    patterns.push((await audioState(page)).starts.slice(before));
    await page
      .getByRole("button", {
        name:
          index === lesson.exercises.length - 1 ? "結果を見る" : "次の問題へ",
        exact: true,
      })
      .click();
  }
  expect(patterns[0]).not.toEqual(patterns[1]);
  const beforeComplete = (await audioState(page)).starts.length;
  await expectXp(page, 0);
  await page
    .getByRole("button", { name: "レッスンを完了する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "レッスン完了！", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await audioState(page)).starts.length)
    .toBeGreaterThan(beforeComplete);
  await expectXp(page, lesson.xp);
  await page.reload();
  expect((await audioState(page)).contexts).toBe(0);
  await expectXp(page, lesson.xp);
});

test("復習の自己評価は静かに記録し、復習を終える操作でだけ完了音を鳴らす", async ({
  page,
}) => {
  await installAudio(page);
  const id = vocabularyEntries[0].id;
  await page.addInitScript(
    ({ key, id }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            cards: {
              [id]: {
                id,
                dueAt: "2020-01-01T00:00:00.000Z",
                intervalDays: 0,
                stage: 0,
                lapses: 0,
                reviewCount: 0,
              },
            },
            history: [],
          }),
        );
    },
    { key: REVIEW_STORAGE_KEY, id },
  );
  await page.goto("/review");
  await enableSound(page);
  await page
    .getByRole("button", { name: "今日の復習をはじめる", exact: true })
    .click();
  await page.getByRole("button", { name: "答えを表示", exact: true }).click();
  await page.getByRole("button", { name: "思い出せた", exact: true }).click();
  expect((await audioState(page)).starts).toHaveLength(0);
  await page.getByRole("button", { name: "復習を終える", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "今日の復習、おつかれさまでした。",
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await audioState(page)).starts.length)
    .toBeGreaterThan(0);
  await expectXp(page, 0);
  await page.reload();
  expect((await audioState(page)).contexts).toBe(0);
  await expectXp(page, 0);
});

test("教材の読み上げ・音声認識・マイク許可待ちの間は効果音を重ねない", async ({
  page,
}) => {
  await installAudio(page);
  await page.addInitScript(() => {
    class Utterance {
      text: string;
      lang = "";
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    class Synthesis extends EventTarget {
      getVoices() {
        return [
          {
            name: "Thai test voice",
            lang: "th-TH",
            voiceURI: "test",
            default: true,
            localService: true,
          },
        ];
      }
      speak(utterance: Utterance) {
        utterance.onstart?.();
      }
      cancel() {}
    }
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onstart?.();
      }
      abort() {
        this.onend?.();
      }
      stop() {
        this.onend?.();
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
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: Recognition,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => {}) },
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: class {
        static isTypeSupported() {
          return true;
        }
      },
    });
  });
  await page.goto(`/lessons/${lesson.id}`);
  await enableSound(page);
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "言葉を入力・録音する練習",
    exact: true,
  });
  await practice
    .getByRole("button", { name: "声で確かめる", exact: true })
    .click();
  const model = page.locator("#explore-detail");
  const suppressedPreview = async () => {
    const before = (await audioState(page)).starts.length;
    const panel = await settings(page);
    const preview = panel.getByRole("button", {
      name: "効果音を試す",
      exact: true,
    });
    if (await preview.isEnabled()) await preview.click();
    expect((await audioState(page)).starts).toHaveLength(before);
    await panel
      .getByRole("button", { name: "設定を閉じる", exact: true })
      .click();
  };
  await model
    .getByRole("button", { name: "合成音声で確認", exact: true })
    .click();
  await expect(
    model.getByRole("button", { name: "読み上げを停止", exact: true }),
  ).toBeVisible();
  await suppressedPreview();
  await model
    .getByRole("button", { name: "読み上げを停止", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "音声認識を始める", exact: true })
    .click();
  await expect(
    practice.getByRole("button", { name: "音声認識を取り消す", exact: true }),
  ).toBeVisible();
  await suppressedPreview();
  await practice
    .getByRole("button", { name: "音声認識を取り消す", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "録音を始める", exact: true })
    .click();
  await expect(
    practice.getByRole("button", { name: "録音の開始を取り消す", exact: true }),
  ).toBeVisible();
  await suppressedPreview();
  await practice
    .getByRole("button", { name: "録音の開始を取り消す", exact: true })
    .click();
  const panel = await settings(page);
  await panel
    .getByRole("button", { name: "効果音を試す", exact: true })
    .click();
  await expect
    .poll(async () => (await audioState(page)).starts.length)
    .toBeGreaterThan(0);
  await expectXp(page, 0);
});

for (const mode of ["unsupported", "failure"] as const) {
  test(`効果音APIの${mode}時もクイズの正誤と進捗は通常どおり動く`, async ({
    page,
  }) => {
    await installAudio(page, mode);
    await page.goto(`/lessons/${lesson.id}`);
    await enableSound(page);
    await enterQuiz(page);
    const exercise = lesson.exercises[0];
    const answer = exercise.options.find(
      (item) => item.id === exercise.answerId,
    );
    if (!answer) throw new Error("Missing answer");
    await page.getByRole("radio", { name: answer.label, exact: true }).check();
    await page.getByRole("button", { name: "答えを確認", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: exercise.explanation }),
    ).toContainText("正解");
    await expect(
      page.getByRole("button", { name: "次の問題へ", exact: true }),
    ).toBeEnabled();
    expect((await audioState(page)).starts).toHaveLength(0);
    await expectXp(page, 0);
  });
}

test("壊れた保存設定は音を鳴らさず、学習の保存領域を変更しない", async ({
  page,
}) => {
  await installAudio(page);
  const invalid = JSON.stringify({ version: 7, enabled: true, volume: 80 });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key: SOUND_KEY,
    raw: invalid,
  });
  await page.goto("/");
  const panel = await settings(page);
  await expect(
    panel.getByRole("switch", { name: "効果音を有効にする", exact: true }),
  ).not.toBeChecked();
  expect((await audioState(page)).contexts).toBe(0);
  await expectXp(page, 0);
});

test("スマートフォンからタブレット・PCの幅でも効果音設定を開閉できる", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 390, 760, 768, 820, 960, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const trigger = page.getByRole("button", {
      name: "効果音の設定",
      exact: true,
    });
    await expect(trigger).toBeVisible();
    const panel = await settings(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      )
      .toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

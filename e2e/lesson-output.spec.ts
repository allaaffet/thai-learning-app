import { expect, test, type Locator, type Page } from "@playwright/test";
import { PROGRESS_STORAGE_KEY } from "../src/lib/progress";

// Browser doubles verify controls and cleanup, not Thai pronunciation or ASR accuracy.
async function installSpeechStub(page: Page) {
  await page.addInitScript(() => {
    const calls: { text: string; lang: string }[] = [];
    Object.defineProperty(window, "__lessonSpeechTest", { value: { calls } });
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
      timer: number | undefined;
      getVoices() {
        return [
          {
            name: "Thai lesson test voice",
            lang: "th-TH",
            voiceURI: "th-test",
            default: true,
            localService: true,
          },
        ];
      }
      speak(utterance: Utterance) {
        calls.push({ text: utterance.text, lang: utterance.lang });
        utterance.onstart?.();
        this.timer = window.setTimeout(() => utterance.onend?.(), 60);
      }
      cancel() {
        window.clearTimeout(this.timer);
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
  });
}

async function installRecognitionStub(
  page: Page,
  mode: "standard" | "webkit" | "unsupported" = "standard",
) {
  await page.addInitScript((recognitionMode) => {
    const stats = { starts: 0, stops: 0, aborts: 0, languages: [] as string[] };
    const instances: Recognition[] = [];
    function result(text: string, final: boolean) {
      return {
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: final, 0: { transcript: text, confidence: 0.99 } },
        },
      };
    }
    class Recognition {
      lang = "";
      continuous = true;
      interimResults = true;
      maxAlternatives = 9;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      savedResult: ((event: unknown) => void) | null = null;
      constructor() {
        instances.push(this);
      }
      start() {
        stats.starts += 1;
        stats.languages.push(this.lang);
        this.savedResult = this.onresult;
        this.onstart?.();
      }
      stop() {
        stats.stops += 1;
      }
      abort() {
        stats.aborts += 1;
      }
    }
    const control = {
      stats,
      final(text: string, index = instances.length - 1) {
        instances[index]?.onresult?.(result(text, true));
      },
      interim(text: string, index = instances.length - 1) {
        instances[index]?.onresult?.(result(text, false));
      },
      late(text: string, index = instances.length - 1) {
        instances[index]?.savedResult?.(result(text, true));
      },
      error(code: string, index = instances.length - 1) {
        instances[index]?.onerror?.({ error: code });
      },
    };
    Object.defineProperty(window, "__lessonRecognitionTest", {
      value: control,
    });
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: recognitionMode === "standard" ? Recognition : undefined,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: recognitionMode === "webkit" ? Recognition : undefined,
    });
  }, mode);
}

async function recognitionAction(
  page: Page,
  action: "final" | "interim" | "late" | "error",
  value: string,
  index?: number,
) {
  await page.evaluate(
    ({ action, value, index }) => {
      const control: unknown = Reflect.get(window, "__lessonRecognitionTest");
      if (typeof control !== "object" || control === null)
        throw new Error("Recognition stub missing");
      const invoke: unknown = Reflect.get(control, action);
      if (typeof invoke !== "function")
        throw new Error("Recognition stub action missing");
      Reflect.apply(
        invoke,
        control,
        index === undefined ? [value] : [value, index],
      );
    },
    { action, value, index },
  );
}

async function recognitionState(page: Page) {
  return page.evaluate(() => {
    const control: unknown = Reflect.get(window, "__lessonRecognitionTest");
    if (typeof control !== "object" || control === null)
      throw new Error("Recognition stub missing");
    const stats: unknown = Reflect.get(control, "stats");
    if (typeof stats !== "object" || stats === null)
      throw new Error("Recognition stub stats missing");
    return {
      starts: Number(Reflect.get(stats, "starts")),
      stops: Number(Reflect.get(stats, "stops")),
      aborts: Number(Reflect.get(stats, "aborts")),
      languages: Reflect.get(stats, "languages"),
    };
  });
}

async function speechCalls(
  page: Page,
): Promise<{ text: string; lang: string }[]> {
  return page.evaluate(() => {
    const state: unknown = Reflect.get(window, "__lessonSpeechTest");
    if (typeof state !== "object" || state === null)
      throw new Error("Speech stub missing");
    const calls: unknown = Reflect.get(state, "calls");
    if (!Array.isArray(calls)) throw new Error("Speech stub calls missing");
    return calls.map((entry: unknown) => {
      if (typeof entry !== "object" || entry === null)
        throw new Error("Invalid speech call");
      const text: unknown = Reflect.get(entry, "text");
      const lang: unknown = Reflect.get(entry, "lang");
      if (typeof text !== "string" || typeof lang !== "string")
        throw new Error("Invalid speech call");
      return { text, lang };
    });
  });
}

async function openOutputPractice(page: Page): Promise<Locator> {
  await page.goto("/lessons/sounds-and-letters");
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const practice = page.getByRole("region", {
    name: "言葉を入力・録音する練習",
    exact: true,
  });
  await expect(practice).toBeVisible();
  return practice;
}

async function voiceMode(practice: Locator) {
  const mode = practice.getByRole("button", {
    name: "声で確かめる",
    exact: true,
  });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
}

async function expectProgressUntouched(page: Page) {
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test("既存レッスンの見本を聞き、文字入力で声調記号を区別しても進捗とXPは変わらない", async ({
  page,
}) => {
  await installSpeechStub(page);
  await installRecognitionStub(page);
  await page.goto("/lessons/sounds-and-letters");
  const example = page.locator(".example-card").first();
  const exampleThai = (
    await example.locator(".example-thai").textContent()
  )?.trim();
  if (!exampleThai) throw new Error("Learnの見本がありません。");
  expect(await speechCalls(page)).toEqual([]);
  await example
    .getByRole("button", { name: "合成音声で確認", exact: true })
    .click();
  await expect
    .poll(async () => (await speechCalls(page)).at(-1))
    .toEqual({ text: exampleThai, lang: "th-TH" });
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  const explore = page.locator("#explore-detail");
  const exploreThai = (
    await explore.locator("[lang=th]").first().textContent()
  )?.trim();
  if (!exploreThai) throw new Error("Exploreの見本がありません。");
  await explore
    .getByRole("button", { name: "合成音声で確認", exact: true })
    .click();
  await expect
    .poll(async () => (await speechCalls(page)).at(-1))
    .toEqual({ text: exploreThai, lang: "th-TH" });

  const practice = page.getByRole("region", {
    name: "言葉を入力・録音する練習",
    exact: true,
  });
  const typedMode = practice.getByRole("button", {
    name: "文字で答える",
    exact: true,
  });
  await expect(typedMode).toHaveAttribute("aria-pressed", "true");
  const answer = practice.getByRole("textbox", {
    name: "タイ語で回答",
    exact: true,
  });
  const check = practice.getByRole("button", {
    name: "文字の答えを確認",
    exact: true,
  });
  await check.click();
  await expect(practice.getByRole("status")).toContainText(
    "タイ文字を入力してください",
  );
  await answer.fill("ม้า");
  await check.click();
  await expect(practice.getByRole("status")).toContainText(
    "見本と見比べてみましょう",
  );
  await expect(answer).toHaveValue("ม้า");
  await answer.fill(" มา ");
  await answer.press("Enter");
  await expect(practice.getByRole("status")).toContainText("正しい綴りです");
  expect((await recognitionState(page)).starts).toBe(0);
  await expectProgressUntouched(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "練習問題", exact: true }),
  ).toBeVisible();
  await expectProgressUntouched(page);
});

test("明示して始めた音声認識の確定文字列を比較し、発音の点数として扱わない", async ({
  page,
}, testInfo) => {
  await installSpeechStub(page);
  await installRecognitionStub(page, "webkit");
  const practice = await openOutputPractice(page);
  await voiceMode(practice);
  await expect(practice).toContainText("発音・声調の自動採点は行いません");
  await expect(practice).toContainText("送信される場合があります");
  const start = practice.getByRole("button", {
    name: "音声認識を始める",
    exact: true,
  });
  await expect(start).toBeEnabled();
  expect((await recognitionState(page)).starts).toBe(0);
  await start.click();
  await expect.poll(async () => (await recognitionState(page)).starts).toBe(1);
  expect((await recognitionState(page)).languages).toEqual(["th-TH"]);
  await expect(
    practice.getByRole("button", { name: "録音を始める", exact: true }),
  ).toBeDisabled();
  await expect(
    practice.getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator("#explore-detail")
      .getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeDisabled();
  await recognitionAction(page, "interim", "ม้า");
  await expect(practice.getByTestId("recognized-transcript")).toHaveCount(0);
  await recognitionAction(page, "final", "มา");
  await expect(practice.getByTestId("recognized-transcript")).toHaveText("มา");
  await expect(practice).toContainText("一致しました（参考）");
  await expect(start).toBeEnabled();
  await start.click();
  await recognitionAction(page, "final", "ม้า");
  await expect(practice.getByTestId("recognized-transcript")).toHaveText("ม้า");
  await expect(practice).toContainText("見本とは異なる文字列です（参考）");
  await expectProgressUntouched(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("lesson-voice-practice.png"),
    fullPage: true,
  });
});

for (const [error, expectedMessage] of [
  ["no-speech", "音声を検出できませんでした"],
  ["not-allowed", "マイクの使用が許可されていません"],
] as const) {
  test(`音声認識の${error}を案内し、文字入力へ戻れる`, async ({ page }) => {
    await installSpeechStub(page);
    await installRecognitionStub(page);
    const practice = await openOutputPractice(page);
    await voiceMode(practice);
    const start = practice.getByRole("button", {
      name: "音声認識を始める",
      exact: true,
    });
    await start.click();
    await recognitionAction(page, "error", error);
    await expect(
      practice.getByRole("status").filter({ hasText: expectedMessage }),
    ).toBeVisible();
    await expect(practice.getByTestId("recognized-transcript")).toHaveCount(0);
    await expect(start).toBeEnabled();
    await practice
      .getByRole("button", { name: "文字で答える", exact: true })
      .click();
    await practice
      .getByRole("textbox", { name: "タイ語で回答", exact: true })
      .fill("มา");
    await practice
      .getByRole("button", { name: "文字の答えを確認", exact: true })
      .click();
    await expect(practice.getByRole("status")).toContainText("正しい綴りです");
    await expectProgressUntouched(page);
  });
}

test("音声認識の停止・レッスン移動後に届いた古い結果を回答として表示しない", async ({
  page,
}) => {
  await installSpeechStub(page);
  await installRecognitionStub(page);
  const practice = await openOutputPractice(page);
  await voiceMode(practice);
  const start = practice.getByRole("button", {
    name: "音声認識を始める",
    exact: true,
  });
  await start.click();
  await practice
    .getByRole("button", { name: "音声認識を取り消す", exact: true })
    .click();
  await expect.poll(async () => (await recognitionState(page)).aborts).toBe(1);
  await recognitionAction(page, "late", "ม้า", 0);
  await expect(practice.getByTestId("recognized-transcript")).toHaveCount(0);
  await start.click();
  await recognitionAction(page, "late", "ม้า", 0);
  await expect(practice.getByTestId("recognized-transcript")).toHaveCount(0);
  await recognitionAction(page, "final", "มา", 1);
  await expect(practice.getByTestId("recognized-transcript")).toHaveText("มา");
  await start.click();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
  await expect(practice).toHaveCount(0);
  await expect.poll(async () => (await recognitionState(page)).aborts).toBe(2);
  await recognitionAction(page, "late", "ม้า", 2);
  await page.getByRole("button", { name: "確認する", exact: true }).click();
  await voiceMode(practice);
  await expect(practice.getByTestId("recognized-transcript")).toHaveCount(0);
  await expectProgressUntouched(page);
});

test("音声認識が非対応でも文字入力で練習できる", async ({ page }) => {
  await installSpeechStub(page);
  await installRecognitionStub(page, "unsupported");
  const practice = await openOutputPractice(page);
  await voiceMode(practice);
  await expect(
    practice
      .getByRole("status")
      .filter({ hasText: /音声認識.*対応|対応.*音声認識/ }),
  ).toBeVisible();
  const start = practice.getByRole("button", {
    name: "音声認識を始める",
    exact: true,
  });
  await expect(start).toBeDisabled();
  expect((await recognitionState(page)).starts).toBe(0);
  await practice
    .getByRole("button", { name: "文字で答える", exact: true })
    .click();
  await practice
    .getByRole("textbox", { name: "タイ語で回答", exact: true })
    .fill("มา");
  await practice
    .getByRole("button", { name: "文字の答えを確認", exact: true })
    .click();
  await expect(practice.getByRole("status")).toContainText("正しい綴りです");
  await expectProgressUntouched(page);
});

async function installRecorderStub(page: Page) {
  await page.addInitScript(() => {
    const stats = {
      requests: 0,
      starts: 0,
      stops: 0,
      trackStops: 0,
      urls: [] as string[],
      revoked: [] as string[],
    };
    Object.defineProperty(window, "__lessonRecorderTest", { value: stats });
    const mediaDevices = {
      async getUserMedia() {
        stats.requests += 1;
        return {
          getTracks: () => [
            {
              stop: () => {
                stats.trackStops += 1;
              },
            },
          ],
        };
      },
    };
    class Recorder extends EventTarget {
      state = "inactive";
      mimeType = "audio/wav";
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
        stats.starts += 1;
      }
      stop() {
        this.state = "inactive";
        stats.stops += 1;
        queueMicrotask(() => {
          const bytes = new Uint8Array(48);
          const view = new DataView(bytes.buffer);
          for (const [offset, text] of [
            [0, "RIFF"],
            [8, "WAVE"],
            [12, "fmt "],
            [36, "data"],
          ] as const)
            for (let index = 0; index < text.length; index += 1)
              bytes[offset + index] = text.charCodeAt(index);
          view.setUint32(4, 40, true);
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, 8_000, true);
          view.setUint32(28, 16_000, true);
          view.setUint16(32, 2, true);
          view.setUint16(34, 16, true);
          view.setUint32(40, 4, true);
          const event = new Event("dataavailable");
          Object.defineProperty(event, "data", {
            value: new Blob([bytes], { type: this.mimeType }),
          });
          this.dispatchEvent(event);
          this.dispatchEvent(new Event("stop"));
        });
      }
    }
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      stats.urls.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      stats.revoked.push(url);
      revoke(url);
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: mediaDevices,
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: Recorder,
    });
  });
}

async function recorderState(page: Page) {
  return page.evaluate(() => {
    const state: unknown = Reflect.get(window, "__lessonRecorderTest");
    if (typeof state !== "object" || state === null)
      throw new Error("Recorder stub missing");
    return {
      requests: Number(Reflect.get(state, "requests")),
      starts: Number(Reflect.get(state, "starts")),
      trackStops: Number(Reflect.get(state, "trackStops")),
      revoked: Reflect.get(state, "revoked"),
    };
  });
}

test("録音を明示して開始し、停止・削除・画面移動でマイクと再生URLを解放する", async ({
  page,
}) => {
  await installSpeechStub(page);
  await installRecognitionStub(page);
  await installRecorderStub(page);
  const practice = await openOutputPractice(page);
  await voiceMode(practice);
  const recorder = practice.getByRole("region", {
    name: "自分の声を録音",
    exact: true,
  });
  await expect(recorder).toContainText("保存・送信しません");
  expect((await recorderState(page)).requests).toBe(0);
  const start = recorder.getByRole("button", {
    name: "録音を始める",
    exact: true,
  });
  await start.click();
  await expect(recorder.getByRole("status")).toContainText("録音中です");
  expect((await recorderState(page)).requests).toBe(1);
  await expect(
    practice.getByRole("button", { name: "音声認識を始める", exact: true }),
  ).toBeDisabled();
  await expect(
    practice.getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator("#explore-detail")
      .getByRole("button", { name: "合成音声で確認", exact: true }),
  ).toBeDisabled();
  await recorder
    .getByRole("button", { name: "録音を止める", exact: true })
    .click();
  await expect(recorder.getByRole("status")).toContainText("録音できました");
  await expect(
    practice.getByRole("button", { name: "音声認識を始める", exact: true }),
  ).toBeEnabled();
  const audio = recorder.locator('audio[aria-label="自分の録音"]');
  await expect(audio).toHaveAttribute("controls", "");
  const url = await audio.getAttribute("src");
  expect(url).toMatch(/^blob:/);
  expect((await recorderState(page)).trackStops).toBe(1);
  await audio.evaluate((element) => element.dispatchEvent(new Event("error")));
  await expect(recorder.getByRole("status")).toContainText(
    "録音を再生できませんでした",
  );
  await recorder
    .getByRole("button", { name: "録音を削除", exact: true })
    .click();
  await expect(audio).toHaveCount(0);
  expect((await recorderState(page)).revoked).toContain(url);
  await start.click();
  await expect(recorder.getByRole("status")).toContainText("録音中です");
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
  await expect.poll(async () => (await recorderState(page)).trackStops).toBe(2);
  await expect(practice).toHaveCount(0);
  await expectProgressUntouched(page);
});

test("実際のMediaRecorderでテスト音を録音し、ブラウザでデコード・再生できる", async ({
  page,
}) => {
  await installSpeechStub(page);
  await installRecognitionStub(page, "unsupported");
  await page.addInitScript(() => {
    // Only microphone acquisition is replaced. Encoding, Blob URLs and playback
    // use the browser APIs. This generated sine wave does not test Thai speech.
    const streams: MediaStream[] = [];
    const contexts: AudioContext[] = [];
    const oscillators: OscillatorNode[] = [];
    Object.defineProperty(window, "__nativeLessonRecordingTest", {
      value: {
        trackStates: () =>
          streams.flatMap((stream) =>
            stream.getTracks().map((track) => track.readyState),
          ),
        async close() {
          for (const oscillator of oscillators) oscillator.stop();
          for (const stream of streams)
            for (const track of stream.getTracks()) track.stop();
          await Promise.all(contexts.map((context) => context.close()));
        },
      },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async getUserMedia() {
          const context = new AudioContext();
          const destination = context.createMediaStreamDestination();
          const oscillator = context.createOscillator();
          oscillator.type = "sine";
          oscillator.frequency.value = 440;
          const gain = context.createGain();
          gain.gain.value = 0.08;
          oscillator.connect(gain);
          gain.connect(destination);
          contexts.push(context);
          streams.push(destination.stream);
          oscillators.push(oscillator);
          oscillator.start();
          await context.resume();
          return destination.stream;
        },
      },
    });
  });
  const practice = await openOutputPractice(page);
  await voiceMode(practice);
  const recorder = practice.getByRole("region", {
    name: "自分の声を録音",
    exact: true,
  });
  const trackStates = () =>
    page.evaluate(() => {
      const control: unknown = Reflect.get(
        window,
        "__nativeLessonRecordingTest",
      );
      if (typeof control !== "object" || control === null)
        throw new Error("Native recording source missing");
      const read: unknown = Reflect.get(control, "trackStates");
      if (typeof read !== "function")
        throw new Error("Native recording track state missing");
      const states: unknown = Reflect.apply(read, control, []);
      if (
        !Array.isArray(states) ||
        states.some((state) => typeof state !== "string")
      )
        throw new Error("Invalid recording track states");
      return states;
    });
  try {
    expect(await trackStates()).toEqual([]);
    await recorder
      .getByRole("button", { name: "録音を始める", exact: true })
      .click();
    await expect(recorder.getByRole("status")).toContainText("録音中です");
    expect(await trackStates()).toEqual(["live"]);
    // Accumulate real samples across the recorder's 250 ms data timeslices.
    await page.waitForTimeout(700);
    await recorder
      .getByRole("button", { name: "録音を止める", exact: true })
      .click();
    await expect(recorder.getByRole("status")).toContainText("録音できました");
    expect(await trackStates()).toEqual(["ended"]);
    const audio = recorder.locator('audio[aria-label="自分の録音"]');
    await expect(audio).toHaveAttribute("src", /^blob:/);
    await expect
      .poll(() =>
        audio.evaluate((element) => {
          if (!(element instanceof HTMLAudioElement))
            throw new Error("Recording audio element missing");
          return element.readyState;
        }),
      )
      .toBeGreaterThanOrEqual(1);
    const playback = await audio.evaluate(async (element) => {
      if (!(element instanceof HTMLAudioElement))
        throw new Error("Recording audio element missing");
      element.muted = true;
      await element.play();
      return { paused: element.paused, error: element.error?.code ?? null };
    });
    expect(playback).toEqual({ paused: false, error: null });
    await recorder
      .getByRole("button", { name: "録音を削除", exact: true })
      .click();
    await expect(audio).toHaveCount(0);
    await expectProgressUntouched(page);
  } finally {
    await page.evaluate(async () => {
      const control: unknown = Reflect.get(
        window,
        "__nativeLessonRecordingTest",
      );
      if (typeof control !== "object" || control === null) return;
      const close: unknown = Reflect.get(control, "close");
      if (typeof close === "function") await Reflect.apply(close, control, []);
    });
  }
});

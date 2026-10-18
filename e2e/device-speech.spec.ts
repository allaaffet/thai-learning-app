import { expect, test, type Page } from "@playwright/test";
import { PROGRESS_STORAGE_KEY } from "../src/lib/progress";

// This stub verifies Web Speech controls, not Thai pronunciation or real audio quality.
async function installSpeechStub(
  page: Page,
  mode: "thai" | "no-thai" | "error" | "delayed" = "thai",
) {
  await page.addInitScript((speechMode) => {
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
      calls: [] as { text: string; lang: string }[],
      cancels: 0,
      ready: speechMode !== "delayed",
    };
    Object.defineProperty(window, "__speechTest", { value: state });
    class Synthesis extends EventTarget {
      pendingTimer: number | undefined;
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
        return speechMode === "no-thai" ? [japanese] : [japanese, thai];
      }
      speak(utterance: Utterance) {
        state.calls.push({ text: utterance.text, lang: utterance.lang });
        utterance.onstart?.();
        this.pendingTimer = window.setTimeout(
          () =>
            speechMode === "error"
              ? utterance.onerror?.()
              : utterance.onend?.(),
          60,
        );
      }
      cancel() {
        state.cancels++;
        window.clearTimeout(this.pendingTimer);
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
    if (speechMode === "delayed")
      window.setTimeout(() => {
        state.ready = true;
        synthesis.dispatchEvent(new Event("voiceschanged"));
      }, 800);
  }, mode);
}
async function speechState(page: Page) {
  return page.evaluate(() => {
    const state: unknown = Reflect.get(window, "__speechTest");
    if (typeof state !== "object" || state === null)
      throw new Error("Speech stub missing");
    return state as {
      calls: { text: string; lang: string }[];
      cancels: number;
    };
  });
}

test("タイ語合成音声を明示し、任意の聞き分けを解いても進捗やXPを変更しない", async ({
  page,
}) => {
  await installSpeechStub(page, "delayed");
  await page.goto("/pronunciation");
  const practice = page.getByRole("region", {
    name: "合成音声で、聞き分けを試す",
    exact: true,
  });
  await expect(practice).toContainText("端末の合成音声（未監修）");
  await expect(practice).toContainText("Thai test voice");
  expect((await speechState(page)).calls).toHaveLength(0);
  const check = practice.getByRole("button", {
    name: "聞き分けの答えを確認",
    exact: true,
  });
  await expect(check).toBeDisabled();
  const answers = ["กา", "หมา", "ป้า"];
  for (const [index, answer] of answers.entries()) {
    await expect(practice.getByRole("status")).toHaveCount(0);
    await practice.getByRole("radio", { name: answer, exact: true }).check();
    await expect(check).toBeDisabled();
    const play = practice.getByRole("button", {
      name: "問題の合成音声を再生",
      exact: true,
    });
    await play.click();
    await expect(check).toBeEnabled();
    expect((await speechState(page)).calls.at(-1)).toEqual({
      text: answer,
      lang: "th-TH",
    });
    await check.click();
    await expect(practice.getByRole("status")).toContainText("正解");
    for (const radio of await practice.getByRole("radio").all())
      await expect(radio).toBeDisabled();
    await practice
      .getByRole("button", {
        name: index === 2 ? "練習を終える" : "次の聞き分けへ",
        exact: true,
      })
      .click();
  }
  await expect(practice).toContainText("3問の練習、おつかれさまでした。");
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
  await practice
    .getByRole("button", { name: "もう一度聞く", exact: true })
    .click();
  await expect(check).toBeDisabled();
});

test("タイ語音声のない端末では他言語で代用せず、練習が利用できない理由を示す", async ({
  page,
}) => {
  await installSpeechStub(page, "no-thai");
  await page.goto("/pronunciation");
  const practice = page.getByRole("region", {
    name: "合成音声で、聞き分けを試す",
    exact: true,
  });
  await expect(practice.getByRole("status")).toContainText(
    "この端末ではタイ語の合成音声を利用できません",
  );
  await expect(practice.getByRole("radio")).toHaveCount(0);
  await expect(
    practice.getByRole("button", { name: "問題の合成音声を再生", exact: true }),
  ).toHaveCount(0);
  expect((await speechState(page)).calls).toHaveLength(0);
  await expect(
    page.locator(".pronunciation-tone-answer").first(),
  ).toContainText("中平調");
});

test("合成音声の再生エラーは完了と扱わず、答えの確認とXP加算を行わない", async ({
  page,
}) => {
  await installSpeechStub(page, "error");
  await page.goto("/pronunciation");
  const practice = page.getByRole("region", {
    name: "合成音声で、聞き分けを試す",
    exact: true,
  });
  await expect(practice).toContainText("Thai test voice");
  await practice.getByRole("radio", { name: "กา", exact: true }).check();
  await practice
    .getByRole("button", { name: "問題の合成音声を再生", exact: true })
    .click();
  await expect(practice.getByRole("status")).toContainText(
    "合成音声を再生できませんでした",
  );
  await expect(
    practice.getByRole("button", { name: "聞き分けの答えを確認", exact: true }),
  ).toBeDisabled();
  await expect(
    practice.getByRole("button", { name: "問題の合成音声を再生", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      PROGRESS_STORAGE_KEY,
    ),
  ).toBeNull();
});

import { expect, test, type Page } from "@playwright/test";
import { alphabetCharacters } from "../src/data/alphabet";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  isCharacterTrainingState,
} from "../src/lib/character-training-progress";
import { PROGRESS_STORAGE_KEY } from "../src/lib/progress";
import { REVIEW_STORAGE_KEY } from "../src/lib/review";

async function savedTraining(page: Page) {
  const value: unknown = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, CHARACTER_TRAINING_STORAGE_KEY);
  if (!isCharacterTrainingState(value))
    throw new Error("LAN接続で保存した文字練習の記録が不正です。");
  return value;
}

test("LANのHTTPでも設定を操作でき、ペアと8問の練習・再読込み保存が動く", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/character-practice", { waitUntil: "domcontentloaded" });

  // Do not simulate these properties: this must really run outside localhost/HTTPS.
  expect(
    await page.evaluate(() => ({
      secure: window.isSecureContext,
      randomUUID: typeof window.crypto.randomUUID,
    })),
  ).toEqual({ secure: false, randomUUID: "undefined" });
  await expect(
    page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("文字練習の設定を読み込んでいます…", { exact: true }),
  ).toHaveCount(0);
  const textMode = page.getByRole("radio", {
    name: "読み方から文字",
    exact: true,
  });
  await expect(textMode).toBeEnabled();
  await textMode.check();

  const before = await page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    [CHARACTER_TRAINING_STORAGE_KEY, PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY],
  );
  await page
    .getByRole("button", { name: "ペアさがしで遊ぶ", exact: true })
    .click();
  const pairs = page.getByRole("region", {
    name: "文字ペアさがし",
    exact: true,
  });
  await expect(pairs).toHaveAttribute("data-game-mode", "name-to-letter");
  const cue = pairs.locator("[data-cue-id]").first();
  const id = await cue.getAttribute("data-cue-id");
  const entry = alphabetCharacters.find((character) => character.id === id);
  if (!entry) throw new Error("ペアの教材文字を確認できません。");
  await expect(cue).toContainText(entry.ipa);
  await cue.click();
  await pairs
    .getByRole("button", { name: `${entry.thai} とつなぐ`, exact: true })
    .click();
  await expect(
    pairs.getByRole("progressbar", {
      name: "この周で見つけたペア",
      exact: true,
    }),
  ).toHaveJSProperty("value", 1);
  expect(
    await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      [
        CHARACTER_TRAINING_STORAGE_KEY,
        PROGRESS_STORAGE_KEY,
        REVIEW_STORAGE_KEY,
      ],
    ),
  ).toEqual(before);
  await pairs
    .getByRole("button", { name: "文字を選び直す", exact: true })
    .click();

  await page
    .getByRole("button", { name: "すぐに8問チャレンジ", exact: true })
    .click();
  const quiz = page.getByRole("region", {
    name: "文字チャレンジ",
    exact: true,
  });
  for (let index = 1; index <= 8; index += 1) {
    await expect(quiz).toHaveAttribute("data-question-index", String(index));
    await expect(quiz).toHaveAttribute("data-kind", "name-to-letter");
    const targetId = await quiz.getAttribute("data-character-id");
    const target = alphabetCharacters.find(
      (character) => character.id === targetId,
    );
    if (!target) throw new Error("クイズの教材文字を確認できません。");
    await expect(quiz).toContainText(target.ipa);
    await quiz
      .locator(`[data-option-id=${JSON.stringify(target.id)}]`)
      .locator("..")
      .click();
    await quiz.getByRole("button", { name: "答えを確認", exact: true }).click();
    await expect(quiz.locator('.ct-feedback[role="status"]')).toContainText(
      "そのとおり！",
    );
    await quiz
      .getByRole("button", {
        name: index === 8 ? "結果を見る" : "次の文字へ",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", {
      name: "8問の文字練習、おつかれさま。",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await savedTraining(page);
  expect(saved.sessionsCompleted).toBe(1);
  expect(saved.mode).toBe("name-to-letter");
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.correct,
      0,
    ),
  ).toBe(8);
  expect(
    Object.values(saved.records).reduce(
      (sum, record) => sum + record.incorrect,
      0,
    ),
  ).toBe(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(textMode).toBeChecked();
  await expect(
    page.getByRole("button", { name: "ペアさがしで遊ぶ", exact: true }),
  ).toBeEnabled();
  expect(await savedTraining(page)).toEqual(saved);
  expect(
    await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      [PROGRESS_STORAGE_KEY, REVIEW_STORAGE_KEY],
    ),
  ).toEqual(before.slice(1));
  expect(errors).toEqual([]);
});

test("開発リソースは現在のLAN Originを許可し、未知のOriginを拒否する", async ({
  request,
  baseURL,
}) => {
  if (!baseURL) throw new Error("LAN接続先がありません。");
  const resource = "/_next/static/chunks/webpack.js";
  const allowed = await request.get(resource, { headers: { Origin: baseURL } });
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()["content-type"]).toContain("javascript");

  const blocked = await request.get(resource, {
    headers: { Origin: "https://untrusted.example" },
  });
  expect(blocked.status()).toBe(403);
  expect(await blocked.text()).toBe("Unauthorized");
});

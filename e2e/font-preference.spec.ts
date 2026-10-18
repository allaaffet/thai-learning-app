import { expect, test, type Locator, type Page } from "@playwright/test";
import { characters, lessons } from "../src/data/curriculum";

const storageKey = "thai-learning.thai-font.v1";
const switchName = "ループなしのタイ語フォント";
const fontFamilies = {
  looped: "Noto Sans Thai Looped Variable",
  loopless: "Noto Sans Thai Variable",
} as const;

async function expectFont(element: Locator, family: string) {
  await expect
    .poll(() =>
      element.evaluate((node) =>
        window
          .getComputedStyle(node)
          .fontFamily.split(",")[0]
          .replace(/["']/g, "")
          .trim(),
      ),
    )
    .toBe(family);
}

async function expectSelection(
  page: Page,
  selection: keyof typeof fontFamilies,
) {
  await expect(page.getByRole("switch", { name: switchName })).toHaveAttribute(
    "aria-checked",
    String(selection === "loopless"),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-thai-font",
    selection,
  );
  await expectFont(page.locator("body"), fontFamilies[selection]);
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

function unicodeRangeIncludes(range: string, codePoint: number) {
  return range.split(",").some((segment) => {
    const [start, end = start] = segment.trim().replace(/^U\+/i, "").split("-");
    const minimum = parseInt(start.replace(/\?/g, "0"), 16);
    const maximum = parseInt(end.replace(/\?/g, "F"), 16);
    return codePoint >= minimum && codePoint <= maximum;
  });
}

test("標準フォントからキーボードで切り替え、標準にも戻せる", async ({
  page,
}) => {
  await page.goto("/");
  const fontSwitch = page.getByRole("switch", { name: switchName });
  await expectSelection(page, "looped");
  expect(await fontSwitch.evaluate((node) => node.tagName)).toBe("BUTTON");

  await fontSwitch.focus();
  await page.keyboard.press("Space");
  await expectSelection(page, "loopless");
  await expect(fontSwitch).toBeFocused();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBe("loopless");

  await page.keyboard.press("Enter");
  await expectSelection(page, "looped");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBe("looped");
  await page.reload();
  await expectSelection(page, "looped");
});

test("選んだフォントが画面移動・再読み込み後も文字と演習に反映される", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("switch", { name: switchName }).click();
  await expectSelection(page, "loopless");

  await page.getByRole("link", { name: /^(学習ロードマップ|学習)$/ }).click();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expectSelection(page, "loopless");
  await page.reload();
  await expectSelection(page, "loopless");

  await page.getByRole("link", { name: /^(タイ文字ノート|文字)$/ }).click();
  await expect(page).toHaveURL(/\/characters$/);
  await expectSelection(page, "loopless");
  const detailHeading = page.locator("#character-detail-heading");
  await expect(detailHeading).toHaveText(characters[0].name);
  await expectFont(detailHeading, fontFamilies.loopless);
  await expectFont(
    page.locator('#character-detail [lang="th"]').first(),
    fontFamilies.loopless,
  );

  await page.goto(`/lessons/${lessons[0].id}`);
  await expectSelection(page, "loopless");
  await expectFont(
    page.locator(".example-thai").first(),
    fontFamilies.loopless,
  );
  await expectFont(page.locator(".ipa").first(), fontFamilies.loopless);
  await page
    .getByRole("button", { name: "文字と音を確認する", exact: true })
    .click();
  await page.getByRole("button", { name: "練習に進む", exact: true }).click();
  const thaiOption = page.locator(".option-label.has-thai").first();
  await expect(thaiOption).toHaveText(lessons[0].exercises[0].options[0].label);
  await expectFont(thaiOption, fontFamilies.loopless);
  await page.getByRole("switch", { name: switchName }).click();
  await expectSelection(page, "looped");
  await expectFont(thaiOption, fontFamilies.looped);
  await expectNoHorizontalOverflow(page);
});

test("不正な保存値は標準フォントに戻し、次の選択を保存できる", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, '{"font":"unknown"}');
  }, storageKey);
  await page.goto("/");
  await expectSelection(page, "looped");
  await page.getByRole("switch", { name: switchName }).click();
  await expectSelection(page, "loopless");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
    .toBe("loopless");
});

for (const failRead of [false, true]) {
  test(`${failRead ? "保存領域へのアクセス" : "フォントの保存"}が拒否されても切り替えでき、保存できないことがわかる`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, failRead }) => {
        const originalGet = Storage.prototype.getItem;
        const originalSet = Storage.prototype.setItem;
        if (failRead) {
          Storage.prototype.getItem = function (requestedKey) {
            if (requestedKey === key)
              throw new DOMException("Storage unavailable", "SecurityError");
            return originalGet.call(this, requestedKey);
          };
        }
        Storage.prototype.setItem = function (requestedKey, value) {
          if (requestedKey === key)
            throw new DOMException("Storage unavailable", "QuotaExceededError");
          return originalSet.call(this, requestedKey, value);
        };
      },
      { key: storageKey, failRead },
    );
    await page.goto("/");
    await expectSelection(page, "looped");
    await page.getByRole("switch", { name: switchName }).click();
    await expectSelection(page, "loopless");
    const notice = page.getByRole("status").filter({ hasText: /フォント/ });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/保存/);
    await page.getByRole("switch", { name: switchName }).click();
    await expectSelection(page, "looped");
    await expect(notice).toBeVisible();
  });
}

test("両方のローカルフォントが結合文字を表示でき、狭い画面でも収まる", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/characters");

  for (const selection of ["looped", "loopless"] as const) {
    if (selection === "loopless")
      await page.getByRole("switch", { name: switchName }).click();
    await expectSelection(page, selection);
    const family = fontFamilies[selection];
    const sample = "กิ่ กี้ กุ่ กู้";
    const rendered = await page.evaluate(
      async ({ family, sample }) => {
        const faces = await document.fonts.load(`32px "${family}"`, sample);
        await document.fonts.ready;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        context.font = `32px "${family}"`;
        const metrics = context.measureText(sample);
        return {
          loaded: faces.map((face) => ({
            family: face.family.replace(/["']/g, ""),
            status: face.status,
            unicodeRange: face.unicodeRange,
          })),
          ready: document.fonts.check(`32px "${family}"`, sample),
          width: metrics.width,
          height:
            metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
        };
      },
      { family, sample },
    );
    expect(rendered.loaded.length).toBeGreaterThan(0);
    expect(rendered.ready).toBe(true);
    expect(rendered.width).toBeGreaterThan(0);
    expect(rendered.height).toBeGreaterThan(0);
    for (const face of rendered.loaded) {
      expect(face.family).toBe(family);
      expect(face.status).toBe("loaded");
      expect(unicodeRangeIncludes(face.unicodeRange, 0x0e01)).toBe(true);
      // Thai-only faces let Japanese and IPA keep their existing fallback glyphs.
      expect(unicodeRangeIncludes(face.unicodeRange, 0x3042)).toBe(false);
      expect(unicodeRangeIncludes(face.unicodeRange, 0x0061)).toBe(false);
    }
    await expectFont(page.locator("#character-detail-heading"), family);
    const typography = await page
      .locator("#character-detail-heading")
      .evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
          lineHeight: parseFloat(style.lineHeight),
          fontSize: parseFloat(style.fontSize),
        };
      });
    expect(typography.lineHeight).toBeGreaterThanOrEqual(
      typography.fontSize * 1.4,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`characters-${selection}.png`),
      fullPage: true,
    });
  }
});

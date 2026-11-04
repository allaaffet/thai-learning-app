import { describe, expect, it } from "vitest";
import {
  isRomanceExpression,
  romanceExpressionIds,
  romanceExpressions,
} from "@/lib/romance-expressions";

describe("恋愛の台本に登録した表情と画像", () => {
  it("既存4表情の画像URLを保持し、同じ表示窓へ2表情を追加する", () => {
    expect(romanceExpressions.neutral.src).toBe("/romance/cast.png");
    expect(romanceExpressions.happy.src).toBe("/romance/cast-happy.png");
    expect(romanceExpressions.thoughtful.src).toBe(
      "/romance/cast-thoughtful.png",
    );
    expect(romanceExpressions.concerned.src).toBe(
      "/romance/cast-concerned.png",
    );
    expect(romanceExpressions.romantic.label).toBe("見つめる表情");
    expect(romanceExpressions.blushing.label).toBe("照れた表情");
    expect(new Set(romanceExpressionIds).size).toBe(6);
    expect(
      new Set(Object.values(romanceExpressions).map((entry) => entry.src)).size,
    ).toBe(6);
    for (const expression of romanceExpressionIds) {
      expect(isRomanceExpression(expression)).toBe(true);
      expect(romanceExpressions[expression].src).toMatch(
        /^\/romance\/cast(?:-[a-z]+)?\.png$/u,
      );
    }
  });

  it.each([
    undefined,
    null,
    "",
    "angry",
    "toString",
    "__proto__",
    "ROMANTIC",
    0,
    {},
    ["happy"],
  ])("未登録値を表情として推測しない: %j", (value) => {
    expect(isRomanceExpression(value)).toBe(false);
  });
});

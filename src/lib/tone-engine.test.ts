import { describe, expect, it } from "vitest";
import { determineTone, isSyllableAnalysis } from "@/lib/tone-engine";
import type { ConsonantClass } from "@/lib/content-types";
import type { SyllableAnalysis, Tone, ToneMark } from "@/lib/tone-types";

const base: SyllableAnalysis = {
  consonantClass: "mid",
  vowelLength: "long",
  codaType: "none",
  toneMark: "none",
  onsetRule: "single",
};

/** 基本表から独立に書いた期待値。列は生音節 / 短母音の死音節 / 長母音の死音節。 */
const matrix: {
  consonantClass: ConsonantClass;
  toneMark: ToneMark;
  expected: [Tone | null, Tone | null, Tone | null];
}[] = [
  { consonantClass: "mid", toneMark: "none", expected: ["mid", "low", "low"] },
  {
    consonantClass: "mid",
    toneMark: "mai-ek",
    expected: ["low", "low", "low"],
  },
  {
    consonantClass: "mid",
    toneMark: "mai-tho",
    expected: ["falling", "falling", "falling"],
  },
  {
    consonantClass: "mid",
    toneMark: "mai-tri",
    expected: ["high", "high", "high"],
  },
  {
    consonantClass: "mid",
    toneMark: "mai-chattawa",
    expected: ["rising", null, null],
  },
  {
    consonantClass: "high",
    toneMark: "none",
    expected: ["rising", "low", "low"],
  },
  {
    consonantClass: "high",
    toneMark: "mai-ek",
    expected: ["low", "low", "low"],
  },
  {
    consonantClass: "high",
    toneMark: "mai-tho",
    expected: ["falling", "falling", "falling"],
  },
  { consonantClass: "high", toneMark: "mai-tri", expected: [null, null, null] },
  {
    consonantClass: "high",
    toneMark: "mai-chattawa",
    expected: [null, null, null],
  },
  {
    consonantClass: "low",
    toneMark: "none",
    expected: ["mid", "high", "falling"],
  },
  {
    consonantClass: "low",
    toneMark: "mai-ek",
    expected: ["falling", "falling", "falling"],
  },
  {
    consonantClass: "low",
    toneMark: "mai-tho",
    expected: ["high", "high", "high"],
  },
  { consonantClass: "low", toneMark: "mai-tri", expected: [null, null, null] },
  {
    consonantClass: "low",
    toneMark: "mai-chattawa",
    expected: [null, null, null],
  },
];

const cases = matrix.flatMap((row) => [
  {
    ...row,
    vowelLength: "short" as const,
    codaType: "sonorant" as const,
    type: "live",
    expectedTone: row.expected[0],
  },
  {
    ...row,
    vowelLength: "long" as const,
    codaType: "sonorant" as const,
    type: "live",
    expectedTone: row.expected[0],
  },
  {
    ...row,
    vowelLength: "long" as const,
    codaType: "none" as const,
    type: "live",
    expectedTone: row.expected[0],
  },
  {
    ...row,
    vowelLength: "short" as const,
    codaType: "none" as const,
    type: "dead",
    expectedTone: row.expected[1],
  },
  {
    ...row,
    vowelLength: "short" as const,
    codaType: "stop" as const,
    type: "dead",
    expectedTone: row.expected[1],
  },
  {
    ...row,
    vowelLength: "long" as const,
    codaType: "stop" as const,
    type: "dead",
    expectedTone: row.expected[2],
  },
]);

describe("determineTone: 基本声調表と生死音節の全組み合わせ", () => {
  it.each(cases)(
    "$consonantClass / $toneMark / $vowelLength / $codaType",
    ({
      consonantClass,
      toneMark,
      vowelLength,
      codaType,
      expectedTone,
      type,
    }) => {
      const result = determineTone({
        ...base,
        consonantClass,
        toneMark,
        vowelLength,
        codaType,
      });
      if (expectedTone === null) {
        expect(result.status).toBe("unknown");
        expect(result).not.toHaveProperty("tone");
      } else {
        expect(result).toMatchObject({
          status: "determined",
          tone: expectedTone,
          syllableType: type,
          effectiveClass: consonantClass,
          method: "rule",
        });
      }
      expect(result.steps.length).toBeGreaterThan(0);
    },
  );
});

describe("入力・対応範囲の検証", () => {
  it.each([
    undefined,
    null,
    false,
    0,
    "กา",
    [],
    {},
    { ...base, vowelLength: "unknown" },
    { ...base, codaType: "n" },
    { ...base, toneMark: "๊" },
    { ...base, onsetRule: "guess" },
    { ...base, consonantClass: "middle" },
    { ...base, exception: true },
  ])("分析済み音節以外は推測しない: %j", (value) => {
    expect(isSyllableAnalysis(value)).toBe(false);
    expect(determineTone(value)).toMatchObject({
      status: "unknown",
      steps: [],
    });
    expect(determineTone(value)).not.toHaveProperty("tone");
  });

  it("必要項目が1個でも欠ければ判定しない", () => {
    for (const key of Object.keys(base)) {
      const value = Object.fromEntries(
        Object.entries(base).filter(([entryKey]) => entryKey !== key),
      );
      expect(determineTone(value).status).toBe("unknown");
    }
  });

  it("継承したフィールドでスキーマ検証を通さない", () => {
    const value = Object.create(base);
    expect(determineTone(value).status).toBe("unknown");
  });

  it("判定は入力を変更せず、決定過程を日本語で返す", () => {
    const value = Object.freeze({
      ...base,
      consonantClass: "low",
      vowelLength: "short",
      codaType: "stop",
    });
    const result = determineTone(value);
    expect(result).toMatchObject({ status: "determined", tone: "high" });
    expect(result.steps.join(" ")).toContain("短母音なので高調");
    expect(value.codaType).toBe("stop");
  });
});

describe("先行子音・真の子音連続", () => {
  it("ห นำ は発音する低子音を高子音として扱い、過程を残す", () => {
    const result = determineTone({
      ...base,
      consonantClass: "low",
      onsetRule: "ho-nam",
    });
    expect(result).toMatchObject({
      status: "determined",
      tone: "rising",
      effectiveClass: "high",
    });
    expect(result.steps[0]).toContain("ห นำ");
  });
  it("ห นำ の死音節は低調になる", () => {
    expect(
      determineTone({
        ...base,
        consonantClass: "low",
        vowelLength: "short",
        codaType: "stop",
        onsetRule: "ho-nam",
      }),
    ).toMatchObject({
      status: "determined",
      tone: "low",
      syllableType: "dead",
    });
  });
  it("อ นำ は確認済み対象語の発音する低子音を中子音として扱う", () => {
    const result = determineTone({
      ...base,
      consonantClass: "low",
      onsetRule: "o-nam",
      toneMark: "mai-ek",
    });
    expect(result).toMatchObject({
      status: "determined",
      tone: "low",
      effectiveClass: "mid",
    });
    expect(result.steps[0]).toContain("อ นำ");
  });
  it.each(["mid", "high"])(
    "先行子音規則に不適切な発音側クラス %s は受け付けない",
    (consonantClass) => {
      for (const onsetRule of ["ho-nam", "o-nam"]) {
        expect(
          determineTone({ ...base, consonantClass, onsetRule }).status,
        ).toBe("unknown");
      }
    },
  );
  it("真の子音連続は、既に分析した先頭子音クラスを使用する", () => {
    const result = determineTone({
      ...base,
      consonantClass: "high",
      onsetRule: "true-cluster",
    });
    expect(result).toMatchObject({
      status: "determined",
      tone: "rising",
      effectiveClass: "high",
    });
    expect(result.steps[0]).toContain("先頭子音");
  });
  it("短母音・死音節にไม้ตรีが付く โต๊ะ 型を扱う", () => {
    expect(
      determineTone({ ...base, vowelLength: "short", toneMark: "mai-tri" }),
    ).toMatchObject({
      status: "determined",
      tone: "high",
      syllableType: "dead",
    });
  });
});

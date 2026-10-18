import { describe, expect, it } from "vitest";
import {
  analyzeEntry,
  lookupSyllable,
  syllableEntries,
  toneSources,
} from "@/data/syllables";
import type { SyllableEntry } from "@/lib/tone-types";

describe("個別登録した音節教材", () => {
  it("32語のID・綴りが重複せず、実際の参照資料と確認範囲を持つ", () => {
    expect(syllableEntries).toHaveLength(32);
    expect(new Set(syllableEntries.map((entry) => entry.id)).size).toBe(32);
    expect(new Set(syllableEntries.map((entry) => entry.thai)).size).toBe(32);
    for (const entry of syllableEntries) {
      expect(entry.ipa).toMatch(/^\/.+\/$/);
      expect(entry.meaning.length).toBeGreaterThan(0);
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      expect(
        entry.sourceIds.every((id) =>
          toneSources.some((source) => source.id === id),
        ),
      ).toBe(true);
      // 基本規則の照合を、各語のIPA・意味・先行子音の監修完了と混同しない。
      expect(entry.verification).toBe("unreviewed");
      expect(entry.dictionaryOverride).toBeUndefined();
    }
    expect(
      toneSources.find((source) => source.id === "thai-tone-rules-phase3"),
    ).toMatchObject({ access: "accessible" });
    expect(
      syllableEntries.filter((entry) =>
        entry.sourceIds.includes("wiktionary-ipa-phase3"),
      ),
    ).toHaveLength(30);
    expect(
      syllableEntries
        .filter((entry) => !entry.sourceIds.includes("wiktionary-ipa-phase3"))
        .map((entry) => entry.thai),
    ).toEqual(["จ๊ะ", "จ๋า"]);
    expect(
      toneSources.find((source) => source.id === "wiktionary-ipa-phase3")
        ?.scope,
    ).toContain("CC BY-SA 3.0");
    expect(
      toneSources.find(
        (source) => source.id === "thai-language-tone-rules-blocked-phase3",
      ),
    ).toMatchObject({ access: "blocked" });
  });

  it.each(syllableEntries)(
    "$thai の指定済み音節分析と登録声調が一致する",
    (entry) => {
      expect(analyzeEntry(entry)).toMatchObject({
        status: "determined",
        tone: entry.expectedTone,
        method: "rule",
      });
      expect(lookupSyllable(entry.thai)).toBe(entry);
    },
  );

  it("5声調、3クラス、生音節・死音節、全声調記号、先行子音・子音連続の実例を持つ", () => {
    expect(
      new Set(syllableEntries.map((entry) => entry.expectedTone)).size,
    ).toBe(5);
    expect(
      new Set(syllableEntries.map((entry) => entry.analysis?.consonantClass))
        .size,
    ).toBe(3);
    expect(
      new Set(syllableEntries.map((entry) => entry.analysis?.toneMark)).size,
    ).toBe(5);
    expect(
      new Set(syllableEntries.map((entry) => entry.analysis?.onsetRule)),
    ).toEqual(new Set(["single", "ho-nam", "o-nam", "true-cluster"]));
    expect(
      new Set(
        syllableEntries.map((entry) => {
          const result = analyzeEntry(entry);
          return result.status === "determined"
            ? result.syllableType
            : "unknown";
        }),
      ),
    ).toEqual(new Set(["live", "dead"]));
  });

  it("前後の空白だけを除去し、似た綴り・未登録語・複数音節を推測しない", () => {
    expect(lookupSyllable("  ข้าว\n")?.id).toBe("khao-rice");
    expect(lookupSyllable("ก้ๅ")).toBeUndefined();
    expect(lookupSyllable("กๅ")).toBeUndefined();
    expect(lookupSyllable("กา ขา")).toBeUndefined();
    expect(lookupSyllable("ภาษาไทย")).toBeUndefined();
    expect(lookupSyllable("")).toBeUndefined();
  });

  it("母音字に含まれる /j/ も末音として扱う", () => {
    const entry = lookupSyllable("ใหญ่");
    expect(entry?.coda).toBe("");
    expect(entry?.analysis?.codaType).toBe("sonorant");
    expect(entry && analyzeEntry(entry)).toMatchObject({
      status: "determined",
      syllableType: "live",
      tone: "low",
    });
  });

  it("音節分析がない語や教材の不整合から正解を生成しない", () => {
    const first = syllableEntries[0];
    expect(analyzeEntry({ ...first, analysis: undefined }).status).toBe(
      "unknown",
    );
    const conflicting = analyzeEntry({ ...first, expectedTone: "high" });
    expect(conflicting.status).toBe("unknown");
    expect(conflicting.steps).toEqual([]);
    expect(conflicting).not.toHaveProperty("tone");
  });
});

describe("辞書補完の境界", () => {
  // 辞書補完経路だけを検証する合成fixture。実在語の確認済みデータではない。
  const dictionaryFixture: SyllableEntry = {
    ...syllableEntries[0],
    id: "test-only-lexical-override",
    expectedTone: "falling",
    sourceIds: ["test-dictionary-reference"],
    verification: "source-checked",
    dictionaryOverride: {
      tone: "falling",
      reason: "テスト用の例外指定。",
      sourceIds: ["test-dictionary-reference"],
    },
  };

  it("出典・照合状態・理由が揃う辞書指定は規則と区別して返す", () => {
    const result = analyzeEntry(dictionaryFixture);
    expect(result).toMatchObject({
      status: "determined",
      tone: "falling",
      method: "dictionary",
      effectiveClass: "mid",
      syllableType: "live",
    });
    expect(result.steps.join(" ")).toContain("辞書情報");
  });

  it.each([
    { ...dictionaryFixture, verification: "unreviewed" as const },
    { ...dictionaryFixture, expectedTone: "high" as const },
    {
      ...dictionaryFixture,
      dictionaryOverride: {
        tone: "falling" as const,
        reason: "",
        sourceIds: ["test-dictionary-reference"],
      },
    },
    {
      ...dictionaryFixture,
      dictionaryOverride: {
        tone: "falling" as const,
        reason: "例外",
        sourceIds: [],
      },
    },
    {
      ...dictionaryFixture,
      dictionaryOverride: {
        tone: "falling" as const,
        reason: "例外",
        sourceIds: ["missing-source"],
      },
    },
  ])("未確認・欠落・不整合の例外から声調を返さない", (entry) => {
    const result = analyzeEntry(entry);
    expect(result.status).toBe("unknown");
    expect(result.steps).toEqual([]);
    expect(result).not.toHaveProperty("tone");
  });

  it("基本判定の対応範囲外でも、分析と辞書根拠があるときだけ補完できる", () => {
    const entry: SyllableEntry = {
      ...dictionaryFixture,
      expectedTone: "high",
      analysis: {
        consonantClass: "mid",
        codaType: "stop",
        vowelLength: "short",
        toneMark: "mai-chattawa",
        onsetRule: "single",
      },
      dictionaryOverride: {
        tone: "high",
        reason: "テスト用の辞書補完。",
        sourceIds: ["test-dictionary-reference"],
      },
    };
    expect(analyzeEntry(entry)).toMatchObject({
      status: "determined",
      tone: "high",
      syllableType: "dead",
      method: "dictionary",
    });
    expect(
      analyzeEntry({ ...entry, dictionaryOverride: undefined }).status,
    ).toBe("unknown");
  });
});

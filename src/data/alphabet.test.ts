import { describe, expect, it } from "vitest";
import { alphabetCharacters, alphabetSources, vowelPatterns } from "./alphabet";

describe("44子音の教材の整合性", () => {
  it("母音字・省略記号を除いた44字をUnicode字順で一度ずつ収録する", () => {
    const expected = Array.from({ length: 0x0e2e - 0x0e01 + 1 }, (_, i) =>
      String.fromCodePoint(0x0e01 + i),
    ).filter((letter) => !["ฤ", "ฦ"].includes(letter));
    expect(alphabetCharacters.map((character) => character.thai)).toEqual(
      expected,
    );
    expect(alphabetCharacters).toHaveLength(44);
    expect(
      new Set(alphabetCharacters.map((character) => character.id)).size,
    ).toBe(44);
  });

  it("中9・高11・低24の分類を保持する", () => {
    const byClass = (group: string) =>
      alphabetCharacters
        .filter((character) => character.consonantClass === group)
        .map((character) => character.thai)
        .join("");
    expect(byClass("mid")).toBe("กจฎฏดตบปอ");
    expect(byClass("high")).toBe("ขฃฉฐถผฝศษสห");
    expect(byClass("low")).toBe(
      "คฅฆงชซฌญฑฒณทธนพฟภมยรลวฬฮ",
    );
    expect(
      alphabetCharacters.filter((c) => c.consonantClass === "low"),
    ).toHaveLength(24);
  });

  it("Phase 1の文字IDと発音例を変更しない", () => {
    const original = [
      ["ko-kai", "ก", "กา", "/kaː˧/"],
      ["kho-khai", "ข", "ขา", "/kʰaː˩˩˦/"],
      ["kho-khwai", "ค", "คา", "/kʰaː˧/"],
      ["ngo-ngu", "ง", "งา", "/ŋaː˧/"],
      ["cho-chan", "จ", "จาน", "/tɕaːn˧/"],
      ["do-dek", "ด", "ดี", "/diː˧/"],
      ["to-tao", "ต", "ตา", "/taː˧/"],
      ["no-nu", "น", "นา", "/naː˧/"],
      ["mo-ma", "ม", "มา", "/maː˧/"],
      ["ro-ruea", "ร", "รา", "/raː˧/"],
    ];
    for (const [id, thai, example, ipa] of original) {
      expect(
        alphabetCharacters.find((character) => character.id === id),
      ).toMatchObject({
        thai,
        example: { thai: example, ipa },
      });
    }
  });

  it("廃用字の実例を現代の綴りと区別し、ฑの複数の音を明示する", () => {
    const obsolete = alphabetCharacters.filter(
      (character) => character.usage === "obsolete",
    );
    expect(obsolete.map((character) => character.thai)).toEqual(["ฃ", "ฅ"]);
    expect(obsolete.map((character) => character.example.thai)).toEqual([
      "ขวด",
      "คน",
    ]);
    for (const character of obsolete) {
      expect(character.note).toContain("廃用字");
      expect(character.example.note).toContain("現代");
      expect(character.finalIpa).toBeUndefined();
    }
    expect(
      alphabetCharacters.find((character) => character.thai === "ฑ"),
    ).toMatchObject({
      initialIpa: "/tʰ/",
      alternateInitialIpa: ["/d/"],
    });
  });

  it.each(alphabetCharacters)(
    "$thai に利用状況・用例・出典と監修状態がある",
    (character) => {
      expect(character.group).toBe("consonant");
      expect(character.name.startsWith(`${character.thai} `)).toBe(true);
      expect(character.unicodeName).toMatch(/^THAI CHARACTER [A-Z ]+$/);
      expect(character.ipa).toMatch(/^\/.+ɔː[˩˦˧]+\/$/u);
      expect(character.initialIpa).toMatch(/^\/.+\/$/u);
      expect(character.example.ipa).toMatch(/^\/.+\/$/u);
      expect(character.example.meaning.length).toBeGreaterThan(0);
      if (character.usage === "common") {
        expect(character.example.thai).toContain(character.thai);
      }
      expect(character.introducedInLessonIds.length).toBeGreaterThan(0);
      expect(new Set(character.introducedInLessonIds).size).toBe(
        character.introducedInLessonIds.length,
      );
      expect(character.verification).toBe("unreviewed");
      expect(character.sourceIds.length).toBeGreaterThan(0);
      for (const id of character.sourceIds) {
        expect(alphabetSources.find((source) => source.id === id)?.access).toBe(
          "accessible",
        );
      }
    },
  );
});

describe("母音パターンの教材の整合性", () => {
  it("基本9組・二重母音3組の対と8つの特殊・変化形を区別する", () => {
    expect(
      vowelPatterns.filter((vowel) => vowel.length === "short"),
    ).toHaveLength(12);
    expect(
      vowelPatterns.filter((vowel) => vowel.length === "long"),
    ).toHaveLength(12);
    expect(
      vowelPatterns.filter((vowel) => vowel.length === "special"),
    ).toHaveLength(8);
    expect(new Set(vowelPatterns.map((vowel) => vowel.id)).size).toBe(
      vowelPatterns.length,
    );
    expect(new Set(vowelPatterns.map((vowel) => vowel.pattern)).size).toBe(
      vowelPatterns.length,
    );
    for (const vowel of vowelPatterns.filter((entry) => entry.pairId)) {
      const pair = vowelPatterns.find((entry) => entry.id === vowel.pairId);
      expect(pair, `存在しない母音ペア: ${vowel.id}`).toBeDefined();
      expect(pair?.pairId).toBe(vowel.id);
      expect(new Set([pair?.length, vowel.length])).toEqual(
        new Set(["short", "long"]),
      );
    }
  });

  it("母音形のIPAと、声調・末子音を持つ用例のIPAを区別する", () => {
    expect(vowelPatterns.find((vowel) => vowel.id === "a-short")).toMatchObject(
      {
        ipa: "/a/",
        example: { thai: "กะ", ipa: "/kaʔ˨˩/" },
      },
    );
    expect(vowelPatterns.find((vowel) => vowel.id === "o-short")).toMatchObject(
      {
        pattern: "โ-ะ",
        example: { thai: "โต๊ะ", ipa: "/toʔ˦˥/" },
      },
    );
    expect(
      vowelPatterns.find((vowel) => vowel.id === "oe-closed"),
    ).toMatchObject({
      ipa: "/ɤː/",
      example: { thai: "เดิน", ipa: "/dɤːn˧/" },
    });
    const comparison = vowelPatterns.find((vowel) => vowel.id === "uea-short");
    expect(comparison?.example.meaning).toContain("比較用音節");
    expect(comparison?.example.note).toContain("一般的な日常語");
  });

  it("母音と声調の結合記号のコードポイント順を維持する", () => {
    const desk = vowelPatterns.find((vowel) => vowel.id === "o-short")!.example
      .thai;
    expect([...desk].map((letter) => letter.codePointAt(0))).toEqual([
      0x0e42, 0x0e15, 0x0e4a, 0x0e30,
    ]);
    const shortCompound = vowelPatterns.find(
      (vowel) => vowel.id === "ia-short",
    )!.example.thai;
    expect([...shortCompound].map((letter) => letter.codePointAt(0))).toEqual([
      0x0e40, 0x0e1b, 0x0e35, 0x0e4a, 0x0e22, 0x0e30,
    ]);
  });

  it.each(vowelPatterns)(
    "$id に配置・用例・注意点と確認状況がある",
    (vowel) => {
      expect(vowel.pattern).toContain("-");
      expect(vowel.ipa).toMatch(/^\/.+\/$/u);
      expect(vowel.ipa).not.toMatch(/[˥˦˧˨˩]/u);
      expect(vowel.example.ipa).toMatch(/[˥˦˧˨˩]/u);
      expect(vowel.example.thai).not.toContain("-");
      expect(vowel.example.thai).not.toContain("◌");
      expect(vowel.example.meaning.length).toBeGreaterThan(0);
      expect(vowel.note.length).toBeGreaterThan(15);
      expect(vowel.verification).toBe("unreviewed");
      expect(vowel.sourceIds.length).toBeGreaterThan(0);
      for (const id of vowel.sourceIds) {
        expect(alphabetSources.find((source) => source.id === id)?.access).toBe(
          "accessible",
        );
      }
    },
  );
});

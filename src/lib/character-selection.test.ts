import { describe, expect, it } from "vitest";
import { alphabetCharacters } from "@/data/alphabet";
import {
  CHARACTER_TRAINING_PRESETS,
  DEFAULT_CHARACTER_SELECTION,
} from "@/data/character-training";
import {
  suggestCharacterSelection,
  type CharacterSelectionOptions,
  type CharacterSelectionScope,
} from "@/lib/character-selection";
import type { CharacterTrainingRecord } from "@/lib/character-training-progress";

const common = alphabetCharacters.filter((entry) => entry.usage === "common");
const commonIds = common.map((entry) => entry.id);
const byId = new Map(alphabetCharacters.map((entry) => [entry.id, entry]));
const glyphsFor = (ids: readonly string[]) =>
  ids.map((id) => byId.get(id)?.thai);
const combination = (ids: readonly string[]) => [...ids].sort().join(",");

function record(lastCorrect: boolean): CharacterTrainingRecord {
  return {
    correct: lastCorrect ? 1 : 0,
    incorrect: lastCorrect ? 0 : 1,
    lastCorrect,
    lastPracticedAt: "2026-10-26T10:00:00.000Z",
  };
}

function options(
  change: Partial<CharacterSelectionOptions> = {},
): CharacterSelectionOptions {
  return { scope: "common", count: 4, seed: 42, records: {}, ...change };
}

describe("文字セットの追加", () => {
  it("既存5セットと初期の4字を変更しない", () => {
    expect(glyphsFor(DEFAULT_CHARACTER_SELECTION)).toEqual([
      "ก",
      "ม",
      "น",
      "ง",
    ]);
    expect(
      CHARACTER_TRAINING_PRESETS.slice(0, 5).map((preset) => ({
        id: preset.id,
        title: preset.title,
        glyphs: glyphsFor(preset.characterIds),
      })),
    ).toEqual([
      {
        id: "first-four",
        title: "はじめの4文字",
        glyphs: ["ก", "ม", "น", "ง"],
      },
      {
        id: "basic-eight",
        title: "基本の8文字",
        glyphs: ["ก", "ม", "น", "ง", "จ", "ด", "ต", "บ"],
      },
      { id: "shape-a", title: "見比べセット A", glyphs: ["ก", "ถ", "ภ"] },
      { id: "shape-b", title: "見比べセット B", glyphs: ["ข", "ช", "ซ"] },
      { id: "shape-c", title: "見比べセット C", glyphs: ["บ", "ป", "ผ", "ฝ"] },
    ]);
  });

  it("19組は2〜8字・実在するID・集合として重複なしで、現用42字を網羅する", () => {
    expect(CHARACTER_TRAINING_PRESETS).toHaveLength(19);
    const ids = new Set<string>();
    const combinations = new Set<string>();
    const covered = new Set<string>();
    for (const preset of CHARACTER_TRAINING_PRESETS) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.characterIds.length).toBeGreaterThanOrEqual(2);
      expect(preset.characterIds.length).toBeLessThanOrEqual(8);
      expect(new Set(preset.characterIds).size).toBe(
        preset.characterIds.length,
      );
      const key = combination(preset.characterIds);
      expect(combinations.has(key)).toBe(false);
      combinations.add(key);
      for (const id of preset.characterIds) {
        expect(byId.has(id)).toBe(true);
        if (byId.get(id)?.usage === "common") covered.add(id);
        else expect(preset.id).toBe("obsolete-letters");
      }
    }
    expect(covered).toEqual(new Set(commonIds));
    const obsolete = CHARACTER_TRAINING_PRESETS.find(
      (preset) => preset.id === "obsolete-letters",
    );
    expect(obsolete?.title).toBe("廃用字も確認");
    expect(obsolete?.description).toContain("現在通常使わない");
    expect(glyphsFor(obsolete?.characterIds ?? [])).toEqual(["ฃ", "ฅ"]);
  });

  it("クラス・同じ基本初頭音のセットは既存メタデータに一致する", () => {
    for (const [prefix, value] of [
      ["mid-", "mid"],
      ["high-", "high"],
      ["low-", "low"],
    ]) {
      for (const preset of CHARACTER_TRAINING_PRESETS.filter((item) =>
        item.id.startsWith(prefix),
      ))
        expect(
          preset.characterIds.map((id) => byId.get(id)?.consonantClass),
        ).toEqual(preset.characterIds.map(() => value));
    }
    for (const [id, ipa] of [
      ["sound-kh", "/kʰ/"],
      ["sound-s", "/s/"],
      ["sound-ph", "/pʰ/"],
    ]) {
      const preset = CHARACTER_TRAINING_PRESETS.find((item) => item.id === id);
      expect(preset).toBeDefined();
      for (const characterId of preset?.characterIds ?? [])
        expect(byId.get(characterId)?.initialIpa).toBe(ipa);
    }
  });
});

describe("おまかせ文字の組合せ", () => {
  it.each([4, 8] as const)(
    "%i字をseedで再現し、42字を広く選び、廃用字は混ぜない",
    (count) => {
      const combinations = new Set<string>();
      const covered = new Set<string>();
      for (let seed = 0; seed < 128; seed += 1) {
        const input = options({ count, seed });
        const first = suggestCharacterSelection(input);
        expect(suggestCharacterSelection(input)).toEqual(first);
        expect(first.selectedIds).toHaveLength(count);
        expect(new Set(first.selectedIds).size).toBe(count);
        expect(first.reason).toContain(`${count}字`);
        for (const id of first.selectedIds) {
          expect(byId.get(id)?.usage).toBe("common");
          covered.add(id);
        }
        combinations.add(combination(first.selectedIds));
      }
      expect(covered).toEqual(new Set(commonIds));
      expect(combinations.size).toBeGreaterThan(100);
    },
  );

  it.each(["common", "unpracticed", "weak"] as const)(
    "%s は順序だけでなく、前回の文字の組合せも変える",
    (scope) => {
      const records = Object.fromEntries(
        commonIds.map((id) => [id, record(false)]),
      );
      let previousIds = suggestCharacterSelection(
        options({ scope, records }),
      ).selectedIds;
      for (let index = 0; index < 30; index += 1) {
        const next = suggestCharacterSelection(
          options({ scope, records, previousIds }),
        );
        expect(combination(next.selectedIds)).not.toBe(
          combination(previousIds),
        );
        previousIds = next.selectedIds;
      }
    },
  );

  it("未練習を優先し、8問の記録がある文字は補完としてだけ選ぶ", () => {
    const newIds = commonIds.slice(0, 3);
    const records = Object.fromEntries(
      commonIds
        .filter((id) => !newIds.includes(id))
        .map((id) => [id, record(true)]),
    );
    const result = suggestCharacterSelection(
      options({ scope: "unpracticed", records }),
    );
    for (const id of newIds) expect(result.selectedIds).toContain(id);
    expect(result.reason).toBe(
      "未練習の3字と、ほかの現用字1字を組み合わせました。",
    );
  });

  it("未練習が4字だけのときも1字を入れ替え、実際の内訳を伝える", () => {
    const previousIds = commonIds.slice(0, 4);
    const records = Object.fromEntries(
      commonIds
        .filter((id) => !previousIds.includes(id))
        .map((id) => [id, record(true)]),
    );
    const result = suggestCharacterSelection(
      options({ scope: "unpracticed", records, previousIds }),
    );
    expect(
      result.selectedIds.filter((id) => previousIds.includes(id)),
    ).toHaveLength(3);
    expect(result.reason).toBe(
      "未練習の3字と、ほかの現用字1字を組み合わせました。",
    );
  });

  it("直近の誤答を優先し、以前の誤答や未練習を苦手と決め付けない", () => {
    const weakIds = commonIds.slice(0, 2);
    const recoveredId = commonIds[2];
    const records = {
      [weakIds[0]]: record(false),
      [weakIds[1]]: record(false),
      [recoveredId]: { ...record(true), incorrect: 15 },
    };
    const result = suggestCharacterSelection(
      options({ scope: "weak", records }),
    );
    for (const id of weakIds) expect(result.selectedIds).toContain(id);
    expect(result.reason).toBe(
      "直近にまちがえた2字と、見比べる現用字2字を選びました。",
    );
  });

  it("直近の誤答がちょうどN字でも、前回と重複させず補完を正しく知らせる", () => {
    for (const count of [4, 8] as const) {
      const previousIds = commonIds.slice(0, count);
      const records = Object.fromEntries(
        previousIds.map((id) => [id, record(false)]),
      );
      const result = suggestCharacterSelection(
        options({ scope: "weak", count, records, previousIds }),
      );
      expect(
        result.selectedIds.filter((id) => previousIds.includes(id)),
      ).toHaveLength(count - 1);
      expect(result.reason).toBe(
        `直近にまちがえた${count - 1}字と、見比べる現用字1字を選びました。`,
      );
    }
  });

  it("優先対象がない場合も必要な字数を補い、理由を偽らない", () => {
    const records = Object.fromEntries(
      commonIds.map((id) => [id, record(true)]),
    );
    const unpracticed = suggestCharacterSelection(
      options({ scope: "unpracticed", records }),
    );
    expect(unpracticed.selectedIds).toHaveLength(4);
    expect(unpracticed.reason).toBe(
      "全42字に8問の記録があるため、現用字4字を選びました。",
    );
    const weak = suggestCharacterSelection(options({ scope: "weak", records }));
    expect(weak.selectedIds).toHaveLength(4);
    expect(weak.reason).toBe(
      "直近にまちがえた現用字の記録がないため、4字を選びました。",
    );
  });

  it("廃用字の誤答記録は自動選択の候補へ入れず、現用字の苦手数に数えない", () => {
    const records = Object.fromEntries(
      alphabetCharacters
        .filter((entry) => entry.usage === "obsolete")
        .map((entry) => [entry.id, record(false)]),
    );
    const result = suggestCharacterSelection(
      options({ scope: "weak", records }),
    );
    expect(
      result.selectedIds.every((id) => byId.get(id)?.usage === "common"),
    ).toBe(true);
    expect(result.reason).toContain("直近にまちがえた現用字の記録がない");
  });

  it("入力の記録・前回の選択・教材を変更せず、空の選択からも提案できる", () => {
    const records = Object.freeze({
      [commonIds[0]]: Object.freeze(record(false)),
    });
    const previousIds = Object.freeze([...commonIds.slice(0, 4)]);
    const before = JSON.stringify({
      records,
      previousIds,
      alphabetCharacters,
      CHARACTER_TRAINING_PRESETS,
    });
    for (const scope of ["common", "unpracticed", "weak"] as const)
      suggestCharacterSelection(options({ scope, records, previousIds }));
    expect(
      JSON.stringify({
        records,
        previousIds,
        alphabetCharacters,
        CHARACTER_TRAINING_PRESETS,
      }),
    ).toBe(before);
    expect(
      suggestCharacterSelection(options({ previousIds: [] })).selectedIds,
    ).toHaveLength(4);
    expect(
      suggestCharacterSelection(options({ previousIds: commonIds.slice(0, 1) }))
        .selectedIds,
    ).toHaveLength(4);
  });

  it("seedの両端を許可し、未知形式・非整数・範囲外の数値・前回IDを拒否する", () => {
    expect(
      suggestCharacterSelection(options({ seed: 0 })).selectedIds,
    ).toHaveLength(4);
    expect(
      suggestCharacterSelection(options({ seed: 0xffffffff })).selectedIds,
    ).toHaveLength(4);
    for (const seed of [-1, 0x100000000, 0.5, NaN, Infinity])
      expect(() => suggestCharacterSelection(options({ seed }))).toThrow();
    for (const count of [0, 2, 6, 9])
      expect(() =>
        suggestCharacterSelection(options({ count: count as 4 })),
      ).toThrow();
    expect(() =>
      suggestCharacterSelection(
        options({ scope: "unknown" as CharacterSelectionScope }),
      ),
    ).toThrow();
    for (const previousIds of [
      ["missing"],
      ["__proto__"],
      [commonIds[0], commonIds[0]],
      commonIds.slice(0, 9),
    ])
      expect(() =>
        suggestCharacterSelection(options({ previousIds })),
      ).toThrow();
  });

  it("参照する記録の無効なカウント・直近の判定・未知IDを信用しない", () => {
    for (const bad of [
      { ...record(true), correct: NaN },
      { ...record(true), incorrect: -1 },
      { ...record(true), correct: 0.5 },
      { ...record(true), correct: Number.MAX_SAFE_INTEGER + 1 },
      { ...record(true), lastCorrect: "false" },
      null,
    ]) {
      const records = { [commonIds[0]]: bad } as unknown as Record<
        string,
        CharacterTrainingRecord
      >;
      expect(() => suggestCharacterSelection(options({ records }))).toThrow();
    }
    expect(() =>
      suggestCharacterSelection(
        options({ records: { missing: record(false) } }),
      ),
    ).toThrow();
    for (const records of [null, [], "saved"])
      expect(() =>
        suggestCharacterSelection(
          options({
            records: records as unknown as Record<
              string,
              CharacterTrainingRecord
            >,
          }),
        ),
      ).toThrow();
  });
});

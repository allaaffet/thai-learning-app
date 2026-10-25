import { describe, expect, it } from "vitest";
import { alphabetCharacters } from "@/data/alphabet";
import {
  DEFAULT_CHARACTER_SELECTION,
  getCharacterTrainingReading,
} from "@/data/character-training";
import {
  createCharacterPairGame,
  gradeCharacterPair,
  type PairLap,
  type PairMode,
} from "@/lib/character-pairs";
import { isThaiSpeechText } from "@/lib/device-speech";

const defaultInput = {
  selectedIds: DEFAULT_CHARACTER_SELECTION,
  mode: "name-to-letter" as const,
  seed: 42,
};

describe("ペア練習の盤面", () => {
  it("同じseedで再現でき、2周目は名前も字形も並びを変える", () => {
    const first = createCharacterPairGame(defaultInput);
    expect(first).toEqual(createCharacterPairGame(defaultInput));
    expect(first.id).toBe("pairs-42");
    expect(first.laps.map((lap) => lap.id)).toEqual([
      "pairs-42:lap1",
      "pairs-42:lap2",
    ]);
    expect(first.laps.map((lap) => lap.number)).toEqual([1, 2]);
    expect(first.laps[1].cueIds).not.toEqual(first.laps[0].cueIds);
    expect(first.laps[1].letterIds).not.toEqual(first.laps[0].letterIds);
    expect(
      createCharacterPairGame({ ...defaultInput, seed: 43 }).laps,
    ).not.toEqual(first.laps);
    expect(
      createCharacterPairGame({ ...defaultInput, gameId: "custom-game" })
        .laps[0].id,
    ).toBe("custom-game:lap1");
  });

  it("全44文字を含む2〜8文字の選択で、全ての名前と字形が各周に一つずつある", () => {
    const sourceSnapshot = JSON.stringify(alphabetCharacters);
    for (let offset = 0; offset < 44; offset += 1) {
      for (let size = 2; size <= 8; size += 1) {
        const selectedIds = Array.from(
          { length: size },
          (_, index) => alphabetCharacters[(offset + index) % 44].id,
        );
        for (const mode of ["audio-to-letter", "name-to-letter"] as const) {
          const game = createCharacterPairGame({
            selectedIds,
            mode,
            seed: offset,
          });
          expect(game.mode).toBe(mode);
          expect(game.selectedIds).toEqual(selectedIds);
          for (const lap of game.laps) {
            expect([...lap.cueIds].sort()).toEqual([...selectedIds].sort());
            expect([...lap.letterIds].sort()).toEqual([...selectedIds].sort());
            expect(new Set(lap.cueIds).size).toBe(size);
            expect(new Set(lap.letterIds).size).toBe(size);
          }
          expect(game.laps[1].cueIds).not.toEqual(game.laps[0].cueIds);
          expect(game.laps[1].letterIds).not.toEqual(game.laps[0].letterIds);
        }
      }
    }
    expect(JSON.stringify(alphabetCharacters)).toBe(sourceSnapshot);
  });

  it("音声も読み方も既存の完全な字母名の識別情報を使い、同じIPAの文字も区別する", () => {
    const selectedIds = ["kho-khwai", "kho-rakhang"];
    const characters = selectedIds.map(
      (id) => alphabetCharacters.find((entry) => entry.id === id)!,
    );
    expect(characters[0].ipa).toBe(characters[1].ipa);
    expect(new Set(characters.map((entry) => entry.name)).size).toBe(2);
    expect(
      new Set(
        characters.map(
          (entry) => getCharacterTrainingReading(entry).romanizedName,
        ),
      ).size,
    ).toBe(2);
    for (const character of alphabetCharacters) {
      expect(isThaiSpeechText(character.name)).toBe(true);
      expect(getCharacterTrainingReading(character).ipa).toBe(character.ipa);
      expect(character.verification).toBe("unreviewed");
    }
    for (const mode of ["audio-to-letter", "name-to-letter"] as const) {
      const game = createCharacterPairGame({ selectedIds, mode, seed: 0 });
      for (const lap of game.laps) {
        for (const id of selectedIds)
          expect(gradeCharacterPair(lap, id, id, []).correct).toBe(true);
      }
    }
  });

  it("2文字でも必ず2周目を再配置し、0と最大seedも受け付ける", () => {
    for (const seed of [0, 1, 2, 3, 42, 0xffffffff]) {
      const game = createCharacterPairGame({
        ...defaultInput,
        selectedIds: ["ko-kai", "mo-ma"],
        seed,
      });
      expect(game.laps[1].cueIds).toEqual([...game.laps[0].cueIds].reverse());
      expect(game.laps[1].letterIds).toEqual(
        [...game.laps[0].letterIds].reverse(),
      );
    }
  });

  it("入力や教材のUnicodeを変更せず、周ごとに独立した配列を持つ", () => {
    const sourceSnapshot = JSON.stringify(alphabetCharacters);
    const selectedIds = Object.freeze([...DEFAULT_CHARACTER_SELECTION]);
    const game = createCharacterPairGame({ ...defaultInput, selectedIds });
    const secondSnapshot = structuredClone(game.laps[1]);
    game.laps[0].cueIds.reverse();
    game.laps[0].letterIds.push("ho-nokhuk");
    game.selectedIds.reverse();
    expect(selectedIds).toEqual(DEFAULT_CHARACTER_SELECTION);
    expect(game.laps[1]).toEqual(secondSnapshot);
    expect(JSON.stringify(alphabetCharacters)).toBe(sourceSnapshot);
    expect(alphabetCharacters.find((entry) => entry.id === "mo-ma")?.name).toBe(
      "ม ม้า",
    );
  });

  it("不正な文字の選択・seed・形式・IDを開始時に拒否する", () => {
    for (const selectedIds of [
      [],
      ["ko-kai"],
      ["ko-kai", "ko-kai"],
      ["ko-kai", "unknown"],
      ["ko-kai", "mo-ma\u0301"],
      alphabetCharacters.slice(0, 9).map((entry) => entry.id),
    ]) {
      expect(() =>
        createCharacterPairGame({ ...defaultInput, selectedIds }),
      ).toThrow();
    }
    for (const seed of [
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0x100000000,
    ]) {
      expect(() =>
        createCharacterPairGame({ ...defaultInput, seed }),
      ).toThrow();
    }
    for (const gameId of [
      "",
      "a b",
      "constructor",
      "prototype",
      "__proto__",
      "a".repeat(101),
      "a\n",
    ]) {
      expect(() =>
        createCharacterPairGame({ ...defaultInput, gameId }),
      ).toThrow();
    }
    for (const mode of [
      "mixed",
      "letter-to-sound",
      "unknown",
    ] as unknown as PairMode[]) {
      expect(() =>
        createCharacterPairGame({ ...defaultInput, mode }),
      ).toThrow();
    }
    expect(() =>
      createCharacterPairGame({
        ...defaultInput,
        // @ts-expect-error 実行時の不正な配列も拒否する。
        selectedIds: null,
      }),
    ).toThrow();
    expect(() =>
      createCharacterPairGame({
        ...defaultInput,
        // @ts-expect-error 数字文字列をseedの整数とは扱わない。
        seed: "1",
      }),
    ).toThrow();
  });
});

describe("ペアの一致判定", () => {
  it("同じ字母だけが一致し、誤答は結び終えた記録に入らない", () => {
    const lap = createCharacterPairGame(defaultInput).laps[0];
    const matchedIds: string[] = [];
    const snapshot = structuredClone(lap);
    expect(gradeCharacterPair(lap, "ko-kai", "mo-ma", matchedIds)).toEqual({
      cueId: "ko-kai",
      letterId: "mo-ma",
      correct: false,
    });
    expect(matchedIds).toEqual([]);
    expect(gradeCharacterPair(lap, "ko-kai", "ko-kai", matchedIds)).toEqual({
      cueId: "ko-kai",
      letterId: "ko-kai",
      correct: true,
    });
    expect(matchedIds).toEqual([]);
    expect(lap).toEqual(snapshot);
  });

  it("正しく結んだ名前と字形を再利用せず、別の周は空の記録から続ける", () => {
    const game = createCharacterPairGame(defaultInput);
    const matched = Object.freeze(["ko-kai"]);
    for (const [cue, glyph] of [
      ["ko-kai", "ko-kai"],
      ["ko-kai", "mo-ma"],
      ["mo-ma", "ko-kai"],
    ]) {
      expect(() =>
        gradeCharacterPair(game.laps[0], cue, glyph, matched),
      ).toThrow();
    }
    expect(
      gradeCharacterPair(game.laps[0], "mo-ma", "mo-ma", matched).correct,
    ).toBe(true);
    expect(
      gradeCharacterPair(game.laps[1], "ko-kai", "ko-kai", []).correct,
    ).toBe(true);
  });

  it("未知・周の外・重複した完了IDを受け付けない", () => {
    const lap = createCharacterPairGame(defaultInput).laps[0];
    for (const [cue, glyph] of [
      ["unknown", "ko-kai"],
      ["ko-kai", "unknown"],
      ["ho-nokhuk", "ko-kai"],
      ["ko-kai", "ho-nokhuk"],
    ]) {
      expect(() => gradeCharacterPair(lap, cue, glyph, [])).toThrow();
    }
    for (const matched of [["ko-kai", "ko-kai"], ["unknown"], ["ho-nokhuk"]]) {
      expect(() =>
        gradeCharacterPair(lap, "mo-ma", "mo-ma", matched),
      ).toThrow();
    }
    expect(() =>
      gradeCharacterPair(
        lap,
        "ko-kai",
        "ko-kai",
        // @ts-expect-error 完了IDは配列に限る。
        null,
      ),
    ).toThrow();
  });

  it("周の欠落・不整合な左右の選択・重複を判定しない", () => {
    const lap = createCharacterPairGame(defaultInput).laps[0];
    const invalidLaps: PairLap[] = [
      { ...lap, id: "bad id" },
      { ...lap, cueIds: ["ko-kai"] },
      { ...lap, cueIds: ["ko-kai", "ko-kai"] },
      { ...lap, letterIds: ["ko-kai", "unknown"] },
      { ...lap, letterIds: ["ko-kai", "ho-nokhuk"] },
      { ...lap, letterIds: [...lap.letterIds, "ho-nokhuk"] },
    ];
    for (const invalid of invalidLaps) {
      expect(() =>
        gradeCharacterPair(invalid, "ko-kai", "ko-kai", []),
      ).toThrow();
    }
  });
});

import { alphabetCharacters } from "@/data/alphabet";
import { getCharacterTrainingReading } from "@/data/character-training";
import type { AlphabetCharacter } from "@/lib/alphabet-types";

export type PairMode = "audio-to-letter" | "name-to-letter";

export interface PairLap {
  id: string;
  number: 1 | 2;
  cueIds: string[];
  letterIds: string[];
}

export interface PairGame {
  id: string;
  selectedIds: string[];
  mode: PairMode;
  laps: [PairLap, PairLap];
}

export interface PairMatch {
  cueId: string;
  letterId: string;
  correct: boolean;
}

function charactersFor(ids: readonly string[]): AlphabetCharacter[] {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 8) {
    throw new Error("ペアで練習する文字を2〜8文字選んでください。");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("同じ文字を重複して選ぶことはできません。");
  }
  return ids.map((id) => {
    const character = alphabetCharacters.find((entry) => entry.id === id);
    if (!character) throw new Error("教材にない文字が含まれています。");
    return character;
  });
}

function isSafeId(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximumLength &&
    /^[A-Za-z0-9]/.test(value) &&
    !/[^A-Za-z0-9._:-]/.test(value) &&
    !["constructor", "prototype", "__proto__"].includes(value)
  );
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values: readonly string[], random: () => number): string[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function nextOrder(
  previous: readonly string[],
  random: () => number,
): string[] {
  const next = shuffle(previous, random);
  // 2文字でも、2周目が前の位置をそのままなぞる並びにならないようにする。
  return next.every((id, index) => id === previous[index])
    ? [...next.slice(1), next[0]]
    : next;
}

/** ペア練習は記憶内だけの活動。既存の8問の解答・保存記録へ変換しない。 */
export function createCharacterPairGame({
  selectedIds,
  mode,
  seed,
  gameId,
}: {
  selectedIds: readonly string[];
  mode: PairMode;
  seed: number;
  gameId?: string;
}): PairGame {
  const characters = charactersFor(selectedIds);
  if (mode !== "audio-to-letter" && mode !== "name-to-letter") {
    throw new Error("ペア練習の形式を確認してください。");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("並び順のseedは0〜4294967295の整数にしてください。");
  }
  if (gameId !== undefined && !isSafeId(gameId, 100)) {
    throw new Error("ペア練習IDの形式を確認してください。");
  }
  const cues = characters.map((character) =>
    mode === "audio-to-letter"
      ? character.name
      : getCharacterTrainingReading(character).romanizedName,
  );
  if (new Set(cues).size !== characters.length) {
    throw new Error("この文字の組合せでは名前を区別できません。");
  }
  const id = gameId ?? `pairs-${seed}`;
  const random = seededRandom(seed);
  const first: PairLap = {
    id: `${id}:lap1`,
    number: 1,
    cueIds: shuffle(selectedIds, random),
    letterIds: shuffle(selectedIds, random),
  };
  return {
    id,
    selectedIds: [...selectedIds],
    mode,
    laps: [
      first,
      {
        id: `${id}:lap2`,
        number: 2,
        cueIds: nextOrder(first.cueIds, random),
        letterIds: nextOrder(first.letterIds, random),
      },
    ],
  };
}

/** matchedIdsには、この周ですでに正しく結んだ文字のIDだけを渡す。 */
export function gradeCharacterPair(
  lap: PairLap,
  cueId: string,
  letterId: string,
  matchedIds: readonly string[],
): PairMatch {
  if (
    !lap ||
    !isSafeId(lap.id, 120) ||
    (lap.number !== 1 && lap.number !== 2)
  ) {
    throw new Error("ペア練習の周を確認してください。");
  }
  charactersFor(lap.cueIds);
  charactersFor(lap.letterIds);
  if (
    lap.cueIds.length !== lap.letterIds.length ||
    !lap.cueIds.every((id) => lap.letterIds.includes(id)) ||
    !lap.cueIds.includes(cueId) ||
    !lap.letterIds.includes(letterId)
  ) {
    throw new Error("この周にある名前と文字を選んでください。");
  }
  if (
    !Array.isArray(matchedIds) ||
    new Set(matchedIds).size !== matchedIds.length ||
    !matchedIds.every((id) => lap.cueIds.includes(id))
  ) {
    throw new Error("結び終えたペアの記録を確認してください。");
  }
  if (matchedIds.includes(cueId) || matchedIds.includes(letterId)) {
    throw new Error("この名前または文字は、すでに結び終えています。");
  }
  return { cueId, letterId, correct: cueId === letterId };
}

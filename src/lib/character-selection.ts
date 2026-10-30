import { alphabetCharacters } from "@/data/alphabet";
import type { CharacterTrainingRecord } from "@/lib/character-training-progress";

export type CharacterSelectionScope = "common" | "unpracticed" | "weak";
export type CharacterSelectionCount = 4 | 8;

export interface CharacterSelectionOptions {
  scope: CharacterSelectionScope;
  count: CharacterSelectionCount;
  seed: number;
  /** useCharacterTraining が読み込んだ文字別記録。ここからは書き換えない。 */
  records: Readonly<Record<string, CharacterTrainingRecord>>;
  previousIds?: readonly string[];
}

export interface CharacterSelectionSuggestion {
  selectedIds: string[];
  reason: string;
}

const knownIds = new Set(alphabetCharacters.map((entry) => entry.id));
const commonIds = alphabetCharacters
  .filter((entry) => entry.usage === "common")
  .map((entry) => entry.id);

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(ids: readonly string[], random: () => number): string[] {
  const result = [...ids];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function validateOptions({
  scope,
  count,
  seed,
  records,
  previousIds,
}: CharacterSelectionOptions): void {
  if (!["common", "unpracticed", "weak"].includes(scope))
    throw new Error("文字を選ぶ方法を確認してください。");
  if (count !== 4 && count !== 8)
    throw new Error("おまかせでは4字か8字を選んでください。");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("組合せのseedは0〜4294967295の整数にしてください。");
  if (typeof records !== "object" || records === null || Array.isArray(records))
    throw new Error("文字練習の記録を確認できません。");
  for (const [id, record] of Object.entries(records)) {
    if (
      !knownIds.has(id) ||
      typeof record !== "object" ||
      record === null ||
      !Number.isSafeInteger(record.correct) ||
      record.correct < 0 ||
      !Number.isSafeInteger(record.incorrect) ||
      record.incorrect < 0 ||
      typeof record.lastCorrect !== "boolean"
    )
      throw new Error("文字練習の記録を確認できません。");
  }
  if (
    previousIds !== undefined &&
    (!Array.isArray(previousIds) ||
      previousIds.length > 8 ||
      !previousIds.every(
        (id: unknown) => typeof id === "string" && knownIds.has(id),
      ) ||
      new Set(previousIds).size !== previousIds.length)
  )
    throw new Error("前の文字セットを確認できません。");
}

/**
 * 現用42字の組合せを提案するだけの純粋関数。出題・採点・保存は行わない。
 * 直近の誤答を優先し、以前に誤答しても最後が正解の文字を苦手と決め付けない。
 */
export function suggestCharacterSelection(
  options: CharacterSelectionOptions,
): CharacterSelectionSuggestion {
  validateOptions(options);
  const { scope, count, seed, records, previousIds } = options;
  const recordFor = (id: string) =>
    Object.hasOwn(records, id) ? records[id] : undefined;
  const isPriority = (id: string): boolean => {
    const record = recordFor(id);
    if (scope === "unpracticed")
      return !record || record.correct + record.incorrect === 0;
    if (scope === "weak")
      return Boolean(
        record && record.correct + record.incorrect > 0 && !record.lastCorrect,
      );
    return false;
  };

  const random = seededRandom(seed);
  const priority = commonIds.filter(isPriority);
  const other = commonIds.filter((id) => !isPriority(id));
  const ranked = [...shuffle(priority, random), ...shuffle(other, random)];
  const selectedIds = ranked.slice(0, count);
  if (
    previousIds?.length === count &&
    selectedIds.every((id) => previousIds.includes(id))
  ) {
    // Change one member, not just the order, while keeping as many priority letters as possible.
    const replacement = ranked.find((id) => !selectedIds.includes(id));
    if (replacement) selectedIds[selectedIds.length - 1] = replacement;
  }

  const priorityCount = selectedIds.filter(isPriority).length;
  let reason: string;
  if (scope === "common") {
    reason = `現用の子音42字から${count}字を組み合わせました。`;
  } else if (scope === "unpracticed") {
    reason =
      priorityCount === count
        ? `8問の練習記録がない${count}字を選びました。`
        : priorityCount > 0
          ? `未練習の${priorityCount}字と、ほかの現用字${count - priorityCount}字を組み合わせました。`
          : `全42字に8問の記録があるため、現用字${count}字を選びました。`;
  } else {
    reason =
      priorityCount === count
        ? `直近にまちがえた${count}字を選びました。`
        : priorityCount > 0
          ? `直近にまちがえた${priorityCount}字と、見比べる現用字${count - priorityCount}字を選びました。`
          : `直近にまちがえた現用字の記録がないため、${count}字を選びました。`;
  }
  return { selectedIds, reason };
}

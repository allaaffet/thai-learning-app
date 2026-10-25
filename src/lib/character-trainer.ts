import { alphabetCharacters } from "@/data/alphabet";
import { getCharacterTrainingReading } from "@/data/character-training";
import type { AlphabetCharacter } from "@/lib/alphabet-types";

export const MIN_TRAINING_CHARACTERS = 2;
export const MAX_TRAINING_CHARACTERS = 8;
export const TRAINING_ROUND_SIZE = 8;

export type CharacterTrainingMode =
  | "audio-to-letter"
  | "name-to-letter"
  | "letter-to-sound"
  | "mixed";
export type CharacterTrainingKind = Exclude<CharacterTrainingMode, "mixed">;

export interface TrainerQuestion {
  id: string;
  kind: CharacterTrainingKind;
  targetId: string;
  prompt: string;
  cue: string;
  audioText?: string;
  readingName?: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
}

export interface TrainerAnswer {
  questionId: string;
  characterId: string;
  kind: CharacterTrainingKind;
  selectedOptionId: string | null;
  correct: boolean;
}

export interface TrainerSession {
  id: string;
  selectedIds: string[];
  mode: CharacterTrainingMode;
  questions: TrainerQuestion[];
  soundFallback: boolean;
}

function selectedCharacters(
  selectedIds: readonly string[],
): AlphabetCharacter[] {
  if (
    !Array.isArray(selectedIds) ||
    selectedIds.length < MIN_TRAINING_CHARACTERS ||
    selectedIds.length > MAX_TRAINING_CHARACTERS
  ) {
    throw new Error("練習する文字を2〜8文字選んでください。");
  }
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("同じ文字を重複して選ぶことはできません。");
  }
  return selectedIds.map((id) => {
    const character = alphabetCharacters.find((entry) => entry.id === id);
    if (!character) throw new Error("教材にない文字が含まれています。");
    return character;
  });
}

function acceptedInitialSounds(character: AlphabetCharacter): Set<string> {
  return new Set([
    character.initialIpa,
    ...(character.alternateInitialIpa ?? []),
  ]);
}

/** 同音の字母や、語によって別の初頭音を持つ字母を誤答の根拠にしない。 */
export function getCharacterTrainingModeAvailability(
  selectedIds: readonly string[],
): {
  soundAvailable: boolean;
  soundFallbackReason?: string;
} {
  let characters: AlphabetCharacter[];
  try {
    characters = selectedCharacters(selectedIds);
  } catch (error) {
    return {
      soundAvailable: false,
      soundFallbackReason:
        error instanceof Error ? error.message : "文字を選び直してください。",
    };
  }
  const soundAvailable = characters.every((target) => {
    const accepted = acceptedInitialSounds(target);
    return characters.some((foil) => !accepted.has(foil.initialIpa));
  });
  return soundAvailable
    ? { soundAvailable: true }
    : {
        soundAvailable: false,
        soundFallbackReason:
          "同じ初頭音や別の読み方が重なるため、この組合せでは音の選択問題を一意に作れません。名前と形の練習を使います。",
      };
}

/** seed=0も使える決定的なPRNG。教材や選択配列は変更しない。 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return shuffled;
}

function questionFor(
  target: AlphabetCharacter,
  characters: AlphabetCharacter[],
  kind: CharacterTrainingKind,
  random: () => number,
  id: string,
): TrainerQuestion {
  if (kind !== "letter-to-sound") {
    const isAudio = kind === "audio-to-letter";
    const reading = isAudio ? undefined : getCharacterTrainingReading(target);
    const distractors = shuffle(
      characters.filter((entry) => entry.id !== target.id),
      random,
    ).slice(0, 3);
    return {
      id,
      kind,
      targetId: target.id,
      prompt: isAudio ? "聞こえた名前の文字は？" : "この読み方の文字は？",
      cue: reading?.ipa ?? "",
      ...(reading
        ? { readingName: reading.romanizedName }
        : { audioText: target.name }),
      options: shuffle([target, ...distractors], random).map((entry) => ({
        id: entry.id,
        label: entry.thai,
      })),
      correctOptionId: target.id,
    };
  }

  const accepted = acceptedInitialSounds(target);
  const distractors = shuffle(
    [...new Set(characters.map((entry) => entry.initialIpa))].filter(
      (sound) => !accepted.has(sound),
    ),
    random,
  ).slice(0, 3);
  return {
    id,
    kind,
    targetId: target.id,
    prompt: "この文字の基本初頭音は？",
    cue: target.thai,
    options: shuffle([target.initialIpa, ...distractors], random).map(
      (sound) => ({
        id: `ipa:${sound}`,
        label: sound,
      }),
    ),
    correctOptionId: `ipa:${target.initialIpa}`,
  };
}

export function createCharacterTrainingSession({
  selectedIds,
  mode,
  seed,
  sessionId,
}: {
  selectedIds: readonly string[];
  mode: CharacterTrainingMode;
  seed: number;
  sessionId?: string;
}): TrainerSession {
  const characters = selectedCharacters(selectedIds);
  if (
    mode !== "audio-to-letter" &&
    mode !== "name-to-letter" &&
    mode !== "letter-to-sound" &&
    mode !== "mixed"
  ) {
    throw new Error("練習モードを確認してください。");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("出題順のseedは0〜4294967295の整数にしてください。");
  }
  if (
    sessionId !== undefined &&
    (typeof sessionId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(sessionId) ||
      ["constructor", "prototype", "__proto__"].includes(sessionId))
  ) {
    throw new Error("練習IDの形式を確認してください。");
  }
  const availability = getCharacterTrainingModeAvailability(selectedIds);
  if (mode === "letter-to-sound" && !availability.soundAvailable) {
    throw new Error(availability.soundFallbackReason);
  }
  const id = sessionId ?? `training-${seed}`;
  const random = seededRandom(seed);
  const targetOrder: AlphabetCharacter[] = [];
  while (targetOrder.length < TRAINING_ROUND_SIZE) {
    targetOrder.push(...shuffle(characters, random));
  }
  const soundFallback = mode === "mixed" && !availability.soundAvailable;
  const mixedKinds: CharacterTrainingKind[] = shuffle(
    Array.from({ length: TRAINING_ROUND_SIZE }, (_, index) =>
      index % 2 === 0 ? "name-to-letter" : "letter-to-sound",
    ),
    random,
  );
  return {
    id,
    selectedIds: [...selectedIds],
    mode,
    soundFallback,
    questions: targetOrder
      .slice(0, TRAINING_ROUND_SIZE)
      .map((target, index) => {
        const kind =
          mode === "audio-to-letter"
            ? "audio-to-letter"
            : mode === "name-to-letter" || soundFallback
              ? "name-to-letter"
              : mode === "letter-to-sound"
                ? "letter-to-sound"
                : mixedKinds[index];
        return questionFor(
          target,
          characters,
          kind,
          random,
          `${id}:q${index + 1}`,
        );
      }),
  };
}

/** 未提示の選択肢・不正な問題を受け付けず、スキップ(null)は未正答として返す。 */
export function gradeCharacterTrainingQuestion(
  question: TrainerQuestion,
  optionId: string | null,
): TrainerAnswer {
  const target = alphabetCharacters.find(
    (entry) => entry.id === question?.targetId,
  );
  if (
    !target ||
    typeof question.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(question.id) ||
    (question.kind !== "audio-to-letter" &&
      question.kind !== "name-to-letter" &&
      question.kind !== "letter-to-sound") ||
    !Array.isArray(question.options) ||
    question.options.length < 2 ||
    question.options.length > 4
  ) {
    throw new Error("問題の形式を確認してください。");
  }
  if (
    question.kind === "audio-to-letter" &&
    (question.audioText !== target.name ||
      question.cue !== "" ||
      question.prompt !== "聞こえた名前の文字は？")
  ) {
    throw new Error("音声問題と字母名の整合性を確認してください。");
  }
  if (question.kind === "name-to-letter") {
    const reading = getCharacterTrainingReading(target);
    if (
      question.cue !== reading.ipa ||
      question.readingName !== reading.romanizedName ||
      question.prompt !== "この読み方の文字は？"
    ) {
      throw new Error("読み方と字母名の整合性を確認してください。");
    }
  }
  const expectedAnswer =
    question.kind === "letter-to-sound"
      ? `ipa:${target.initialIpa}`
      : target.id;
  const accepted = acceptedInitialSounds(target);
  if (
    question.correctOptionId !== expectedAnswer ||
    new Set(question.options.map((option) => option?.id)).size !==
      question.options.length ||
    new Set(question.options.map((option) => option?.label)).size !==
      question.options.length ||
    !question.options.some((option) => option?.id === expectedAnswer) ||
    !question.options.every((option) => {
      if (
        !option ||
        typeof option.id !== "string" ||
        typeof option.label !== "string"
      )
        return false;
      if (question.kind !== "letter-to-sound") {
        return alphabetCharacters.some(
          (entry) => entry.id === option.id && entry.thai === option.label,
        );
      }
      return (
        option.id === `ipa:${option.label}` &&
        alphabetCharacters.some((entry) => entry.initialIpa === option.label) &&
        (option.id === expectedAnswer || !accepted.has(option.label))
      );
    })
  ) {
    throw new Error("正答と選択肢の整合性を確認してください。");
  }
  if (
    optionId !== null &&
    !question.options.some((option) => option.id === optionId)
  ) {
    throw new Error("提示された選択肢を選んでください。");
  }
  return {
    questionId: question.id,
    characterId: target.id,
    kind: question.kind,
    selectedOptionId: optionId,
    correct: optionId === expectedAnswer,
  };
}

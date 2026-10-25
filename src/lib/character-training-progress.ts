import { alphabetCharacters } from "@/data/alphabet";
import { DEFAULT_CHARACTER_SELECTION } from "@/data/character-training";
import {
  MAX_TRAINING_CHARACTERS,
  MIN_TRAINING_CHARACTERS,
  TRAINING_ROUND_SIZE,
  type CharacterTrainingMode,
} from "@/lib/character-trainer";

export const CHARACTER_TRAINING_STORAGE_KEY =
  "thai-learning.character-training.v1";
const MAX_RECENT_SESSIONS = 100;
const MAX_SESSIONS = 1_000_000;
const MAX_ANSWERS = MAX_SESSIONS * TRAINING_ROUND_SIZE;
const characterIds = new Set(
  alphabetCharacters.map((character) => character.id),
);
const characterOrder = new Map(
  alphabetCharacters.map((character, index) => [character.id, index]),
);

export interface CharacterTrainingRecord {
  correct: number;
  incorrect: number;
  lastPracticedAt: string;
  lastCorrect: boolean;
}

/** Independent practice records; these never award lesson XP or change SRS. */
export interface CharacterTrainingState {
  version: 1;
  selectedIds: string[];
  mode: CharacterTrainingMode;
  records: Record<string, CharacterTrainingRecord>;
  sessionsCompleted: number;
  recentSessionIds: string[];
  lastPracticedAt?: string;
}

export interface CharacterTrainingSettings {
  selectedIds: readonly string[];
  mode: CharacterTrainingMode;
}

export interface CharacterTrainingSession {
  id: string;
  attempts: readonly { characterId: string; correct: boolean }[];
  completedAt: string;
}

export interface CharacterTrainingLoadResult {
  state: CharacterTrainingState;
  status: "empty" | "loaded" | "invalid" | "unavailable";
  message?: string;
}

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function createEmptyCharacterTrainingState(): CharacterTrainingState {
  return {
    version: 1,
    selectedIds: [...DEFAULT_CHARACTER_SELECTION],
    mode: "audio-to-letter",
    records: {},
    sessionsCompleted: 0,
    recentSessionIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;
  const day = new Date(`${match[1]}T12:00:00Z`);
  return (
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === match[1] &&
    Number(match[2]) < 24 &&
    Number(match[3]) < 60 &&
    Number(match[4]) < 60 &&
    (match[5] === undefined ||
      (Number(match[5]) < 24 && Number(match[6]) < 60)) &&
    Number.isFinite(new Date(value).getTime())
  );
}

function isSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value) &&
    !["constructor", "prototype", "__proto__"].includes(value)
  );
}

function isMode(value: unknown): value is CharacterTrainingMode {
  return (
    value === "audio-to-letter" ||
    value === "name-to-letter" ||
    value === "letter-to-sound" ||
    value === "mixed"
  );
}

function isSelection(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= MIN_TRAINING_CHARACTERS &&
    value.length <= MAX_TRAINING_CHARACTERS &&
    value.every(
      (id: unknown) => typeof id === "string" && characterIds.has(id),
    ) &&
    new Set(value).size === value.length
  );
}

/** Saved counters must describe whole eight-question sessions, not partial play. */
export function isCharacterTrainingState(
  value: unknown,
): value is CharacterTrainingState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isSelection(value.selectedIds) ||
    !isMode(value.mode) ||
    !isRecord(value.records) ||
    !isCount(value.sessionsCompleted, MAX_SESSIONS) ||
    !Array.isArray(value.recentSessionIds) ||
    value.recentSessionIds.length !==
      Math.min(value.sessionsCompleted, MAX_RECENT_SESSIONS) ||
    !value.recentSessionIds.every(isSessionId) ||
    new Set(value.recentSessionIds).size !== value.recentSessionIds.length
  )
    return false;

  let total = 0;
  let latestTime = -Infinity;
  for (const [id, record] of Object.entries(value.records)) {
    if (
      !characterIds.has(id) ||
      !isRecord(record) ||
      !isCount(record.correct, MAX_ANSWERS) ||
      !isCount(record.incorrect, MAX_ANSWERS) ||
      record.correct + record.incorrect === 0 ||
      typeof record.lastCorrect !== "boolean" ||
      (record.lastCorrect ? record.correct === 0 : record.incorrect === 0) ||
      !isTimestamp(record.lastPracticedAt)
    )
      return false;
    total += record.correct + record.incorrect;
    latestTime = Math.max(
      latestTime,
      new Date(record.lastPracticedAt).getTime(),
    );
  }
  if (total !== value.sessionsCompleted * TRAINING_ROUND_SIZE) return false;
  return value.sessionsCompleted === 0
    ? value.lastPracticedAt === undefined
    : isTimestamp(value.lastPracticedAt) &&
        new Date(value.lastPracticedAt).getTime() === latestTime;
}

function copyState(state: CharacterTrainingState): CharacterTrainingState {
  return {
    version: 1,
    selectedIds: [...state.selectedIds],
    mode: state.mode,
    records: Object.fromEntries(
      Object.entries(state.records).map(([id, record]) => [
        id,
        {
          correct: record.correct,
          incorrect: record.incorrect,
          lastPracticedAt: record.lastPracticedAt,
          lastCorrect: record.lastCorrect,
        },
      ]),
    ),
    sessionsCompleted: state.sessionsCompleted,
    recentSessionIds: [...state.recentSessionIds],
    ...(state.lastPracticedAt === undefined
      ? {}
      : { lastPracticedAt: state.lastPracticedAt }),
  };
}

function parseState(raw: string): CharacterTrainingState | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCharacterTrainingState(parsed) ? copyState(parsed) : undefined;
  } catch {
    return undefined;
  }
}

function assertState(state: CharacterTrainingState): void {
  if (!isCharacterTrainingState(state))
    throw new Error("文字練習の記録を読み取れません。");
}

export function withCharacterTrainingSettings(
  state: CharacterTrainingState,
  settings: CharacterTrainingSettings,
): CharacterTrainingState {
  assertState(state);
  if (!isSelection(settings.selectedIds) || !isMode(settings.mode))
    throw new Error("練習する文字を重複なしで2〜8文字選んでください。");
  return {
    ...copyState(state),
    selectedIds: [...settings.selectedIds],
    mode: settings.mode,
  };
}

/** Call only after all eight answers have been confirmed. */
export function recordCharacterTrainingSession(
  state: CharacterTrainingState,
  session: CharacterTrainingSession,
): CharacterTrainingState {
  assertState(state);
  if (
    !isSessionId(session.id) ||
    !isTimestamp(session.completedAt) ||
    !Array.isArray(session.attempts) ||
    session.attempts.length !== TRAINING_ROUND_SIZE ||
    !session.attempts.every(
      (attempt: unknown) =>
        isRecord(attempt) &&
        typeof attempt.characterId === "string" &&
        characterIds.has(attempt.characterId) &&
        typeof attempt.correct === "boolean",
    )
  )
    throw new Error("8問の確定した解答と有効な日時が必要です。");
  // Retain a bounded idempotency window without saving individual answers.
  if (state.recentSessionIds.includes(session.id)) return state;
  if (state.sessionsCompleted >= MAX_SESSIONS)
    throw new Error("文字練習の記録件数が保存できる上限に達しました。");

  const next = copyState(state);
  const completedTime = new Date(session.completedAt).getTime();
  for (const attempt of session.attempts) {
    const record = next.records[attempt.characterId] ?? {
      correct: 0,
      incorrect: 0,
      lastPracticedAt: session.completedAt,
      lastCorrect: attempt.correct,
    };
    if (attempt.correct) record.correct += 1;
    else record.incorrect += 1;
    // An older completion from another tab contributes counts, not stale status.
    if (completedTime >= new Date(record.lastPracticedAt).getTime()) {
      record.lastPracticedAt = session.completedAt;
      record.lastCorrect = attempt.correct;
    }
    next.records[attempt.characterId] = record;
  }
  next.sessionsCompleted += 1;
  next.recentSessionIds = [...next.recentSessionIds, session.id].slice(
    -MAX_RECENT_SESSIONS,
  );
  if (
    next.lastPracticedAt === undefined ||
    completedTime >= new Date(next.lastPracticedAt).getTime()
  )
    next.lastPracticedAt = session.completedAt;
  return next;
}

/** Unseen letters are neither weak nor mastered; a later correct answer clears weakness. */
export function getWeakCharacterIds(
  state: CharacterTrainingState,
  limit = MAX_TRAINING_CHARACTERS,
): string[] {
  assertState(state);
  if (!Number.isInteger(limit) || limit < 0 || limit > MAX_TRAINING_CHARACTERS)
    throw new Error("苦手な文字は最大8文字まで選べます。");
  return Object.entries(state.records)
    .filter(([, record]) => !record.lastCorrect)
    .sort(
      ([leftId, left], [rightId, right]) =>
        new Date(right.lastPracticedAt).getTime() -
          new Date(left.lastPracticedAt).getTime() ||
        right.incorrect - left.incorrect ||
        (characterOrder.get(leftId) ?? 0) - (characterOrder.get(rightId) ?? 0),
    )
    .slice(0, limit)
    .map(([id]) => id);
}

/** Reading never writes defaults or repairs invalid/unknown-version data. */
export function loadCharacterTrainingState(
  storage?: Pick<Storage, "getItem">,
): CharacterTrainingLoadResult {
  const fallback = createEmptyCharacterTrainingState();
  try {
    const source =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!source) return { state: fallback, status: "unavailable" };
    const raw = source.getItem(CHARACTER_TRAINING_STORAGE_KEY);
    if (raw === null) return { state: fallback, status: "empty" };
    const state = parseState(raw);
    return state
      ? { state, status: "loaded" }
      : {
          state: fallback,
          status: "invalid",
          message:
            "文字練習の保存データを読み取れません。元データを保護し、このタブだけで練習します。",
        };
  } catch {
    return {
      state: fallback,
      status: "unavailable",
      message:
        "文字練習の保存機能を利用できません。このタブでは練習を続けられます。",
    };
  }
}

/** Explicit recovery only; the caller must label the destructive overwrite clearly. */
export function replaceCharacterTrainingState(
  state: CharacterTrainingState,
  storage?: Pick<Storage, "setItem">,
): boolean {
  if (!isCharacterTrainingState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    target.setItem(
      CHARACTER_TRAINING_STORAGE_KEY,
      JSON.stringify(copyState(state)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Explicit settings/completion only; protect malformed data until manual recovery. */
export function saveCharacterTrainingState(
  state: CharacterTrainingState,
  storage?: StorageAdapter,
): boolean {
  if (!isCharacterTrainingState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    const raw = target.getItem(CHARACTER_TRAINING_STORAGE_KEY);
    if (raw !== null && !parseState(raw)) return false;
    return replaceCharacterTrainingState(state, target);
  } catch {
    return false;
  }
}

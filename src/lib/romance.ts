import {
  getRomanceCharacter,
  getRomanceEpisode,
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
} from "@/data/romance";
import type { RomanceGender, RomancePreference } from "@/lib/romance-types";

export const ROMANCE_STORAGE_KEY = "thai-learning.romance.v1";
const MAX_RECENT_SESSIONS = 100;
const MAX_PLAYS = 1_000_000;
let fallbackSessionSequence = 0;

export interface RomanceProfile {
  gender: RomanceGender;
  preference: RomancePreference;
}

export interface RomanceEpisodeProgress {
  completedAt: string;
  lastPlayedAt: string;
  bestCorrect: number;
  total: number;
  plays: number;
}

export interface RomanceCharacterProgress {
  affinity: number;
  episodes: Record<string, RomanceEpisodeProgress>;
  studyDays: string[];
  lastBonusDay?: string;
  streak: number;
}

/** Fictional relationship progress only; never main-course XP or proficiency. */
export interface RomanceState {
  version: 1;
  profile: RomanceProfile | null;
  characters: Record<string, RomanceCharacterProgress>;
  recentSessionIds: string[];
}

export interface RomanceEpisodeInput {
  characterId: string;
  episodeId: string;
  sessionId: string;
  answers: readonly { stepId: string; choiceId: string }[];
  storyChoiceId: string;
  now?: string;
}

export interface RomanceReceipt {
  correct: number;
  total: number;
  languageDelta: number;
  storyDelta: number;
  firstClearBonus: number;
  dailyBonus: number;
  affinityBefore: number;
  affinityAfter: number;
  applied: boolean;
  firstClear: boolean;
}

export type RomanceLoadStatus = "empty" | "loaded" | "invalid" | "unavailable";
export interface RomanceLoadResult {
  state: RomanceState;
  status: RomanceLoadStatus;
  message?: string;
}
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function createEmptyRomance(): RomanceState {
  return { version: 1, profile: null, characters: {}, recentSessionIds: [] };
}

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function onlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function integer(
  value: unknown,
  min: number,
  max = MAX_PLAYS,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function gender(value: unknown): value is RomanceGender {
  return value === "male" || value === "female";
}
function preference(value: unknown): value is RomancePreference {
  return value === "warm" || value === "calm" || value === "curious";
}
function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  return Boolean(
    parts &&
      day(parts[1]) &&
      Number(parts[2]) < 24 &&
      Number(parts[3]) < 60 &&
      Number(parts[4]) < 60 &&
      (parts[5] === undefined ||
        (Number(parts[5]) < 24 && Number(parts[6]) < 60)) &&
      Number.isFinite(Date.parse(value)),
  );
}
function sessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(value)
  );
}

export function getRomanceLocalDay(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("学習日時を確認できません。");
  const key = `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (!day(key)) throw new Error("学習日時を確認できません。");
  return key;
}

/** Calendar dates, rather than elapsed milliseconds, also work across DST. */
function dayNumber(value: string): number {
  return Date.parse(`${value}T12:00:00Z`) / 86_400_000;
}

function validCharacterProgress(
  value: unknown,
  characterId: string,
): value is RomanceCharacterProgress {
  if (
    !record(value) ||
    !onlyKeys(value, [
      "affinity",
      "episodes",
      "studyDays",
      "lastBonusDay",
      "streak",
    ]) ||
    !integer(value.affinity, 0, 100) ||
    !record(value.episodes) ||
    !Array.isArray(value.studyDays) ||
    !value.studyDays.every(day) ||
    new Set(value.studyDays).size !== value.studyDays.length ||
    !integer(value.streak, 0)
  )
    return false;
  if (
    value.lastBonusDay !== undefined &&
    (!day(value.lastBonusDay) || !value.studyDays.includes(value.lastBonusDay))
  )
    return false;
  if (value.streak > 0 !== (value.lastBonusDay !== undefined)) return false;
  const episodes = value.episodes;
  return Object.entries(episodes).every(([episodeId, entry]) => {
    const episode = getRomanceEpisode(episodeId);
    if (
      !episode ||
      !record(entry) ||
      !onlyKeys(entry, [
        "completedAt",
        "lastPlayedAt",
        "bestCorrect",
        "total",
        "plays",
      ])
    )
      return false;
    const total = getRomanceQuestions(characterId, episodeId).length;
    return (
      timestamp(entry.completedAt) &&
      timestamp(entry.lastPlayedAt) &&
      Date.parse(entry.lastPlayedAt) >= Date.parse(entry.completedAt) &&
      integer(entry.total, 1) &&
      entry.total === total &&
      integer(entry.bestCorrect, 0, total) &&
      integer(entry.plays, 1) &&
      (!episode.previousEpisodeId ||
        Object.hasOwn(episodes, episode.previousEpisodeId))
    );
  });
}

export function isRomanceState(value: unknown): value is RomanceState {
  if (
    !record(value) ||
    !onlyKeys(value, [
      "version",
      "profile",
      "characters",
      "recentSessionIds",
    ]) ||
    value.version !== 1 ||
    !record(value.characters) ||
    !Array.isArray(value.recentSessionIds) ||
    value.recentSessionIds.length > MAX_RECENT_SESSIONS ||
    !value.recentSessionIds.every(sessionId) ||
    new Set(value.recentSessionIds).size !== value.recentSessionIds.length
  )
    return false;
  if (
    value.profile !== null &&
    (!record(value.profile) ||
      !onlyKeys(value.profile, ["gender", "preference"]) ||
      !gender(value.profile.gender) ||
      !preference(value.profile.preference))
  )
    return false;
  return Object.entries(value.characters).every(
    ([id, progress]) =>
      Boolean(getRomanceCharacter(id)) && validCharacterProgress(progress, id),
  );
}

function copyState(state: RomanceState): RomanceState {
  return {
    version: 1,
    profile: state.profile ? { ...state.profile } : null,
    characters: Object.fromEntries(
      Object.entries(state.characters).map(([id, progress]) => [
        id,
        {
          affinity: progress.affinity,
          episodes: Object.fromEntries(
            Object.entries(progress.episodes).map(([episodeId, episode]) => [
              episodeId,
              { ...episode },
            ]),
          ),
          studyDays: [...progress.studyDays],
          ...(progress.lastBonusDay
            ? { lastBonusDay: progress.lastBonusDay }
            : {}),
          streak: progress.streak,
        },
      ]),
    ),
    recentSessionIds: [...state.recentSessionIds],
  };
}

export function setRomanceProfile(
  state: RomanceState,
  nextGender: RomanceGender,
  nextPreference: RomancePreference,
): RomanceState {
  if (
    !isRomanceState(state) ||
    !gender(nextGender) ||
    !preference(nextPreference)
  )
    throw new Error("主人公の設定を確認してください。");
  const next = copyState(state);
  next.profile = { gender: nextGender, preference: nextPreference };
  return next;
}

export function getAvailableRomanceCharacters(state: RomanceState) {
  if (!state.profile) return [];
  const profile = state.profile;
  return romanceCharacters
    .filter((character) => character.gender !== profile.gender)
    .sort(
      (a, b) =>
        Number(b.traits.includes(profile.preference)) -
        Number(a.traits.includes(profile.preference)),
    );
}

export function getRomanceCharacterProgress(
  state: RomanceState,
  characterId: string,
): RomanceCharacterProgress {
  const progress = Object.hasOwn(state.characters, characterId)
    ? state.characters[characterId]
    : undefined;
  return progress ?? { affinity: 0, episodes: {}, studyDays: [], streak: 0 };
}

export function isRomanceEpisodeUnlocked(
  state: RomanceState,
  characterId: string,
  episodeId: string,
): boolean {
  const character = getRomanceCharacter(characterId);
  const episode = getRomanceEpisode(episodeId);
  if (
    !state.profile ||
    !character ||
    !episode ||
    character.gender === state.profile.gender
  )
    return false;
  return (
    !episode.previousEpisodeId ||
    Boolean(state.characters[characterId]?.episodes[episode.previousEpisodeId])
  );
}

export function gradeRomanceChoice(
  characterId: string,
  episodeId: string,
  stepId: string,
  choiceId: string,
) {
  const question = getRomanceQuestions(characterId, episodeId).find(
    (step) => step.id === stepId,
  );
  const choice = question?.choices.find((option) => option.id === choiceId);
  if (!question || !choice) throw new Error("この場面の返答を確認できません。");
  return {
    correct: question.answerIds.includes(choice.id),
    explanation: question.explanation,
    choiceExplanation: choice.explanation,
    correctChoiceIds: [...question.answerIds],
  };
}

export function completeRomanceEpisode(
  state: RomanceState,
  input: RomanceEpisodeInput,
): { state: RomanceState; receipt: RomanceReceipt } {
  if (
    !isRomanceState(state) ||
    !record(input) ||
    !sessionId(input.sessionId) ||
    typeof input.characterId !== "string" ||
    typeof input.episodeId !== "string" ||
    typeof input.storyChoiceId !== "string"
  )
    throw new Error("物語の記録を確認できません。");
  if (!isRomanceEpisodeUnlocked(state, input.characterId, input.episodeId))
    throw new Error("主人公の設定や、前のエピソードを確認してください。");
  const now = input.now ?? new Date().toISOString();
  if (!timestamp(now)) throw new Error("学習日時を確認できません。");
  const questions = getRomanceQuestions(input.characterId, input.episodeId);
  if (
    !Array.isArray(input.answers) ||
    input.answers.length !== questions.length ||
    !questions.length
  )
    throw new Error("すべての返答を確認してから記録してください。");
  const seen = new Set<string>();
  let correct = 0;
  for (const answer of input.answers) {
    if (
      !record(answer) ||
      typeof answer.stepId !== "string" ||
      typeof answer.choiceId !== "string" ||
      seen.has(answer.stepId)
    )
      throw new Error("返答が重複しているか、確認できません。");
    const result = gradeRomanceChoice(
      input.characterId,
      input.episodeId,
      answer.stepId,
      answer.choiceId,
    );
    seen.add(answer.stepId);
    if (result.correct) correct += 1;
  }
  if (questions.some((question) => !seen.has(question.id)))
    throw new Error("すべての返答を確認してください。");
  const storyChoice = getRomanceStoryOptions(
    input.characterId,
    input.episodeId,
  ).find((choice) => choice.id === input.storyChoiceId);
  if (!storyChoice || !integer(Math.abs(storyChoice.affinityDelta), 0, 10))
    throw new Error("物語の選択を確認してください。");
  const previous = getRomanceCharacterProgress(state, input.characterId);
  const next = copyState(state);
  const receipt: RomanceReceipt = {
    correct,
    total: questions.length,
    languageDelta: 0,
    storyDelta: 0,
    firstClearBonus: 0,
    dailyBonus: 0,
    affinityBefore: previous.affinity,
    affinityAfter: previous.affinity,
    applied: false,
    firstClear: false,
  };
  if (state.recentSessionIds.includes(input.sessionId))
    return { state: next, receipt };
  const episode = previous.episodes[input.episodeId];
  const firstClear = !episode;
  receipt.firstClear = firstClear;
  if (firstClear) {
    receipt.languageDelta = correct * 2 - (questions.length - correct);
    receipt.storyDelta = storyChoice.affinityDelta;
    receipt.firstClearBonus = 2;
  }
  const today = getRomanceLocalDay(now);
  let streak = previous.streak;
  let lastBonusDay = previous.lastBonusDay;
  if (!lastBonusDay || dayNumber(today) > dayNumber(lastBonusDay)) {
    const consecutive = Boolean(
      lastBonusDay && dayNumber(today) - dayNumber(lastBonusDay) === 1,
    );
    streak = consecutive ? Math.min(previous.streak + 1, MAX_PLAYS) : 1;
    receipt.dailyBonus = consecutive ? 3 : 2;
    lastBonusDay = today;
  }
  const affinity = Math.min(
    100,
    Math.max(
      0,
      previous.affinity +
        receipt.languageDelta +
        receipt.storyDelta +
        receipt.firstClearBonus +
        receipt.dailyBonus,
    ),
  );
  const playedAt =
    episode && Date.parse(episode.lastPlayedAt) > Date.parse(now)
      ? episode.lastPlayedAt
      : now;
  next.characters[input.characterId] = {
    affinity,
    episodes: {
      ...previous.episodes,
      [input.episodeId]: {
        completedAt: episode?.completedAt ?? now,
        lastPlayedAt: playedAt,
        bestCorrect: Math.max(episode?.bestCorrect ?? 0, correct),
        total: questions.length,
        plays: Math.min((episode?.plays ?? 0) + 1, MAX_PLAYS),
      },
    },
    studyDays: [...new Set([...previous.studyDays, today])].sort(),
    ...(lastBonusDay ? { lastBonusDay } : {}),
    streak,
  };
  next.recentSessionIds = [...state.recentSessionIds, input.sessionId].slice(
    -MAX_RECENT_SESSIONS,
  );
  receipt.affinityAfter = affinity;
  receipt.applied = true;
  return { state: next, receipt };
}

export function getRomanceRelationship(affinity: number) {
  const score = Number.isFinite(affinity)
    ? Math.max(0, Math.min(100, affinity))
    : 0;
  const level = Math.min(4, Math.floor(score / 20));
  return {
    level,
    label: [
      "出会ったばかり",
      "気になる存在",
      "親しい友だち",
      "二人でお出かけ",
      "特別な人",
    ][level],
  };
}

export function getRomanceEnding(state: RomanceState, characterId: string) {
  const progress = getRomanceCharacterProgress(state, characterId);
  const unlocked = romanceEpisodes.every((episode) =>
    Boolean(progress.episodes[episode.id]),
  );
  if (!unlocked)
    return {
      unlocked: false,
      title: "ふたりの物語は、これから",
      description:
        "5つのエピソードを進めると、今の関係に合わせた後日談を読めます。",
    };
  if (progress.affinity >= 80)
    return {
      unlocked: true,
      title: "また、ふたりで",
      description:
        "ふたりは、また一緒に出かけたいと気持ちを伝え合いました。これからも、短い会話を重ねていきます。",
    };
  if (progress.affinity >= 40)
    return {
      unlocked: true,
      title: "次の約束",
      description:
        "気軽に声をかけられる仲になりました。次の会話も、ゆっくり楽しみましょう。",
    };
  return {
    unlocked: true,
    title: "少しずつ、近づいて",
    description:
      "まだ知らないこともあります。気持ちを急がず、相手のことばを聞きながら関係を育てていきます。",
  };
}

export function createRomanceSessionId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function")
      return globalThis.crypto.randomUUID();
  } catch {
    // A browser may expose the function while refusing its use in this context.
  }
  fallbackSessionSequence = (fallbackSessionSequence + 1) % MAX_PLAYS;
  return `romance-${Date.now().toString(36)}-${fallbackSessionSequence.toString(36)}-${Math.random().toString(36).slice(2, 14) || "0"}`;
}

function parseState(raw: string): RomanceState | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isRomanceState(value) ? value : null;
  } catch {
    return null;
  }
}

export function loadRomanceProgress(
  storage?: Pick<Storage, "getItem">,
): RomanceLoadResult {
  const fallback = createEmptyRomance();
  try {
    const source =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!source)
      return {
        state: fallback,
        status: "unavailable",
        message:
          "この環境では物語の記録を保存できません。このタブでは続けられます。",
      };
    const raw = source.getItem(ROMANCE_STORAGE_KEY);
    if (raw === null) return { state: fallback, status: "empty" };
    const state = parseState(raw);
    return state
      ? { state, status: "loaded" }
      : {
          state: fallback,
          status: "invalid",
          message:
            "物語の保存データを読み取れません。元のデータを保護しています。",
        };
  } catch {
    return {
      state: fallback,
      status: "unavailable",
      message: "物語の記録を読み込めません。このタブでは続けられます。",
    };
  }
}

/** Only the explicit recovery action is allowed to overwrite unknown schemas. */
export function replaceRomanceProgress(
  state: RomanceState,
  storage?: Pick<Storage, "setItem">,
): boolean {
  if (!isRomanceState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    target.setItem(ROMANCE_STORAGE_KEY, JSON.stringify(copyState(state)));
    return true;
  } catch {
    return false;
  }
}

export function saveRomanceProgress(
  state: RomanceState,
  storage?: StorageAdapter,
): boolean {
  if (!isRomanceState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    const raw = target.getItem(ROMANCE_STORAGE_KEY);
    if (raw !== null && !parseState(raw)) return false;
    return replaceRomanceProgress(state, target);
  } catch {
    return false;
  }
}

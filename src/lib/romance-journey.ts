import {
  getRomanceCharacter,
  getRomanceEpisode,
  getRomanceQuestions,
  romanceWords,
} from "@/data/romance";
import { getJourneyChapter } from "@/data/romance-journey";
import {
  getStoryJourneyScene,
  getStoryJourneyRoute,
} from "@/data/romance-story";
import { isRomanceSetting, type RomanceSetting } from "@/lib/romance-setting";
import type { ConversationWord } from "@/lib/conversation-types";
import type {
  JourneyChapter,
  JourneyExpression,
  JourneyRoute,
  JourneyRouteId,
  JourneyScene,
  JourneySupport,
} from "@/lib/romance-journey-types";
import type {
  RomanceEpisodeId,
  RomanceGender,
  RomanceQuestion,
} from "@/lib/romance-types";

export const ROMANCE_LEARNING_STORAGE_KEY = "thai-learning.romance-learning.v1";
const MAX_SESSIONS = 1_000_000;
const RECENT_LIMIT = 100;

interface JourneyActivityBase {
  id: string;
  title: string;
  question: RomanceQuestion;
  sourceEpisodeId: RomanceEpisodeId;
}
export interface JourneyModelActivity extends JourneyActivityBase {
  kind: "model";
  models: RomanceQuestion[];
}
export interface JourneyBuildActivity extends JourneyActivityBase {
  kind: "build";
  bank: ConversationWord[];
  acceptedWordIds: string[][];
  support: "meaning";
}
export interface JourneyRespondActivity extends JourneyActivityBase {
  kind: "respond";
  purpose: "core" | "recall" | "repair";
  support: JourneySupport;
}
export type JourneyActivity =
  | JourneyModelActivity
  | JourneyBuildActivity
  | JourneyRespondActivity;
export type JourneyResponse =
  | { kind: "choice"; choiceId: string }
  | { kind: "build"; wordIds: string[] };
export type JourneyGradableActivity =
  | JourneyBuildActivity
  | JourneyRespondActivity;
export interface JourneyAttempt {
  activityId: string;
  response: JourneyResponse;
  usedHint: boolean;
}
export interface JourneyPlan {
  setting: RomanceSetting;
  characterId: string;
  episodeId: RomanceEpisodeId;
  routeId: JourneyRouteId;
  gender: RomanceGender;
  chapter: JourneyChapter;
  scene: JourneyScene;
  route: JourneyRoute;
  activities: JourneyActivity[];
}
export interface JourneyGrade {
  correct: boolean;
  explanation: string;
  choiceExplanation: string;
  correctChoiceIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function hasOnly(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function isInteger(
  value: unknown,
  min = 0,
  max = MAX_SESSIONS,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}
function isRoute(value: unknown): value is JourneyRouteId {
  return value === "listen" || value === "lead";
}
function isGender(value: unknown): value is RomanceGender {
  return value === "male" || value === "female";
}
function isSession(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(value)
  );
}
function isResponse(value: unknown): value is JourneyResponse {
  if (!isRecord(value)) return false;
  return value.kind === "choice"
    ? hasOnly(value, ["kind", "choiceId"]) && typeof value.choiceId === "string"
    : value.kind === "build" &&
        hasOnly(value, ["kind", "wordIds"]) &&
        Array.isArray(value.wordIds) &&
        value.wordIds.every((id) => typeof id === "string");
}
function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (
    !match ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    (match[7] !== undefined && (Number(match[7]) > 23 || Number(match[8]) > 59))
  )
    return false;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
  return (
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

/** Choice order changes, while the authored Thai and the causal turn order do not. */
function rotateQuestion(
  question: RomanceQuestion,
  offset: number,
): RomanceQuestion {
  const split = offset % question.choices.length;
  return {
    ...question,
    choices: [
      ...question.choices.slice(split),
      ...question.choices.slice(0, split),
    ],
  };
}

export function getJourneyPlan(
  characterId: string,
  episodeId: string,
  routeId: JourneyRouteId,
  gender: RomanceGender,
  setting: RomanceSetting = "city",
): JourneyPlan {
  const character = getRomanceCharacter(characterId);
  const chapter = getJourneyChapter(episodeId);
  if (!isRomanceSetting(setting))
    throw new Error("物語の舞台を確認してください。");
  const scene = getStoryJourneyScene(characterId, episodeId, setting);
  const route = getStoryJourneyRoute(characterId, episodeId, routeId, setting);
  if (
    !character ||
    !chapter ||
    !scene ||
    !route ||
    !isGender(gender) ||
    character.gender === gender
  )
    throw new Error("主人公と、物語のルートを確認してください。");
  const questions = getRomanceQuestions(characterId, episodeId);
  if (questions.length !== 3) throw new Error("会話の教材を確認できません。");
  const focus = questions[route.focusQuestionIndex];
  const acceptedWordIds = focus.choices
    .filter((choice) => focus.answerIds.includes(choice.id))
    .map((choice) => [...choice.phrase.wordIds]);
  const bankIds = [...new Set(acceptedWordIds.flat())];
  // One authored distractor word makes construction meaningful without inventing tokens.
  const distractor = focus.choices
    .filter((choice) => !focus.answerIds.includes(choice.id))
    .flatMap((choice) => choice.phrase.wordIds)
    .find((id) => !bankIds.includes(id));
  if (distractor) bankIds.push(distractor);
  bankIds.reverse();
  const bank = bankIds.map((id) => {
    const word = romanceWords.find((entry) => entry.id === id);
    if (!word) throw new Error("組み立てることばを確認できません。");
    return word;
  });
  const model: JourneyModelActivity = {
    id: `${episodeId}:model`,
    kind: "model",
    title: "今回のことばを見つける",
    sourceEpisodeId: chapter.episodeId,
    question: focus,
    models: questions,
  };
  const build: JourneyBuildActivity = {
    id: `${episodeId}:build`,
    kind: "build",
    title: "ことばを組み立てる",
    sourceEpisodeId: chapter.episodeId,
    question: focus,
    bank,
    acceptedWordIds,
    support: "meaning",
  };
  const core: JourneyRespondActivity[] = questions.map((question, index) => ({
    id: `${episodeId}:core:${question.id}`,
    kind: "respond",
    purpose: "core",
    title: `会話をつなぐ ${index + 1} / 3`,
    sourceEpisodeId: chapter.episodeId,
    question: rotateQuestion(
      question,
      chapter.level + index + (routeId === "lead" ? 1 : 0),
    ),
    support: chapter.defaultSupport,
  }));
  const previousEpisodeId = chapter.recallEpisodeIds.at(-1);
  const previous = previousEpisodeId
    ? getRomanceQuestions(characterId, previousEpisodeId)
    : [];
  const recallQuestion =
    previous[route.focusQuestionIndex % Math.max(1, previous.length)];
  const recall: JourneyRespondActivity | undefined =
    previousEpisodeId && recallQuestion
      ? {
          id: `${episodeId}:recall:${previousEpisodeId}:${recallQuestion.id}`,
          kind: "respond",
          purpose: "recall",
          title: "前の出会いを思い出す",
          sourceEpisodeId: previousEpisodeId,
          question: rotateQuestion(recallQuestion, chapter.level),
          support: "recall",
        }
      : undefined;
  const activities: JourneyActivity[] =
    route.drillOrder === "recall-first" && recall
      ? [model, recall, build, ...core]
      : [model, build, ...core, ...(recall ? [recall] : [])];
  return {
    setting,
    characterId,
    episodeId: chapter.episodeId,
    routeId,
    gender,
    chapter,
    scene,
    route,
    activities,
  };
}

export function gradeJourneyActivity(
  activity: JourneyActivity,
  response: JourneyResponse,
): JourneyGrade {
  if (activity.kind === "model")
    throw new Error("お手本のカードは採点しません。");
  const correctChoiceIds = [...activity.question.answerIds];
  if (activity.kind === "build") {
    if (
      !isRecord(response) ||
      response.kind !== "build" ||
      !Array.isArray(response.wordIds) ||
      response.wordIds.some(
        (id) =>
          typeof id !== "string" ||
          !activity.bank.some((word) => word.id === id),
      )
    )
      throw new Error("組み立てたことばを確認してください。");
    const correct = activity.acceptedWordIds.some(
      (ids) =>
        ids.length === response.wordIds.length &&
        ids.every((id, index) => id === response.wordIds[index]),
    );
    return {
      correct,
      explanation: activity.question.explanation,
      correctChoiceIds,
      choiceExplanation: correct
        ? "登録したことばの順番と丁寧な返答例に合っています。"
        : "語順や、余分なことばがないか確かめましょう。丁寧詞はどちらの登録例も使えます。",
    };
  }
  if (
    !isRecord(response) ||
    response.kind !== "choice" ||
    typeof response.choiceId !== "string"
  )
    throw new Error("選んだ返答を確認してください。");
  const choice = activity.question.choices.find(
    (entry) => entry.id === response.choiceId,
  );
  if (!choice) throw new Error("この場面の返答を確認できません。");
  return {
    correct: correctChoiceIds.includes(choice.id),
    explanation: activity.question.explanation,
    choiceExplanation: choice.explanation,
    correctChoiceIds,
  };
}

function validateAttempts(
  plan: JourneyPlan,
  attempts: readonly JourneyAttempt[],
) {
  const graded = plan.activities.filter(
    (activity) => activity.kind !== "model",
  );
  if (!Array.isArray(attempts) || attempts.length !== graded.length)
    throw new Error("すべての練習を確認してから記録してください。");
  const seen = new Set<string>();
  const results = attempts.map((attempt) => {
    if (
      !isRecord(attempt) ||
      typeof attempt.activityId !== "string" ||
      typeof attempt.usedHint !== "boolean" ||
      !isResponse(attempt.response) ||
      seen.has(attempt.activityId)
    )
      throw new Error("練習の記録が重複しているか、確認できません。");
    const activity = graded.find((entry) => entry.id === attempt.activityId);
    if (!activity) throw new Error("今回の練習にない記録が含まれています。");
    seen.add(attempt.activityId);
    return {
      attempt: {
        activityId: attempt.activityId,
        response: attempt.response,
        usedHint: attempt.usedHint,
      },
      activity,
      grade: gradeJourneyActivity(activity, attempt.response),
    };
  });
  if (graded.some((activity) => !seen.has(activity.id)))
    throw new Error("すべての練習を確認してください。");
  return results;
}

export function getJourneyCoreAnswers(
  plan: JourneyPlan,
  attempts: readonly JourneyAttempt[],
) {
  const checked = validateAttempts(plan, attempts);
  return plan.activities.flatMap((activity) => {
    if (activity.kind !== "respond" || activity.purpose !== "core") return [];
    const response = checked.find((entry) => entry.activity.id === activity.id)
      ?.attempt.response;
    if (!response || response.kind !== "choice")
      throw new Error("会話の返答を確認してください。");
    return [{ stepId: activity.question.id, choiceId: response.choiceId }];
  });
}

/** At most one later repair per missed first answer. Never counted as first-answer progress. */
export function getJourneyRecoveryActivities(
  plan: JourneyPlan,
  attempts: readonly JourneyAttempt[],
): JourneyGradableActivity[] {
  return validateAttempts(plan, attempts)
    .filter((entry) => !entry.grade.correct)
    .map(({ activity }) => {
      if (activity.kind === "build")
        return {
          ...activity,
          id: `repair:${activity.id}`,
          title: "もう一度、組み立ててみる",
        };
      return {
        ...activity,
        id: `repair:${activity.id}`,
        purpose: "repair",
        support: "model",
        title: "伝え方をもう一度確かめる",
      };
    });
}

export interface JourneyLearningSummary {
  correct: number;
  total: number;
  coreCorrect: number;
  coreTotal: number;
  buildCorrect: number;
  buildTotal: number;
  recallCorrect: number;
  recallTotal: number;
  hints: number;
  withoutHintCorrect: number;
}
export interface JourneyLearningEpisode {
  firstCompletedAt: string;
  lastCompletedAt: string;
  plays: number;
  routes: JourneyRouteId[];
  last: JourneyLearningSummary;
  lastStory?: { routeId: JourneyRouteId; choiceId: string };
}
export interface RomanceLearningState {
  version: 1;
  characters: Record<
    string,
    { episodes: Record<string, JourneyLearningEpisode> }
  >;
  recentSessionIds: string[];
}
export interface JourneyLearningInput {
  setting?: RomanceSetting;
  characterId: string;
  episodeId: string;
  routeId: JourneyRouteId;
  gender: RomanceGender;
  sessionId: string;
  attempts: readonly JourneyAttempt[];
  storyChoiceId?: string;
  now?: string;
}
export interface JourneyLearningReceipt {
  applied: boolean;
  summary: JourneyLearningSummary;
  newKeepsake: boolean;
}
export type RomanceLearningStatus =
  | "empty"
  | "loaded"
  | "invalid"
  | "unavailable";
export interface RomanceLearningLoadResult {
  state: RomanceLearningState;
  status: RomanceLearningStatus;
  message?: string;
}

export function createEmptyRomanceLearning(): RomanceLearningState {
  return { version: 1, characters: {}, recentSessionIds: [] };
}
export function getJourneyLearningProgress(
  state: RomanceLearningState,
  characterId: string,
  episodeId: string,
): JourneyLearningEpisode | undefined {
  return Object.hasOwn(state.characters, characterId) &&
    Object.hasOwn(state.characters[characterId].episodes, episodeId)
    ? state.characters[characterId].episodes[episodeId]
    : undefined;
}
export function getJourneyKeepsakes(
  state: RomanceLearningState,
  characterId: string,
  setting: RomanceSetting = "city",
) {
  const episodes = Object.hasOwn(state.characters, characterId)
    ? state.characters[characterId].episodes
    : {};
  return Object.entries(episodes).flatMap(([episodeId, progress]) =>
    progress.routes.flatMap((routeId) => {
      const route = getStoryJourneyRoute(
        characterId,
        episodeId,
        routeId,
        setting,
      );
      return route ? [{ episodeId, routeId, ...route.keepsake }] : [];
    }),
  );
}

/** Saved identifiers resolve to the current authored story, never stored prose. */
export interface JourneyStoryMemory {
  episodeId: RomanceEpisodeId;
  routeId: JourneyRouteId;
  label: string;
  reaction: string;
  nextHook: string;
  expression: JourneyExpression;
}

export function getJourneyStoryChoice(
  state: RomanceLearningState,
  characterId: string,
  episodeId: string,
  setting: RomanceSetting = "city",
): JourneyStoryMemory | undefined {
  const episode = getRomanceEpisode(episodeId);
  if (!episode) return undefined;
  const remembered = getJourneyLearningProgress(
    state,
    characterId,
    episode.id,
  )?.lastStory;
  if (!remembered) return undefined;
  const route = getStoryJourneyRoute(
    characterId,
    episodeId,
    remembered.routeId,
    setting,
  );
  const choice = route?.wrapChoices.find(
    (entry) => entry.storyChoiceId === remembered.choiceId,
  );
  if (!route || !choice) return undefined;
  return {
    episodeId: episode.id,
    routeId: remembered.routeId,
    label: choice.label,
    reaction: choice.reaction,
    nextHook: choice.nextHook ?? route.nextHook,
    expression: choice.expression,
  };
}

export function getJourneyStoryEcho(
  state: RomanceLearningState,
  characterId: string,
  currentEpisodeId: string,
  setting: RomanceSetting = "city",
): JourneyStoryMemory | undefined {
  const previous = getRomanceEpisode(currentEpisodeId)?.previousEpisodeId;
  return previous
    ? getJourneyStoryChoice(state, characterId, previous, setting)
    : undefined;
}

export function getJourneyStoryEnding(
  state: RomanceLearningState,
  characterId: string,
  setting: RomanceSetting = "city",
): JourneyStoryMemory | undefined {
  return getJourneyStoryChoice(state, characterId, "walk", setting);
}

function validSummary(
  value: unknown,
  chapter: JourneyChapter,
): value is JourneyLearningSummary {
  if (
    !isRecord(value) ||
    !hasOnly(value, [
      "correct",
      "total",
      "coreCorrect",
      "coreTotal",
      "buildCorrect",
      "buildTotal",
      "recallCorrect",
      "recallTotal",
      "hints",
      "withoutHintCorrect",
    ])
  )
    return false;
  const recallTotal = chapter.recallEpisodeIds.length ? 1 : 0;
  const total = 4 + recallTotal;
  const maxWithoutHint = total - (chapter.defaultSupport === "model" ? 3 : 0);
  return (
    value.total === total &&
    value.coreTotal === 3 &&
    value.buildTotal === 1 &&
    value.recallTotal === recallTotal &&
    isInteger(value.coreCorrect, 0, 3) &&
    isInteger(value.buildCorrect, 0, 1) &&
    isInteger(value.recallCorrect, 0, recallTotal) &&
    isInteger(value.correct, 0, total) &&
    value.correct ===
      value.coreCorrect + value.buildCorrect + value.recallCorrect &&
    isInteger(value.hints, 0, total) &&
    isInteger(value.withoutHintCorrect, 0, value.correct) &&
    value.withoutHintCorrect <= total - value.hints &&
    value.withoutHintCorrect <= maxWithoutHint
  );
}
export function isRomanceLearningState(
  value: unknown,
): value is RomanceLearningState {
  if (
    !isRecord(value) ||
    !hasOnly(value, ["version", "characters", "recentSessionIds"]) ||
    value.version !== 1 ||
    !isRecord(value.characters) ||
    !Array.isArray(value.recentSessionIds) ||
    value.recentSessionIds.length > RECENT_LIMIT ||
    !value.recentSessionIds.every(isSession) ||
    new Set(value.recentSessionIds).size !== value.recentSessionIds.length
  )
    return false;
  return Object.entries(value.characters).every(
    ([characterId, characterProgress]) => {
      const character = getRomanceCharacter(characterId);
      if (
        !character ||
        !isRecord(characterProgress) ||
        !hasOnly(characterProgress, ["episodes"]) ||
        !isRecord(characterProgress.episodes)
      )
        return false;
      return Object.entries(characterProgress.episodes).every(
        ([episodeId, progress]) => {
          const chapter = getJourneyChapter(episodeId);
          if (
            !chapter ||
            !isRecord(progress) ||
            !hasOnly(progress, [
              "firstCompletedAt",
              "lastCompletedAt",
              "plays",
              "routes",
              "last",
              "lastStory",
            ]) ||
            !isTimestamp(progress.firstCompletedAt) ||
            !isTimestamp(progress.lastCompletedAt) ||
            Date.parse(progress.lastCompletedAt) <
              Date.parse(progress.firstCompletedAt) ||
            !isInteger(progress.plays, 1) ||
            !Array.isArray(progress.routes) ||
            progress.routes.length < 1 ||
            progress.routes.length > 2 ||
            !progress.routes.every(isRoute) ||
            new Set(progress.routes).size !== progress.routes.length ||
            progress.routes.length > progress.plays
          )
            return false;
          if (progress.lastStory !== undefined) {
            const remembered = progress.lastStory;
            if (
              !isRecord(remembered) ||
              !hasOnly(remembered, ["routeId", "choiceId"]) ||
              !isRoute(remembered.routeId) ||
              !progress.routes.includes(remembered.routeId) ||
              typeof remembered.choiceId !== "string" ||
              !getStoryJourneyRoute(
                characterId,
                episodeId,
                remembered.routeId,
              )?.wrapChoices.some(
                (choice) => choice.storyChoiceId === remembered.choiceId,
              )
            )
              return false;
          }
          return (
            progress.routes.every((routeId) =>
              Boolean(getStoryJourneyRoute(characterId, episodeId, routeId)),
            ) && validSummary(progress.last, chapter)
          );
        },
      );
    },
  );
}

export function completeRomanceLearning(
  state: RomanceLearningState,
  input: JourneyLearningInput,
): { state: RomanceLearningState; receipt: JourneyLearningReceipt } {
  if (
    !isRomanceLearningState(state) ||
    !isRecord(input) ||
    !isSession(input.sessionId) ||
    !isRoute(input.routeId) ||
    !isGender(input.gender) ||
    (input.setting !== undefined && !isRomanceSetting(input.setting)) ||
    typeof input.characterId !== "string" ||
    typeof input.episodeId !== "string"
  )
    throw new Error("会話練習の記録を確認してください。");
  const plan = getJourneyPlan(
    input.characterId,
    input.episodeId,
    input.routeId,
    input.gender,
    input.setting ?? "city",
  );
  const checked = validateAttempts(plan, input.attempts);
  if (
    input.storyChoiceId !== undefined &&
    (typeof input.storyChoiceId !== "string" ||
      !plan.route.wrapChoices.some(
        (choice) => choice.storyChoiceId === input.storyChoiceId,
      ))
  )
    throw new Error("この物語の選択を確認してください。");
  const now = input.now ?? new Date().toISOString();
  if (!isTimestamp(now)) throw new Error("会話練習の日時を確認してください。");
  const correct = checked.filter((entry) => entry.grade.correct);
  const summary: JourneyLearningSummary = {
    correct: correct.length,
    total: checked.length,
    coreCorrect: correct.filter(
      (entry) =>
        entry.activity.kind === "respond" && entry.activity.purpose === "core",
    ).length,
    coreTotal: 3,
    buildCorrect: correct.filter((entry) => entry.activity.kind === "build")
      .length,
    buildTotal: 1,
    recallCorrect: correct.filter(
      (entry) =>
        entry.activity.kind === "respond" &&
        entry.activity.purpose === "recall",
    ).length,
    recallTotal: checked.filter(
      (entry) =>
        entry.activity.kind === "respond" &&
        entry.activity.purpose === "recall",
    ).length,
    hints: checked.filter((entry) => entry.attempt.usedHint).length,
    withoutHintCorrect: correct.filter(
      (entry) =>
        !entry.attempt.usedHint &&
        !(
          entry.activity.kind === "respond" &&
          entry.activity.support === "model"
        ),
    ).length,
  };
  const receipt: JourneyLearningReceipt = {
    applied: false,
    summary,
    newKeepsake: false,
  };
  if (state.recentSessionIds.includes(input.sessionId))
    return { state, receipt };
  const previous = getJourneyLearningProgress(
    state,
    input.characterId,
    input.episodeId,
  );
  const routes = previous ? [...previous.routes] : [];
  const previousIsNewer =
    previous !== undefined &&
    Date.parse(previous.lastCompletedAt) > Date.parse(now);
  receipt.newKeepsake = !routes.includes(input.routeId);
  if (receipt.newKeepsake) routes.push(input.routeId);
  const next: RomanceLearningState = {
    version: 1,
    characters: {
      ...state.characters,
      [input.characterId]: {
        episodes: {
          ...(state.characters[input.characterId]?.episodes ?? {}),
          [input.episodeId]: {
            firstCompletedAt: previous?.firstCompletedAt ?? now,
            lastCompletedAt: previousIsNewer ? previous.lastCompletedAt : now,
            plays: Math.min(MAX_SESSIONS, (previous?.plays ?? 0) + 1),
            routes,
            last: summary,
            ...(input.storyChoiceId !== undefined && !previousIsNewer
              ? {
                  lastStory: {
                    routeId: input.routeId,
                    choiceId: input.storyChoiceId,
                  },
                }
              : previous?.lastStory
                ? { lastStory: { ...previous.lastStory } }
                : {}),
          },
        },
      },
    },
    recentSessionIds: [...state.recentSessionIds, input.sessionId].slice(
      -RECENT_LIMIT,
    ),
  };
  if (!isRomanceLearningState(next))
    throw new Error("会話練習の記録を確認できませんでした。");
  receipt.applied = true;
  return { state: next, receipt };
}

function parse(raw: string): RomanceLearningState | null {
  try {
    const value: unknown = JSON.parse(raw);
    return isRomanceLearningState(value) ? value : null;
  } catch {
    return null;
  }
}
export function loadRomanceLearning(
  storage?: Pick<Storage, "getItem">,
): RomanceLearningLoadResult {
  const fallback = createEmptyRomanceLearning();
  try {
    const source =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!source)
      return {
        state: fallback,
        status: "unavailable",
        message:
          "この環境では会話練習の記録を保存できません。このタブでは続けられます。",
      };
    const raw = source.getItem(ROMANCE_LEARNING_STORAGE_KEY);
    if (raw === null) return { state: fallback, status: "empty" };
    const state = parse(raw);
    return state
      ? { state, status: "loaded" }
      : {
          state: fallback,
          status: "invalid",
          message:
            "会話練習の保存記録を読み取れません。元のデータを保護しています。",
        };
  } catch {
    return {
      state: fallback,
      status: "unavailable",
      message: "会話練習の記録を読み込めません。このタブでは続けられます。",
    };
  }
}
export function replaceRomanceLearning(
  state: RomanceLearningState,
  storage?: Pick<Storage, "setItem">,
): boolean {
  if (!isRomanceLearningState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    target.setItem(ROMANCE_LEARNING_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function saveRomanceLearning(
  state: RomanceLearningState,
  storage?: Pick<Storage, "getItem" | "setItem">,
): boolean {
  if (!isRomanceLearningState(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    const raw = target.getItem(ROMANCE_LEARNING_STORAGE_KEY);
    if (raw !== null && !parse(raw)) return false;
    return replaceRomanceLearning(state, target);
  } catch {
    return false;
  }
}

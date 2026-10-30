import { conversationScenarios } from "@/data/conversations";

export const CONVERSATION_STORAGE_KEY = "thai-learning.conversation.v1";
const MAX_COMPLETIONS = 1_000_000;
const MAX_RECENT_SESSIONS = 100;
const scenariosById = new Map(
  conversationScenarios.map((scenario) => [scenario.id, scenario]),
);

export interface ConversationGrade {
  correct: boolean;
  explanation: string;
  choiceExplanation: string;
  correctChoiceIds: string[];
}

export interface ConversationAnswer {
  stepId: string;
  choiceId: string;
}

export interface ConversationCompletionInput {
  scenarioId: string;
  sessionId: string;
  answers: readonly ConversationAnswer[];
  completedAt: string;
}

/** Counts completed guided practice, never pronunciation or language proficiency. */
export interface ConversationScenarioProgress {
  completedSessions: number;
  lastCompletedAt: string;
}

export interface ConversationProgress {
  version: 1;
  scenarios: Record<string, ConversationScenarioProgress>;
  recentSessionIds: string[];
}

export interface ConversationLoadResult {
  state: ConversationProgress;
  status: "empty" | "loaded" | "invalid" | "unavailable";
  message?: string;
}

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function createEmptyConversationProgress(): ConversationProgress {
  return { version: 1, scenarios: {}, recentSessionIds: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
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

function isCompletionCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_COMPLETIONS
  );
}

/** Unknown fields/versions are protected instead of silently migrating them. */
export function isConversationProgress(
  value: unknown,
): value is ConversationProgress {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["version", "scenarios", "recentSessionIds"]) ||
    value.version !== 1 ||
    !isRecord(value.scenarios) ||
    !Array.isArray(value.recentSessionIds) ||
    !Array.from(value.recentSessionIds).every(isSessionId) ||
    new Set(value.recentSessionIds).size !== value.recentSessionIds.length
  )
    return false;

  let total = 0;
  for (const [id, record] of Object.entries(value.scenarios)) {
    if (
      !scenariosById.has(id) ||
      !isRecord(record) ||
      !hasOnlyKeys(record, ["completedSessions", "lastCompletedAt"]) ||
      !isCompletionCount(record.completedSessions) ||
      !isTimestamp(record.lastCompletedAt)
    )
      return false;
    total += record.completedSessions;
    if (total > MAX_COMPLETIONS) return false;
  }
  return value.recentSessionIds.length === Math.min(total, MAX_RECENT_SESSIONS);
}

function copyProgress(state: ConversationProgress): ConversationProgress {
  return {
    version: 1,
    scenarios: Object.fromEntries(
      Object.entries(state.scenarios).map(([id, record]) => [
        id,
        {
          completedSessions: record.completedSessions,
          lastCompletedAt: record.lastCompletedAt,
        },
      ]),
    ),
    recentSessionIds: [...state.recentSessionIds],
  };
}

/** Prepare a reproducible order on explicit start; never shuffle source data. */
export function createConversationChoiceOrder(
  scenarioId: string,
  seed: number,
): Record<string, string[]> {
  const scenario = scenariosById.get(scenarioId);
  if (!scenario || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("会話の場面と有効な出題番号が必要です。");
  let randomState = seed || 0x9e3779b9;
  return Object.fromEntries(
    scenario.steps.map((step) => {
      const ids = step.choices.map((choice) => choice.id);
      for (let index = ids.length - 1; index > 0; index--) {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        const target = Math.floor(
          ((randomState >>> 0) / 0x100000000) * (index + 1),
        );
        [ids[index], ids[target]] = [ids[target], ids[index]];
      }
      return [step.id, ids];
    }),
  );
}

/** Grades this scene's stated goal; both registered polite variants are valid. */
export function gradeConversationChoice(
  scenarioId: string,
  stepId: string,
  choiceId: string,
): ConversationGrade {
  const scenario = scenariosById.get(scenarioId);
  const step = scenario?.steps.find((item) => item.id === stepId);
  const choice = step?.choices.find((item) => item.id === choiceId);
  if (!scenario || !step || !choice)
    throw new Error("会話の場面・順番・選択肢を確認できません。");
  return {
    correct: step.answerIds.includes(choice.id),
    explanation: step.explanation,
    choiceExplanation: choice.explanation,
    correctChoiceIds: [...step.answerIds],
  };
}

/** Save only after every source step has eventually reached an accepted reply. */
export function recordConversationCompletion(
  state: ConversationProgress,
  completion: ConversationCompletionInput,
): ConversationProgress {
  if (!isConversationProgress(state))
    throw new Error("会話練習の記録を読み取れません。");
  if (
    !isRecord(completion) ||
    !isSessionId(completion.sessionId) ||
    !isTimestamp(completion.completedAt) ||
    typeof completion.scenarioId !== "string" ||
    !Array.isArray(completion.answers)
  )
    throw new Error("会話練習の完了記録を確認できません。");

  const scenario = scenariosById.get(completion.scenarioId);
  if (
    !scenario ||
    completion.answers.length !== scenario.steps.length ||
    !scenario.steps.every((step, index) => {
      const answer: unknown = completion.answers[index];
      return (
        isRecord(answer) &&
        answer.stepId === step.id &&
        typeof answer.choiceId === "string" &&
        step.choices.some((choice) => choice.id === answer.choiceId) &&
        step.answerIds.includes(answer.choiceId)
      );
    })
  )
    throw new Error("すべての場面で、ねらいに合う返答を確認してください。");

  if (state.recentSessionIds.includes(completion.sessionId)) return state;
  const total = Object.values(state.scenarios).reduce(
    (count, record) => count + record.completedSessions,
    0,
  );
  if (total >= MAX_COMPLETIONS)
    throw new Error("会話練習の記録件数が保存できる上限に達しました。");

  const next = copyProgress(state);
  const previous = state.scenarios[scenario.id];
  const latest =
    previous &&
    new Date(previous.lastCompletedAt).getTime() >
      new Date(completion.completedAt).getTime()
      ? previous.lastCompletedAt
      : completion.completedAt;
  next.scenarios[scenario.id] = {
    completedSessions: (previous?.completedSessions ?? 0) + 1,
    lastCompletedAt: latest,
  };
  next.recentSessionIds = [
    ...state.recentSessionIds,
    completion.sessionId,
  ].slice(-MAX_RECENT_SESSIONS);
  return next;
}

function parseProgress(raw: string): ConversationProgress | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isConversationProgress(parsed) ? copyProgress(parsed) : undefined;
  } catch {
    return undefined;
  }
}

/** Mount/read never writes defaults or repairs the original stored value. */
export function loadConversationProgress(
  storage?: Pick<Storage, "getItem">,
): ConversationLoadResult {
  const fallback = createEmptyConversationProgress();
  try {
    const source =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!source)
      return {
        state: fallback,
        status: "unavailable",
        message:
          "会話練習の保存機能を利用できません。このタブでは続けられます。",
      };
    const raw = source.getItem(CONVERSATION_STORAGE_KEY);
    if (raw === null) return { state: fallback, status: "empty" };
    const state = parseProgress(raw);
    return state
      ? { state, status: "loaded" }
      : {
          state: fallback,
          status: "invalid",
          message:
            "会話練習の保存データを読み取れません。元データを保護し、このタブだけで練習します。",
        };
  } catch {
    return {
      state: fallback,
      status: "unavailable",
      message: "会話練習の保存機能を利用できません。このタブでは続けられます。",
    };
  }
}

/** Overwrite only after an explicit recovery action in the UI. */
export function replaceConversationProgress(
  state: ConversationProgress,
  storage?: Pick<Storage, "setItem">,
): boolean {
  if (!isConversationProgress(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    target.setItem(
      CONVERSATION_STORAGE_KEY,
      JSON.stringify(copyProgress(state)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Preserve corrupt/unknown saved data; only the conversation key is touched. */
export function saveConversationProgress(
  state: ConversationProgress,
  storage?: StorageAdapter,
): boolean {
  if (!isConversationProgress(state)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    const raw = target.getItem(CONVERSATION_STORAGE_KEY);
    if (raw !== null && !parseProgress(raw)) return false;
    return replaceConversationProgress(state, target);
  } catch {
    return false;
  }
}

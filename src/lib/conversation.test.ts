import { describe, expect, it, vi } from "vitest";
import {
  conversationScenarios,
  conversationSources,
  conversationWords,
} from "@/data/conversations";
import { courseLessons, courseSources } from "@/data/course";
import { vocabularyEntries } from "@/data/language";
import type { ConversationPhrase } from "@/lib/conversation-types";
import {
  CONVERSATION_STORAGE_KEY,
  createConversationChoiceOrder,
  createEmptyConversationProgress,
  gradeConversationChoice,
  isConversationProgress,
  loadConversationProgress,
  recordConversationCompletion,
  replaceConversationProgress,
  saveConversationProgress,
  type ConversationCompletionInput,
  type ConversationProgress,
} from "./conversation";

const now = "2026-10-27T10:00:00.000Z";
const later = "2026-10-27T11:00:00.000Z";
const first = conversationScenarios[0];

function completion(
  sessionId = "conversation-1",
  scenario = first,
  completedAt = now,
): ConversationCompletionInput {
  return {
    scenarioId: scenario.id,
    sessionId,
    answers: scenario.steps.map((step) => ({
      stepId: step.id,
      choiceId: step.answerIds[0],
    })),
    completedAt,
  };
}

function finished() {
  return recordConversationCompletion(
    createEmptyConversationProgress(),
    completion(),
  );
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>([
    ["thai-learning.progress.v1", "original-lesson-record"],
    ["thai-learning.review.v1", "original-review-record"],
    ["thai-learning.character-training.v1", "original-letter-record"],
  ]);
  if (initial !== undefined) values.set(CONVERSATION_STORAGE_KEY, initial);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("guided conversation source integrity", () => {
  it("keeps four small scenes separate from the thirty existing course lessons", () => {
    expect(conversationScenarios.map((scenario) => scenario.id)).toEqual([
      "greeting-origin",
      "cafe-water",
      "shopping-price",
      "restroom-directions",
    ]);
    expect(courseLessons).toHaveLength(30);
    expect(
      courseLessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0),
    ).toBe(150);
    expect(courseLessons.reduce((sum, lesson) => sum + lesson.xp, 0)).toBe(
      1210,
    );
    const sourceIds = new Set([
      ...courseSources.map((source) => source.id),
      ...conversationSources.map((source) => source.id),
    ]);
    const lessonIds = new Set(courseLessons.map((lesson) => lesson.id));
    const stepIds = new Set<string>();
    for (const scenario of conversationScenarios) {
      expect(scenario.verification).toBe("unreviewed");
      expect(scenario.steps).toHaveLength(3);
      expect(scenario.title).not.toBe("");
      expect(scenario.objective).not.toBe("");
      expect(scenario.sourceIds.length).toBeGreaterThan(0);
      expect(scenario.relatedLessonIds.length).toBeGreaterThan(0);
      expect(scenario.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      expect(scenario.relatedLessonIds.every((id) => lessonIds.has(id))).toBe(
        true,
      );
      for (const step of scenario.steps) {
        expect(stepIds.has(step.id)).toBe(false);
        stepIds.add(step.id);
        expect(step.goal).not.toBe("");
        expect(step.explanation).not.toBe("");
        const ids = step.choices.map((choice) => choice.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThanOrEqual(2);
        expect(step.answerIds.length).toBeGreaterThan(0);
        expect(new Set(step.answerIds).size).toBe(step.answerIds.length);
        expect(step.answerIds.every((id) => ids.includes(id))).toBe(true);
        expect(step.answerIds.length).toBeLessThan(ids.length);
        for (const choice of step.choices)
          expect(choice.explanation).not.toBe("");
      }
    }
  });

  it("keeps Thai strings and explicit lexical hints without inventing phrase IPA", () => {
    const words = new Map(conversationWords.map((word) => [word.id, word]));
    const sourceIds = new Set([
      ...courseSources.map((source) => source.id),
      ...conversationSources.map((source) => source.id),
    ]);
    expect(words.size).toBe(conversationWords.length);
    for (const word of conversationWords) {
      expect(word.thai).toMatch(/[\u0e01-\u0e2e]/u);
      expect(word.ipa).toMatch(/^\/.+\/$/u);
      expect(word.verification).toBe("unreviewed");
      expect(word.sourceIds.length).toBeGreaterThan(0);
      expect(word.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      const existing = vocabularyEntries.find((item) => item.id === word.id);
      if (existing) {
        expect(word.thai).toBe(existing.thai);
        expect(word.ipa).toBe(existing.ipa);
      }
    }
    function checkPhrase(phrase: ConversationPhrase) {
      expect(phrase.meaning).not.toBe("");
      expect(phrase.wordIds.length).toBeGreaterThan(0);
      expect(phrase.wordIds.every((id) => words.has(id))).toBe(true);
      expect(phrase.wordIds.map((id) => words.get(id)?.thai).join("")).toBe(
        phrase.thai,
      );
      expect(Object.hasOwn(phrase, "ipa")).toBe(false);
      expect(
        Object.keys(phrase).every((key) =>
          ["thai", "meaning", "wordIds", "note"].includes(key),
        ),
      ).toBe(true);
    }
    for (const scenario of conversationScenarios)
      for (const step of scenario.steps) {
        checkPhrase(step.npc);
        for (const choice of step.choices) checkPhrase(choice.phrase);
      }
  });

  it("retains the explicitly checked lexical IPA variants from the fixed dictionary", () => {
    // These lexical values were read from the same fixed Wiktionary TSV, not
    // inferred from a conversation sentence. Source/license details live in docs.
    const checked = new Map<string, readonly string[]>([
      ["ขวา", ["/kʰwaː˩˩˦/"]],
      ["กาแฟ", ["/kaː˧.fɛː˧/"]],
      ["ขอบคุณ", ["/kʰɔːp̚˨˩.kʰun˧/"]],
      ["จาก", ["/tɕaːk̚˨˩/"]],
      ["ซ้าย", ["/saːj˦˥/"]],
      ["ญี่ปุ่น", ["/jiː˥˩.pun˨˩/"]],
      ["ทาง", ["/tʰaːŋ˧/"]],
      ["ที่ไหน", ["/tʰiː˥˩.naj˩˩˦/"]],
      ["บาท", ["/baːt̚˨˩/"]],
      ["ยี่สิบ", ["/jiː˥˩.sip̚˨˩/"]],
      ["ราคา", ["/raː˧.kʰaː˧/"]],
      ["รับ", ["/rap̚˦˥/"]],
      ["สวัสดี", ["/sa˨˩.wat̚˨˩.diː˧/", "/sa˧.wat̚˨˩.diː˧/"]],
      ["ห้องน้ำ", ["/hɔŋ˥˩.naːm˦˥/"]],
      ["เท่าไร", ["/tʰaw˥˩.raj˧/"]],
      ["เอา", ["/ʔaw˧/"]],
      ["ใช่", ["/tɕʰaj˥˩/"]],
      ["ได้", ["/daːj˥˩/"]],
      ["ไม่เป็นไร", ["/maj˥˩.pen˧.raj˧/"]],
      ["ไหน", ["/naj˩˩˦/"]],
    ]);
    const additions = conversationWords.filter((word) =>
      word.sourceIds.includes("wiktionary-ipa-phase5"),
    );
    expect(additions).toHaveLength(20);
    for (const word of additions)
      expect(checked.get(word.thai)).toContain(word.ipa);
  });
});

describe("guided conversation grading and completion", () => {
  it("shuffles complete choice lists deterministically for each scene without mutating content", () => {
    for (const scenario of conversationScenarios) {
      const before = JSON.stringify(scenario);
      const seen = new Map(
        scenario.steps.map((step) => [step.id, new Set<string>()]),
      );
      for (let seed = 0; seed < 64; seed += 1) {
        const order = createConversationChoiceOrder(scenario.id, seed);
        expect(order).toEqual(createConversationChoiceOrder(scenario.id, seed));
        expect(Object.keys(order)).toEqual(
          scenario.steps.map((step) => step.id),
        );
        for (const step of scenario.steps) {
          expect(new Set(order[step.id])).toEqual(
            new Set(step.choices.map((choice) => choice.id)),
          );
          expect(order[step.id]).toHaveLength(step.choices.length);
          expect(
            step.answerIds.every((id) => order[step.id].includes(id)),
          ).toBe(true);
          seen.get(step.id)?.add(order[step.id].join(","));
        }
      }
      for (const variations of seen.values())
        expect(variations.size).toBeGreaterThan(1);
      expect(JSON.stringify(scenario)).toBe(before);
      const output = createConversationChoiceOrder(scenario.id, 123);
      output[scenario.steps[0].id].reverse();
      expect(JSON.stringify(scenario)).toBe(before);
    }
  });

  it("rejects an unknown scene or invalid shuffle seed", () => {
    expect(() => createConversationChoiceOrder("unknown", 1)).toThrow();
    for (const seed of [-1, 0.5, Infinity, NaN, 0x100000000])
      expect(() => createConversationChoiceOrder(first.id, seed)).toThrow();
    for (const seed of [0, 0xffffffff])
      expect(
        Object.keys(createConversationChoiceOrder(first.id, seed)),
      ).toHaveLength(first.steps.length);
  });

  it.each(conversationScenarios)(
    "grades every registered choice and accepted variant in $id",
    (scenario) => {
      const before = JSON.stringify(scenario);
      for (const step of scenario.steps) {
        for (const choice of step.choices) {
          const result = gradeConversationChoice(
            scenario.id,
            step.id,
            choice.id,
          );
          expect(result.correct).toBe(step.answerIds.includes(choice.id));
          expect(result.explanation).toBe(step.explanation);
          expect(result.choiceExplanation).toBe(choice.explanation);
          expect(result.correctChoiceIds).toEqual(step.answerIds);
          expect(result.correctChoiceIds).not.toBe(step.answerIds);
        }
        const acceptedChoices = step.choices.filter((choice) =>
          step.answerIds.includes(choice.id),
        );
        expect(acceptedChoices.length).toBeGreaterThan(0);
      }
      expect(JSON.stringify(scenario)).toBe(before);
    },
  );

  it("rejects unknown scenes, steps, cross-scene steps, and choices", () => {
    const step = first.steps[0];
    const choice = step.choices[0];
    for (const [scenarioId, stepId, choiceId] of [
      ["unknown", step.id, choice.id],
      [first.id, "unknown", choice.id],
      [first.id, conversationScenarios[1].steps[0].id, choice.id],
      [first.id, step.id, "unknown"],
      ["__proto__", step.id, choice.id],
    ])
      expect(() =>
        gradeConversationChoice(scenarioId, stepId, choiceId),
      ).toThrow();
  });

  it("records all four scenes and every accepted polite variant without awarding XP", () => {
    let state = createEmptyConversationProgress();
    for (const scenario of conversationScenarios) {
      for (const useLastVariant of [false, true]) {
        const input = completion(`${scenario.id}-${useLastVariant}`, scenario);
        input.answers = scenario.steps.map((step) => ({
          stepId: step.id,
          choiceId: useLastVariant
            ? step.answerIds[step.answerIds.length - 1]
            : step.answerIds[0],
        }));
        const previous = state;
        const snapshot = structuredClone(state);
        const beforeInput = JSON.stringify(input);
        state = recordConversationCompletion(state, input);
        expect(isConversationProgress(state)).toBe(true);
        expect(state.scenarios[scenario.id].completedSessions).toBe(
          useLastVariant ? 2 : 1,
        );
        expect(state.scenarios[scenario.id].lastCompletedAt).toBe(now);
        expect(Object.keys(state).sort()).toEqual(
          ["version", "scenarios", "recentSessionIds"].sort(),
        );
        expect(Object.keys(state.scenarios[scenario.id]).sort()).toEqual(
          ["completedSessions", "lastCompletedAt"].sort(),
        );
        expect(JSON.stringify(input)).toBe(beforeInput);
        expect(previous).toEqual(snapshot);
        expect(state.scenarios).not.toBe(previous.scenarios);
      }
    }
    expect(state.recentSessionIds).toHaveLength(8);
  });

  it("accepts only a complete source-ordered set of accepted replies", () => {
    const valid = completion();
    const badChoice = first.steps[0].choices.find(
      (choice) => !first.steps[0].answerIds.includes(choice.id),
    );
    if (!badChoice) throw new Error("The first scene needs a distractor");
    const invalid = [
      { ...valid, scenarioId: "unknown" },
      { ...valid, answers: [] },
      { ...valid, answers: new Array(first.steps.length) },
      { ...valid, answers: valid.answers.slice(0, -1) },
      { ...valid, answers: [...valid.answers, valid.answers[0]] },
      { ...valid, answers: [...valid.answers].reverse() },
      { ...valid, answers: valid.answers.map(() => valid.answers[0]) },
      {
        ...valid,
        answers: [
          { stepId: first.steps[0].id, choiceId: badChoice.id },
          ...valid.answers.slice(1),
        ],
      },
      {
        ...valid,
        answers: [
          { stepId: first.steps[0].id, choiceId: "unknown" },
          ...valid.answers.slice(1),
        ],
      },
    ];
    for (const input of invalid)
      expect(() =>
        recordConversationCompletion(createEmptyConversationProgress(), input),
      ).toThrow();
  });

  it("rejects invalid dates and unsafe session IDs before recording", () => {
    const valid = completion();
    for (const completedAt of [
      "2026-10-27",
      "2026-02-30T10:00:00Z",
      "2026-10-27T24:00:00Z",
      "2026-10-27T10:60:00Z",
      "2026-10-27T10:00:60Z",
      "2026-10-27T10:00:00+24:00",
      "not a date",
    ])
      expect(() =>
        recordConversationCompletion(createEmptyConversationProgress(), {
          ...valid,
          completedAt,
        }),
      ).toThrow();
    for (const sessionId of [
      "",
      " leading",
      "a b",
      "__proto__",
      "constructor",
      "prototype",
      "x".repeat(121),
    ])
      expect(() =>
        recordConversationCompletion(createEmptyConversationProgress(), {
          ...valid,
          sessionId,
        }),
      ).toThrow();
    for (const completedAt of [
      "2026-10-27T10:00:00Z",
      "2026-10-27T10:00:00.125+09:00",
    ])
      expect(
        isConversationProgress(
          recordConversationCompletion(createEmptyConversationProgress(), {
            ...valid,
            completedAt,
          }),
        ),
      ).toBe(true);
  });

  it("keeps an older tab's completion count while retaining the newest completion date", () => {
    const current = recordConversationCompletion(
      createEmptyConversationProgress(),
      completion("newer", first, later),
    );
    const snapshot = structuredClone(current);
    const older = recordConversationCompletion(
      current,
      completion("older", first, now),
    );
    expect(older.scenarios[first.id]).toEqual({
      completedSessions: 2,
      lastCompletedAt: later,
    });
    expect(current).toEqual(snapshot);
    expect(older.scenarios[first.id]).not.toBe(current.scenarios[first.id]);
  });

  it("deduplicates recent completions and keeps a bounded one-hundred-ID window", () => {
    let state = createEmptyConversationProgress();
    for (let index = 0; index < 101; index++)
      state = recordConversationCompletion(
        state,
        completion(`session-${index}`),
      );
    expect(state.recentSessionIds).toHaveLength(100);
    expect(state.recentSessionIds[0]).toBe("session-1");
    expect(state.scenarios[first.id].completedSessions).toBe(101);
    expect(isConversationProgress(state)).toBe(true);
    expect(recordConversationCompletion(state, completion("session-100"))).toBe(
      state,
    );
  });

  it("rejects invalid states and refuses to exceed the completion limit", () => {
    const state = finished();
    const atLimit: ConversationProgress = {
      ...state,
      scenarios: {
        [first.id]: { completedSessions: 1_000_000, lastCompletedAt: now },
      },
      recentSessionIds: Array.from(
        { length: 100 },
        (_, index) => `session-${index}`,
      ),
    };
    expect(isConversationProgress(atLimit)).toBe(true);
    expect(() =>
      recordConversationCompletion(atLimit, completion("limit-overflow")),
    ).toThrow();
    expect(() =>
      recordConversationCompletion(
        { ...state, version: 2 } as unknown as ConversationProgress,
        completion("invalid-state"),
      ),
    ).toThrow();
  });
});

describe("independent conversation storage", () => {
  it("starts empty without sharing mutable defaults", () => {
    const firstState = createEmptyConversationProgress();
    const second = createEmptyConversationProgress();
    firstState.recentSessionIds.push("temporary");
    expect(second).toEqual({ version: 1, scenarios: {}, recentSessionIds: [] });
    expect(isConversationProgress(second)).toBe(true);
  });

  it("loads empty or saved data without writing, and saves only its own key", () => {
    const storage = memoryStorage();
    const before = new Map(storage.values);
    expect(loadConversationProgress(storage)).toMatchObject({
      status: "empty",
      state: createEmptyConversationProgress(),
    });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).toHaveBeenCalledWith(CONVERSATION_STORAGE_KEY);
    const state = finished();
    expect(saveConversationProgress(state, storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      CONVERSATION_STORAGE_KEY,
      JSON.stringify(state),
    );
    for (const [key, value] of before)
      expect(storage.values.get(key)).toBe(value);
    const loaded = loadConversationProgress(storage);
    expect(loaded.status).toBe("loaded");
    expect(loaded.state).toEqual(state);
    expect(loaded.state).not.toBe(state);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("protects corrupt or unknown saved values until an explicit replacement", () => {
    const invalidRaws = [
      "{broken",
      "null",
      JSON.stringify({ ...finished(), version: 2 }),
      JSON.stringify({
        ...finished(),
        scenarios: { unknown: { completedSessions: 1, lastCompletedAt: now } },
      }),
      JSON.stringify({ ...finished(), transcript: "sensitive" }),
    ];
    for (const raw of invalidRaws) {
      const storage = memoryStorage(raw);
      expect(loadConversationProgress(storage)).toMatchObject({
        status: "invalid",
        state: createEmptyConversationProgress(),
      });
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(saveConversationProgress(finished(), storage)).toBe(false);
      expect(storage.values.get(CONVERSATION_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(replaceConversationProgress(finished(), storage)).toBe(true);
      expect(loadConversationProgress(storage).status).toBe("loaded");
    }
  });

  it("validates counters, record keys, dates, and deduplication metadata", () => {
    const valid = finished();
    const record = valid.scenarios[first.id];
    const invalid: unknown[] = [
      null,
      [],
      {},
      new Date(),
      { ...valid, version: 2 },
      { ...valid, scenarios: [] },
      { ...valid, scenarios: new Date() },
      {
        ...valid,
        scenarios: { [first.id]: { ...record, completedSessions: 0 } },
      },
      {
        ...valid,
        scenarios: { [first.id]: { ...record, completedSessions: -1 } },
      },
      {
        ...valid,
        scenarios: { [first.id]: { ...record, completedSessions: 0.5 } },
      },
      {
        ...valid,
        scenarios: { [first.id]: { ...record, completedSessions: Infinity } },
      },
      {
        ...valid,
        scenarios: { [first.id]: { ...record, completedSessions: 1_000_001 } },
      },
      {
        ...valid,
        scenarios: {
          [first.id]: { ...record, lastCompletedAt: "2026-02-30T10:00:00Z" },
        },
      },
      { ...valid, scenarios: { [first.id]: { ...record, score: 100 } } },
      { ...valid, recentSessionIds: [] },
      { ...valid, recentSessionIds: new Array(1) },
      { ...valid, recentSessionIds: ["same", "same"] },
      { ...valid, recentSessionIds: ["__proto__"] },
      { ...valid, recentSessionIds: [null] },
      { ...valid, recentSessionIds: "bad" },
      { ...valid, answers: [] },
      JSON.parse(
        '{"version":1,"scenarios":{"__proto__":{"completedSessions":1,"lastCompletedAt":"2026-10-27T10:00:00Z"}},"recentSessionIds":["session"]}',
      ),
    ];
    for (const value of invalid)
      expect(isConversationProgress(value)).toBe(false);
    expect(isConversationProgress(valid)).toBe(true);
    const storage = memoryStorage();
    expect(
      saveConversationProgress(invalid[0] as ConversationProgress, storage),
    ).toBe(false);
    expect(
      replaceConversationProgress(invalid[0] as ConversationProgress, storage),
    ).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("handles denied browser storage without discarding valid in-memory progress", () => {
    const denied = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("denied");
      }),
    };
    expect(loadConversationProgress(denied).status).toBe("unavailable");
    const state = finished();
    const before = structuredClone(state);
    expect(saveConversationProgress(state, denied)).toBe(false);
    expect(replaceConversationProgress(state, denied)).toBe(false);
    expect(state).toEqual(before);
    expect(loadConversationProgress().status).toBe("unavailable");
    expect(saveConversationProgress(state)).toBe(false);
    expect(replaceConversationProgress(state)).toBe(false);
  });

  it("handles a denied localStorage property getter before any adapter can be obtained", () => {
    vi.stubGlobal(
      "window",
      Object.create(null, {
        localStorage: {
          get() {
            throw new Error("Storage property is inaccessible");
          },
        },
      }),
    );
    try {
      expect(loadConversationProgress().status).toBe("unavailable");
      expect(saveConversationProgress(finished())).toBe(false);
      expect(replaceConversationProgress(finished())).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("saves completion metadata without responses, phrases, recordings, or transcripts", () => {
    const input = {
      ...completion(),
      transcript: "private transcript",
      recording: "private recording",
    };
    const state = recordConversationCompletion(
      createEmptyConversationProgress(),
      input,
    );
    const storage = memoryStorage();
    expect(saveConversationProgress(state, storage)).toBe(true);
    const raw = storage.values.get(CONVERSATION_STORAGE_KEY) ?? "";
    for (const hidden of [
      "private transcript",
      "private recording",
      "answers",
      "choiceId",
      first.steps[0].npc.thai,
    ])
      expect(raw).not.toContain(hidden);
  });
});

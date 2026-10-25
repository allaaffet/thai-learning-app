import { describe, expect, it, vi } from "vitest";
import { alphabetCharacters } from "@/data/alphabet";
import { DEFAULT_CHARACTER_SELECTION } from "@/data/character-training";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
  getWeakCharacterIds,
  isCharacterTrainingState,
  loadCharacterTrainingState,
  recordCharacterTrainingSession,
  replaceCharacterTrainingState,
  saveCharacterTrainingState,
  withCharacterTrainingSettings,
  type CharacterTrainingSession,
  type CharacterTrainingSettings,
  type CharacterTrainingState,
} from "./character-training-progress";

const now = "2026-10-25T10:00:00.000Z";
const later = "2026-10-25T11:00:00.000Z";

function session(
  id = "session-1",
  correct = true,
  completedAt = now,
): CharacterTrainingSession {
  return {
    id,
    completedAt,
    attempts: Array.from({ length: 8 }, (_, index) => ({
      characterId: DEFAULT_CHARACTER_SELECTION[index % 4],
      correct,
    })),
  };
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>(
    initial === undefined ? [] : [[CHARACTER_TRAINING_STORAGE_KEY, initial]],
  );
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function finishedState() {
  return recordCharacterTrainingSession(
    createEmptyCharacterTrainingState(),
    session(),
  );
}

describe("character training settings and records", () => {
  it("starts with four existing letters and independent fresh objects", () => {
    const first = createEmptyCharacterTrainingState();
    const second = createEmptyCharacterTrainingState();
    expect(first).toEqual({
      version: 1,
      selectedIds: DEFAULT_CHARACTER_SELECTION,
      mode: "audio-to-letter",
      records: {},
      sessionsCompleted: 0,
      recentSessionIds: [],
    });
    expect(isCharacterTrainingState(first)).toBe(true);
    expect(getWeakCharacterIds(first)).toEqual([]);
    first.selectedIds.reverse();
    first.recentSessionIds.push("changed");
    expect(second).toEqual(createEmptyCharacterTrainingState());
    expect(first.selectedIds).not.toBe(second.selectedIds);
  });

  it("changes settings without rewriting recorded answers or the input", () => {
    const previous = finishedState();
    const snapshot = structuredClone(previous);
    const selectedIds = ["kho-khai", "ko-kai"];
    const next = withCharacterTrainingSettings(previous, {
      selectedIds,
      mode: "name-to-letter",
    });
    expect(next.selectedIds).toEqual(selectedIds);
    expect(next.mode).toBe("name-to-letter");
    expect(next.records).toEqual(previous.records);
    expect(next.records).not.toBe(previous.records);
    expect(next.selectedIds).not.toBe(selectedIds);
    expect(previous).toEqual(snapshot);
    expect(isCharacterTrainingState(next)).toBe(true);
  });

  it("allows all 44 known IDs, including obsolete letters, in settings", () => {
    expect(alphabetCharacters).toHaveLength(44);
    for (const character of alphabetCharacters) {
      const other = character.id === "ko-kai" ? "mo-ma" : "ko-kai";
      const next = withCharacterTrainingSettings(
        createEmptyCharacterTrainingState(),
        { selectedIds: [character.id, other], mode: "letter-to-sound" },
      );
      expect(next.selectedIds[0]).toBe(character.id);
    }
  });

  it("rejects duplicate, unknown, Unicode-spoofed or incorrectly sized selections", () => {
    const previous = createEmptyCharacterTrainingState();
    for (const selectedIds of [
      [],
      ["ko-kai"],
      ["ko-kai", "ko-kai"],
      ["ko-kai", "unknown"],
      ["ko-kai", "ก"],
      ["ko-kai", "mo-ma\u0301"],
      alphabetCharacters.slice(0, 9).map((character) => character.id),
    ]) {
      expect(() =>
        withCharacterTrainingSettings(previous, {
          selectedIds,
          mode: "mixed",
        }),
      ).toThrow();
    }
    expect(() =>
      withCharacterTrainingSettings(previous, {
        selectedIds: [...DEFAULT_CHARACTER_SELECTION],
        mode: "unknown",
      } as unknown as CharacterTrainingSettings),
    ).toThrow();
    expect(previous).toEqual(createEmptyCharacterTrainingState());
  });

  it("records one whole round and uses the last answer for each letter", () => {
    const previous = createEmptyCharacterTrainingState();
    const round = session();
    round.attempts = round.attempts.map((attempt, index) => ({
      ...attempt,
      correct: index !== 4,
    }));
    const next = recordCharacterTrainingSession(previous, round);
    expect(next.sessionsCompleted).toBe(1);
    expect(next.recentSessionIds).toEqual(["session-1"]);
    expect(next.lastPracticedAt).toBe(now);
    expect(next.records["ko-kai"]).toEqual({
      correct: 1,
      incorrect: 1,
      lastPracticedAt: now,
      lastCorrect: false,
    });
    expect(next.records["mo-ma"].correct).toBe(2);
    expect(getWeakCharacterIds(next)).toEqual(["ko-kai"]);
    expect(previous).toEqual(createEmptyCharacterTrainingState());
    expect(isCharacterTrainingState(next)).toBe(true);
    expect(next).not.toHaveProperty("xp");
  });

  it("does not mutate frozen state, settings or session input", () => {
    const previous = finishedState();
    Object.values(previous.records).forEach(Object.freeze);
    Object.freeze(previous.records);
    Object.freeze(previous.selectedIds);
    Object.freeze(previous.recentSessionIds);
    Object.freeze(previous);
    const round = session("session-2", false, later);
    round.attempts.forEach(Object.freeze);
    Object.freeze(round.attempts);
    Object.freeze(round);
    const next = recordCharacterTrainingSession(previous, round);
    expect(next.records["ko-kai"].incorrect).toBe(2);
    expect(previous.records["ko-kai"].incorrect).toBe(0);
    expect(() =>
      withCharacterTrainingSettings(previous, {
        selectedIds: Object.freeze(["ko-kai", "mo-ma"]),
        mode: "mixed",
      }),
    ).not.toThrow();
  });

  it("counts each recent session only once, including after a saved reload", () => {
    const previous = finishedState();
    expect(recordCharacterTrainingSession(previous, session())).toBe(previous);
    const storage = memoryStorage();
    expect(saveCharacterTrainingState(previous, storage)).toBe(true);
    const reloaded = loadCharacterTrainingState(storage).state;
    expect(recordCharacterTrainingSession(reloaded, session())).toBe(reloaded);
    expect(reloaded.sessionsCompleted).toBe(1);
    expect(reloaded.records["ko-kai"].correct).toBe(2);
  });

  it("does not resurrect old weakness when an older tab completes later", () => {
    const newer = recordCharacterTrainingSession(
      createEmptyCharacterTrainingState(),
      session("newer", true, later),
    );
    const merged = recordCharacterTrainingSession(
      newer,
      session("older", false, now),
    );
    expect(merged.records["ko-kai"]).toEqual({
      correct: 2,
      incorrect: 2,
      lastCorrect: true,
      lastPracticedAt: later,
    });
    expect(merged.lastPracticedAt).toBe(later);
    expect(merged.sessionsCompleted).toBe(2);
    expect(getWeakCharacterIds(merged)).toEqual([]);
    expect(isCharacterTrainingState(merged)).toBe(true);
  });

  it("clears weakness on a later correct answer and never includes unseen letters", () => {
    const wrong = recordCharacterTrainingSession(
      createEmptyCharacterTrainingState(),
      session("wrong", false),
    );
    const correct = recordCharacterTrainingSession(
      wrong,
      session("correct", true, later),
    );
    expect(getWeakCharacterIds(wrong).sort()).toEqual(
      [...DEFAULT_CHARACTER_SELECTION].sort(),
    );
    expect(getWeakCharacterIds(correct)).toEqual([]);
    expect(correct.records["kho-khai"]).toBeUndefined();
    expect(getWeakCharacterIds(wrong, 2)).toHaveLength(2);
    expect(getWeakCharacterIds(wrong, 0)).toEqual([]);
    for (const limit of [-1, 1.5, 9, NaN, Infinity])
      expect(() => getWeakCharacterIds(wrong, limit)).toThrow();
  });

  it("sorts weakness by latest error, then error count, with at most eight letters", () => {
    let state = createEmptyCharacterTrainingState();
    for (let index = 0; index < 3; index += 1) {
      const id = alphabetCharacters[index * 4].id;
      state = recordCharacterTrainingSession(state, {
        id: `weak-${index}`,
        completedAt: index === 2 ? later : now,
        attempts: Array.from({ length: 8 }, (_, attempt) => ({
          characterId: alphabetCharacters[index * 4 + (attempt % 4)].id,
          correct: false,
        })),
      });
      expect(state.records[id].lastCorrect).toBe(false);
    }
    const weak = getWeakCharacterIds(state);
    expect(weak).toHaveLength(8);
    expect(weak[0]).toBe(alphabetCharacters[8].id);
    const moreErrors = recordCharacterTrainingSession(state, {
      id: "extra-errors",
      completedAt: later,
      attempts: Array.from({ length: 8 }, () => ({
        characterId: alphabetCharacters[9].id,
        correct: false,
      })),
    });
    expect(getWeakCharacterIds(moreErrors)[0]).toBe(alphabetCharacters[9].id);
  });

  it("bounds deduplication IDs without discarding cumulative counters", () => {
    let state = createEmptyCharacterTrainingState();
    for (let index = 0; index < 101; index += 1)
      state = recordCharacterTrainingSession(
        state,
        session(`session-${index}`),
      );
    expect(state.sessionsCompleted).toBe(101);
    expect(state.recentSessionIds).toHaveLength(100);
    expect(state.recentSessionIds[0]).toBe("session-1");
    expect(state.recentSessionIds.at(-1)).toBe("session-100");
    expect(state.records["ko-kai"].correct).toBe(202);
    expect(isCharacterTrainingState(state)).toBe(true);
  });

  it("rejects incomplete sessions, invalid answers, IDs and impossible timestamps", () => {
    const invalid: unknown[] = [
      { ...session(), id: "" },
      { ...session(), id: "bad id" },
      { ...session(), id: "__proto__" },
      { ...session(), attempts: session().attempts.slice(0, 7) },
      {
        ...session(),
        attempts: [...session().attempts, session().attempts[0]],
      },
      {
        ...session(),
        attempts: [
          { characterId: "unknown", correct: true },
          ...session().attempts.slice(1),
        ],
      },
      {
        ...session(),
        attempts: [
          { characterId: "ko-kai", correct: "true" },
          ...session().attempts.slice(1),
        ],
      },
      ...[
        "invalid",
        "2026-02-30T10:00:00Z",
        "2026-10-25T24:00:00Z",
        "2026-10-25T10:00:00",
        "2026-10-25T10:00:00+24:00",
      ].map((completedAt) => ({ ...session(), completedAt })),
    ];
    const previous = createEmptyCharacterTrainingState();
    for (const round of invalid)
      expect(() =>
        recordCharacterTrainingSession(
          previous,
          round as CharacterTrainingSession,
        ),
      ).toThrow();
    expect(previous).toEqual(createEmptyCharacterTrainingState());
  });
});

describe("character training storage validation", () => {
  it("preserves all three legacy version-1 modes and counters, then saves the new audio setting", () => {
    for (const mode of [
      "name-to-letter",
      "letter-to-sound",
      "mixed",
    ] as const) {
      const legacy = { ...finishedState(), mode };
      const raw = JSON.stringify(legacy);
      const storage = memoryStorage(raw);
      const loaded = loadCharacterTrainingState(storage);
      expect(loaded).toEqual({ status: "loaded", state: legacy });
      expect(storage.values.get(CHARACTER_TRAINING_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
      const next = withCharacterTrainingSettings(loaded.state, {
        selectedIds: loaded.state.selectedIds,
        mode: "audio-to-letter",
      });
      expect(next.records).toEqual(legacy.records);
      expect(next.sessionsCompleted).toBe(legacy.sessionsCompleted);
      expect(next.recentSessionIds).toEqual(legacy.recentSessionIds);
      expect(next.lastPracticedAt).toBe(legacy.lastPracticedAt);
      expect(saveCharacterTrainingState(next, storage)).toBe(true);
      expect(loadCharacterTrainingState(storage)).toEqual({
        status: "loaded",
        state: next,
      });
      expect(next.mode).toBe("audio-to-letter");
      expect(next.version).toBe(1);
    }
  });

  it("loads empty storage without writing and round-trips only trainer data", () => {
    const storage = memoryStorage();
    const oldKeys = [
      "thai-learning.progress.v1",
      "thai-learning.review.v1",
      "thai-learning.sound.v1",
      "thai-learning.font.v1",
    ];
    for (const key of oldKeys) storage.values.set(key, `preserve:${key}:ก้`);
    expect(loadCharacterTrainingState(storage).status).toBe("empty");
    expect(storage.setItem).not.toHaveBeenCalled();
    const state = finishedState();
    expect(saveCharacterTrainingState(state, storage)).toBe(true);
    expect(loadCharacterTrainingState(storage)).toEqual({
      state,
      status: "loaded",
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem.mock.calls[0][0]).toBe(
      CHARACTER_TRAINING_STORAGE_KEY,
    );
    for (const key of oldKeys)
      expect(storage.values.get(key)).toBe(`preserve:${key}:ก้`);
  });

  it("rejects malformed JSON, unknown versions and incoherent stored counters", () => {
    const state = finishedState();
    const ko = state.records["ko-kai"];
    const invalid: unknown[] = [
      null,
      [],
      {},
      { ...state, version: 2 },
      { ...state, mode: "listening" },
      { ...state, selectedIds: ["ko-kai", "unknown"] },
      { ...state, selectedIds: ["ko-kai", "ko-kai"] },
      { ...state, sessionsCompleted: 0 },
      { ...state, sessionsCompleted: -1 },
      { ...state, sessionsCompleted: 0.5 },
      { ...state, sessionsCompleted: NaN },
      { ...state, sessionsCompleted: Infinity },
      { ...state, recentSessionIds: [] },
      { ...state, recentSessionIds: ["session-1", "session-1"] },
      { ...state, recentSessionIds: ["bad id"] },
      { ...state, lastPracticedAt: undefined },
      { ...state, lastPracticedAt: later },
      { ...state, records: { ...state.records, unknown: ko } },
      ...[
        { ...ko, correct: NaN },
        { ...ko, correct: Infinity },
        { ...ko, correct: -1 },
        { ...ko, correct: 2.1 },
        { ...ko, correct: Number.MAX_SAFE_INTEGER + 1 },
        { ...ko, correct: 0, incorrect: 0 },
        { ...ko, incorrect: 1 },
        { ...ko, lastCorrect: false },
        { ...ko, lastCorrect: 1 },
        { ...ko, lastPracticedAt: "2026-02-30T10:00:00Z" },
      ].map((record) => ({
        ...state,
        records: { ...state.records, "ko-kai": record },
      })),
      { ...createEmptyCharacterTrainingState(), lastPracticedAt: now },
    ];
    for (const value of invalid) {
      expect(isCharacterTrainingState(value)).toBe(false);
      const raw = JSON.stringify(value);
      const storage = memoryStorage(raw);
      expect(loadCharacterTrainingState(storage).status).toBe("invalid");
      expect(storage.values.get(CHARACTER_TRAINING_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
    }
    for (const raw of ["{", "undefined", "", "[1,2"]) {
      const storage = memoryStorage(raw);
      expect(loadCharacterTrainingState(storage).status).toBe("invalid");
      expect(storage.values.get(CHARACTER_TRAINING_STORAGE_KEY)).toBe(raw);
    }
  });

  it("protects malformed and unknown-version raw data until explicit replacement", () => {
    for (const raw of ["{broken", '{"version":99,"private":"ก้"}']) {
      const storage = memoryStorage(raw);
      const state = finishedState();
      expect(saveCharacterTrainingState(state, storage)).toBe(false);
      expect(storage.values.get(CHARACTER_TRAINING_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(replaceCharacterTrainingState(state, storage)).toBe(true);
      expect(loadCharacterTrainingState(storage)).toEqual({
        state,
        status: "loaded",
      });
    }
  });

  it("reports blocked reads and writes without throwing or changing in-memory records", () => {
    const state = finishedState();
    const snapshot = structuredClone(state);
    const getItem = vi.fn(() => {
      throw new Error("blocked read");
    });
    const setItem = vi.fn(() => {
      throw new Error("quota");
    });
    expect(loadCharacterTrainingState({ getItem })).toMatchObject({
      state: createEmptyCharacterTrainingState(),
      status: "unavailable",
    });
    expect(saveCharacterTrainingState(state, { getItem, setItem })).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(
      saveCharacterTrainingState(state, { getItem: () => null, setItem }),
    ).toBe(false);
    expect(replaceCharacterTrainingState(state, { setItem })).toBe(false);
    expect(state).toEqual(snapshot);
  });

  it("works during SSR and refuses to persist invalid state", () => {
    expect(loadCharacterTrainingState().status).toBe("unavailable");
    expect(saveCharacterTrainingState(finishedState())).toBe(false);
    expect(replaceCharacterTrainingState(finishedState())).toBe(false);
    const invalid = { ...finishedState(), sessionsCompleted: NaN };
    const storage = memoryStorage();
    expect(saveCharacterTrainingState(invalid, storage)).toBe(false);
    expect(replaceCharacterTrainingState(invalid, storage)).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(() =>
      withCharacterTrainingSettings(invalid, {
        selectedIds: ["ko-kai", "mo-ma"],
        mode: "mixed",
      }),
    ).toThrow();
    expect(() => getWeakCharacterIds(invalid)).toThrow();
  });

  it("accepts valid timezone timestamps and persists no unknown raw input fields", () => {
    const state = recordCharacterTrainingSession(
      createEmptyCharacterTrainingState(),
      session("offset", true, "2026-10-25T17:00:00+07:00"),
    );
    const storage = memoryStorage();
    const withExtraInput = { ...state, rawInput: "ก้" };
    expect(saveCharacterTrainingState(withExtraInput, storage)).toBe(true);
    const raw = storage.values.get(CHARACTER_TRAINING_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("rawInput");
    expect(loadCharacterTrainingState(storage).state.lastPracticedAt).toBe(
      "2026-10-25T17:00:00+07:00",
    );
  });

  it("rejects counter overflow while allowing the bounded maximum", () => {
    const state: CharacterTrainingState = {
      ...createEmptyCharacterTrainingState(),
      records: {
        "ko-kai": {
          correct: 8_000_000,
          incorrect: 0,
          lastCorrect: true,
          lastPracticedAt: now,
        },
      },
      sessionsCompleted: 1_000_000,
      recentSessionIds: Array.from(
        { length: 100 },
        (_, index) => `last-${index}`,
      ),
      lastPracticedAt: now,
    };
    expect(isCharacterTrainingState(state)).toBe(true);
    expect(() =>
      recordCharacterTrainingSession(state, session("overflow")),
    ).toThrow("上限");
    expect(
      isCharacterTrainingState({ ...state, sessionsCompleted: 1_000_001 }),
    ).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
} from "@/data/romance";
import {
  ROMANCE_STORAGE_KEY,
  completeRomanceEpisode,
  createEmptyRomance,
  createRomanceSessionId,
  getAvailableRomanceCharacters,
  getRomanceCharacterProgress,
  getRomanceEnding,
  getRomanceLocalDay,
  getRomanceRelationship,
  gradeRomanceChoice,
  isRomanceEpisodeUnlocked,
  isRomanceState,
  loadRomanceProgress,
  replaceRomanceProgress,
  saveRomanceProgress,
  setRomanceProfile,
  type RomanceEpisodeInput,
  type RomanceState,
} from "@/lib/romance";

const start = "2026-11-02T09:00:00.000Z";
const nextDay = "2026-11-03T09:00:00.000Z";

beforeEach(() => vi.stubEnv("TZ", "UTC"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function profile() {
  return setRomanceProfile(createEmptyRomance(), "male", "warm");
}

function input(
  options: {
    characterId?: string;
    episodeId?: string;
    sessionId?: string;
    now?: string;
    wrong?: boolean;
    story?: "thoughtful" | "gentle" | "dismiss";
  } = {},
): RomanceEpisodeInput {
  const characterId = options.characterId ?? "mali";
  const episodeId = options.episodeId ?? "meet";
  return {
    characterId,
    episodeId,
    sessionId: options.sessionId ?? "romance-test-1",
    now: options.now ?? start,
    answers: getRomanceQuestions(characterId, episodeId).map((question) => ({
      stepId: question.id,
      choiceId: options.wrong
        ? question.choices.find(
            (choice) => !question.answerIds.includes(choice.id),
          )!.id
        : question.answerIds[0],
    })),
    storyChoiceId: `${episodeId}-${options.story ?? "thoughtful"}`,
  };
}

function finished(
  state = profile(),
  options: Parameters<typeof input>[0] = {},
) {
  return completeRomanceEpisode(state, input(options));
}

function memoryStorage(raw?: string) {
  const values = new Map<string, string>([
    ["thai-learning.progress.v1", "original-main"],
    ["thai-learning.review.v1", "original-review"],
    ["thai-learning.conversation.v1", "original-conversation"],
    ["thai-learning.character-training.v1", "original-letters"],
  ]);
  if (raw !== undefined) values.set(ROMANCE_STORAGE_KEY, raw);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("romance profile and progression", () => {
  it("starts with no invented affection or profile and no shared learning fields", () => {
    const empty = createEmptyRomance();
    expect(empty).toEqual({
      version: 1,
      profile: null,
      characters: {},
      recentSessionIds: [],
    });
    expect(isRomanceState(empty)).toBe(true);
    expect(getAvailableRomanceCharacters(empty)).toEqual([]);
  });

  it.each(["warm", "calm", "curious"] as const)(
    "recommends two matching partners before the third for %s",
    (preference) => {
      const state = setRomanceProfile(createEmptyRomance(), "male", preference);
      const partners = getAvailableRomanceCharacters(state);
      expect(partners).toHaveLength(3);
      expect(
        partners.every(
          (partner) => partner.gender === "female" && partner.age >= 18,
        ),
      ).toBe(true);
      expect(
        partners
          .slice(0, 2)
          .every((partner) => partner.traits.includes(preference)),
      ).toBe(true);
      expect(partners[2].traits.includes(preference)).toBe(false);
      const female = getAvailableRomanceCharacters(
        setRomanceProfile(state, "female", preference),
      );
      expect(female).toHaveLength(3);
      expect(female.every((partner) => partner.gender === "male")).toBe(true);
    },
  );

  it("preserves all history when changing role or preference", () => {
    const state = finished().state;
    const before = JSON.stringify(state);
    const updated = setRomanceProfile(state, "female", "curious");
    expect(JSON.stringify(state)).toBe(before);
    expect(updated.characters).toEqual(state.characters);
    expect(updated.recentSessionIds).toEqual(state.recentSessionIds);
    expect(updated.profile).toEqual({
      gender: "female",
      preference: "curious",
    });
    expect(isRomanceEpisodeUnlocked(updated, "mali", "meet")).toBe(false);
    expect(isRomanceEpisodeUnlocked(updated, "arun", "meet")).toBe(true);
  });

  it("unlocks by previous episode even at zero affection, never by an arbitrary hearts gate", () => {
    const state = profile();
    expect(isRomanceEpisodeUnlocked(state, "mali", "meet")).toBe(true);
    expect(isRomanceEpisodeUnlocked(state, "mali", "cafe")).toBe(false);
    const next = finished(state, { wrong: true, story: "dismiss" }).state;
    expect(next.characters.mali.affinity).toBe(0);
    expect(isRomanceEpisodeUnlocked(next, "mali", "cafe")).toBe(true);
    expect(isRomanceEpisodeUnlocked(next, "mali", "likes")).toBe(false);
    expect(isRomanceEpisodeUnlocked(next, "unknown", "meet")).toBe(false);
  });

  it.each(romanceCharacters)(
    "accepts all registered polite answers for $id",
    (character) => {
      for (const episode of romanceEpisodes)
        for (const question of getRomanceQuestions(character.id, episode.id)) {
          expect(question.answerIds).toHaveLength(2);
          for (const choiceId of question.answerIds)
            expect(
              gradeRomanceChoice(
                character.id,
                episode.id,
                question.id,
                choiceId,
              ),
            ).toMatchObject({
              correct: true,
              explanation: question.explanation,
            });
          const wrong = question.choices.find(
            (choice) => !question.answerIds.includes(choice.id),
          )!;
          expect(
            gradeRomanceChoice(character.id, episode.id, question.id, wrong.id)
              .correct,
          ).toBe(false);
        }
    },
  );

  it("rejects unknown choices and stale/locked partner submissions", () => {
    expect(() =>
      gradeRomanceChoice("mali", "meet", "unknown", "unknown"),
    ).toThrow();
    expect(() => finished(profile(), { characterId: "arun" })).toThrow();
    expect(() => finished(profile(), { episodeId: "cafe" })).toThrow();
    expect(() => finished(createEmptyRomance())).toThrow();
  });
});

describe("bounded fiction rewards", () => {
  it("applies language, story, first clear, and the day's bonus separately once", () => {
    const state = profile();
    const before = JSON.stringify(state);
    const result = finished(state);
    expect(result.receipt).toEqual({
      correct: 3,
      total: 3,
      languageDelta: 6,
      storyDelta: 3,
      firstClearBonus: 2,
      dailyBonus: 2,
      affinityBefore: 0,
      affinityAfter: 13,
      applied: true,
      firstClear: true,
    });
    expect(JSON.stringify(state)).toBe(before);
    expect(result.state.characters.mali.episodes.meet).toEqual({
      completedAt: start,
      lastPlayedAt: start,
      bestCorrect: 3,
      total: 3,
      plays: 1,
    });
    expect(result.state.characters.mali.studyDays).toEqual(["2026-11-02"]);
    expect(isRomanceState(result.state)).toBe(true);
  });

  it("allows a small, recoverable decrease for mistakes and insensitive story choices", () => {
    const state = profile();
    state.characters.mali = {
      ...getRomanceCharacterProgress(state, "mali"),
      affinity: 40,
    };
    const result = finished(state, { wrong: true, story: "dismiss" });
    expect(result.receipt).toMatchObject({
      correct: 0,
      languageDelta: -3,
      storyDelta: -2,
      firstClearBonus: 2,
      dailyBonus: 2,
      affinityBefore: 40,
      affinityAfter: 39,
    });
    expect(isRomanceEpisodeUnlocked(result.state, "mali", "cafe")).toBe(true);
  });

  it("keeps respectful neutral choices positive, independent of quiz correctness", () => {
    const choice = getRomanceStoryOptions("mali", "meet").find(
      (option) => option.id === "meet-gentle",
    )!;
    expect(choice.affinityDelta).toBe(1);
    expect(finished(profile(), { story: "gentle" }).receipt.storyDelta).toBe(1);
  });

  it("replaying the same episode cannot farm its quiz or story rewards", () => {
    const first = finished(profile(), { wrong: true, story: "dismiss" });
    const second = finished(first.state, {
      sessionId: "replay-correct",
      story: "thoughtful",
      now: "2026-11-02T10:00:00Z",
    });
    expect(second.receipt).toMatchObject({
      correct: 3,
      languageDelta: 0,
      storyDelta: 0,
      firstClearBonus: 0,
      dailyBonus: 0,
      firstClear: false,
    });
    expect(second.state.characters.mali.affinity).toBe(
      first.state.characters.mali.affinity,
    );
    expect(second.state.characters.mali.episodes.meet).toMatchObject({
      plays: 2,
      bestCorrect: 3,
      completedAt: start,
    });
  });

  it("grants daily continuity on a new session without repeating old content rewards", () => {
    const first = finished();
    const second = finished(first.state, {
      sessionId: "tomorrow",
      now: nextDay,
    });
    expect(second.receipt).toMatchObject({
      dailyBonus: 3,
      languageDelta: 0,
      storyDelta: 0,
      firstClearBonus: 0,
      affinityAfter: 16,
    });
    expect(second.state.characters.mali.streak).toBe(2);
    const gap = finished(second.state, {
      sessionId: "after-break",
      now: "2026-11-10T09:00:00Z",
    });
    expect(gap.receipt).toMatchObject({
      dailyBonus: 2,
      affinityBefore: 16,
      affinityAfter: 18,
    });
    expect(gap.state.characters.mali.streak).toBe(1);
  });

  it("gives only one daily bonus per partner even when several episodes end that day", () => {
    const first = finished();
    const second = finished(first.state, {
      episodeId: "cafe",
      sessionId: "cafe-today",
    });
    expect(second.receipt.dailyBonus).toBe(0);
    expect(second.receipt.firstClear).toBe(true);
    expect(second.state.characters.mali.streak).toBe(1);
    const other = finished(second.state, {
      characterId: "rin",
      sessionId: "rin-today",
    });
    expect(other.receipt.dailyBonus).toBe(2);
    expect(other.state.characters.mali).toEqual(second.state.characters.mali);
  });

  it("does not re-award after clock rollback and preserves monotonic last-played timestamps", () => {
    const first = finished();
    const next = finished(first.state, { sessionId: "day-two", now: nextDay });
    const rollback = finished(next.state, {
      sessionId: "old-clock",
      now: start,
    });
    expect(rollback.receipt.dailyBonus).toBe(0);
    expect(rollback.receipt.affinityAfter).toBe(next.receipt.affinityAfter);
    expect(rollback.state.characters.mali.lastBonusDay).toBe("2026-11-03");
    expect(rollback.state.characters.mali.episodes.meet.lastPlayedAt).toBe(
      nextDay,
    );
    expect(isRomanceState(rollback.state)).toBe(true);
  });

  it("is idempotent for the same completion receipt even on a later day", () => {
    const first = finished();
    const duplicate = finished(first.state, { now: nextDay });
    expect(duplicate.receipt).toMatchObject({
      applied: false,
      dailyBonus: 0,
      firstClearBonus: 0,
      languageDelta: 0,
      storyDelta: 0,
    });
    expect(duplicate.state).toEqual(first.state);
  });

  it("clamps affection into0–100 and does not turn it into a learning score", () => {
    const low = finished(profile(), { wrong: true, story: "dismiss" });
    expect(low.receipt.affinityAfter).toBe(0);
    const state = profile();
    state.characters.mali = {
      ...getRomanceCharacterProgress(state, "mali"),
      affinity: 99,
    };
    const high = finished(state);
    expect(high.receipt.affinityAfter).toBe(100);
    expect(high.receipt.correct).toBe(3);
    expect(Object.keys(high.state)).toEqual([
      "version",
      "profile",
      "characters",
      "recentSessionIds",
    ]);
  });

  it("requires one valid response for every source question and a valid story choice", () => {
    const request = input();
    expect(() =>
      completeRomanceEpisode(profile(), {
        ...request,
        answers: request.answers.slice(1),
      }),
    ).toThrow();
    expect(() =>
      completeRomanceEpisode(profile(), {
        ...request,
        answers: [request.answers[0], request.answers[0], request.answers[2]],
      }),
    ).toThrow();
    expect(() =>
      completeRomanceEpisode(profile(), {
        ...request,
        answers: [
          { stepId: "foreign", choiceId: "foreign" },
          ...request.answers.slice(1),
        ],
      }),
    ).toThrow();
    expect(() =>
      completeRomanceEpisode(profile(), {
        ...request,
        storyChoiceId: "unknown",
      }),
    ).toThrow();
    expect(() =>
      completeRomanceEpisode(profile(), {
        ...request,
        now: "2026-02-30T09:00:00Z",
      }),
    ).toThrow();
    expect(() =>
      completeRomanceEpisode(profile(), { ...request, sessionId: "" }),
    ).toThrow();
  });

  it("bounds duplicate receipts without forgetting first-clear protection", () => {
    let state = finished().state;
    const affinity = state.characters.mali.affinity;
    for (let index = 0; index < 105; index++)
      state = finished(state, { sessionId: `repeat-${index}` }).state;
    expect(state.recentSessionIds).toHaveLength(100);
    expect(new Set(state.recentSessionIds).size).toBe(100);
    expect(state.characters.mali.affinity).toBe(affinity);
    expect(state.characters.mali.episodes.meet.plays).toBe(106);
    expect(isRomanceState(state)).toBe(true);
  });

  it("uses local calendar days through both daylight-saving transitions", () => {
    vi.stubEnv("TZ", "America/New_York");
    const before = finished(profile(), { now: "2026-03-07T17:00:00Z" });
    const after = finished(before.state, {
      now: "2026-03-08T16:00:00Z",
      sessionId: "spring",
    });
    expect(after.receipt.dailyBonus).toBe(3);
    expect(after.state.characters.mali.studyDays).toEqual([
      "2026-03-07",
      "2026-03-08",
    ]);
    const fallBefore = finished(profile(), { now: "2026-10-31T16:00:00Z" });
    const fallAfter = finished(fallBefore.state, {
      now: "2026-11-01T17:00:00Z",
      sessionId: "autumn",
    });
    expect(fallAfter.receipt.dailyBonus).toBe(3);
    expect(getRomanceLocalDay("2026-11-02T02:00:00Z")).toBe("2026-11-01");
  });

  it("does not unlock an ending early and has a distinct ending at each relation range", () => {
    let state = profile();
    expect(getRomanceEnding(state, "mali").unlocked).toBe(false);
    for (const episode of romanceEpisodes)
      state = finished(state, {
        episodeId: episode.id,
        sessionId: `finish-${episode.id}`,
      }).state;
    expect(getRomanceEnding(state, "mali").unlocked).toBe(true);
    const titles = [10, 50, 90].map((affinity) => {
      const copy: RomanceState = {
        ...state,
        characters: {
          ...state.characters,
          mali: { ...state.characters.mali, affinity },
        },
      };
      return getRomanceEnding(copy, "mali").title;
    });
    expect(new Set(titles).size).toBe(3);
    expect(
      [0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(
        (score) => getRomanceRelationship(score).level,
      ),
    ).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("isolated persisted romance data", () => {
  it("reading a new or existing save does not write defaults", () => {
    const empty = memoryStorage();
    expect(loadRomanceProgress(empty).status).toBe("empty");
    expect(empty.setItem).not.toHaveBeenCalled();
    const known = memoryStorage(JSON.stringify(finished().state));
    expect(loadRomanceProgress(known)).toMatchObject({
      status: "loaded",
      state: finished().state,
    });
    expect(known.setItem).not.toHaveBeenCalled();
  });

  it.each([
    "{invalid",
    JSON.stringify({ version: 99, story: "future" }),
    JSON.stringify({ ...profile(), characters: { unknown: {} } }),
  ])("protects invalid or unknown original JSON %s", (raw) => {
    const storage = memoryStorage(raw);
    expect(loadRomanceProgress(storage).status).toBe("invalid");
    expect(saveRomanceProgress(profile(), storage)).toBe(false);
    expect(storage.values.get(ROMANCE_STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(replaceRomanceProgress(profile(), storage)).toBe(true);
    expect(loadRomanceProgress(storage).state).toEqual(profile());
  });

  it("writes exactly one independent key and no answers or arbitrary user text", () => {
    const storage = memoryStorage();
    const before = new Map(storage.values);
    const state = finished().state;
    expect(saveRomanceProgress(state, storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem.mock.calls[0][0]).toBe(ROMANCE_STORAGE_KEY);
    for (const [key, value] of before)
      expect(storage.values.get(key)).toBe(value);
    const raw = storage.values.get(ROMANCE_STORAGE_KEY)!;
    expect(raw).not.toContain("choiceId");
    expect(raw).not.toContain("stepId");
    expect(raw).not.toContain("สวัสดี");
  });

  it("handles denied or missing storage without deleting anything", () => {
    expect(
      loadRomanceProgress({
        getItem: () => {
          throw new Error("denied");
        },
      }).status,
    ).toBe("unavailable");
    expect(loadRomanceProgress().status).toBe("unavailable");
    expect(
      saveRomanceProgress(profile(), {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).toBe(false);
    expect(
      replaceRomanceProgress(profile(), {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).toBe(false);
    expect(saveRomanceProgress(profile())).toBe(false);
  });

  it.each([
    { ...profile(), version: 2 },
    { ...profile(), extra: true },
    { ...profile(), profile: { gender: "other", preference: "warm" } },
    { ...profile(), profile: { gender: "male", preference: "unknown" } },
    { ...profile(), recentSessionIds: ["same", "same"] },
    {
      ...profile(),
      characters: {
        mali: { affinity: Infinity, episodes: {}, studyDays: [], streak: 0 },
      },
    },
    {
      ...profile(),
      characters: {
        mali: { affinity: -1, episodes: {}, studyDays: [], streak: 0 },
      },
    },
    {
      ...profile(),
      characters: {
        mali: { affinity: 101, episodes: {}, studyDays: [], streak: 0 },
      },
    },
    {
      ...profile(),
      characters: {
        mali: {
          affinity: 1,
          episodes: {},
          studyDays: ["2026-02-30"],
          streak: 0,
        },
      },
    },
  ])("rejects malformed persistence %#", (state) =>
    expect(isRomanceState(state)).toBe(false),
  );

  it("validates episode references, chronological dates and first-answer aggregates", () => {
    const original = finished().state;
    for (const change of [
      { total: 4 },
      { bestCorrect: 4 },
      { plays: 0 },
      { lastPlayedAt: "2025-01-01T00:00:00Z" },
      { completedAt: "bad" },
    ]) {
      const state = structuredClone(original);
      Object.assign(state.characters.mali.episodes.meet, change);
      expect(isRomanceState(state)).toBe(false);
    }
    const invalid = structuredClone(original);
    invalid.characters.mali.episodes.unknown =
      invalid.characters.mali.episodes.meet;
    expect(isRomanceState(invalid)).toBe(false);
  });

  it("creates receipt IDs on browsers with and without randomUUID", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "known-uuid" });
    expect(createRomanceSessionId()).toBe("known-uuid");
    vi.stubGlobal("crypto", {});
    const id = createRomanceSessionId();
    expect(id).toMatch(/^romance-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("falls back when UUID exists but throws, with distinct same-clock receipts", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("denied");
      },
    });
    const first = createRomanceSessionId();
    const second = createRomanceSessionId();
    expect(first).toMatch(/^romance-/);
    expect(second).not.toBe(first);
  });
});

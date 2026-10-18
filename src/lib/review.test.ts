import { describe, expect, it } from "vitest";
import {
  addReviewCard,
  createEmptyReview,
  getDueCards,
  getReviewStats,
  isReviewState,
  LocalStorageReviewRepository,
  MAX_REVIEW_HISTORY,
  mergeReviewStates,
  REVIEW_STORAGE_KEY,
  reviewCard,
  type ReviewGrade,
  type ReviewState,
} from "./review";

const now = "2026-10-18T10:00:00.000Z";
const word = "vocab-ma";

function registered(cardId = word, at = now) {
  return addReviewCard(createEmptyReview(), cardId, at);
}

function memoryStorage(initial?: string) {
  const values = new Map<string, string>(
    initial === undefined ? [] : [[REVIEW_STORAGE_KEY, initial]],
  );
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function grade(
  state: ReviewState,
  value: ReviewGrade,
  id: string,
  cardId = word,
) {
  return reviewCard(state, cardId, value, state.cards[cardId].dueAt, id);
}

describe("explicit review registration", () => {
  it("starts empty and registers an immediately due card without a history or XP field", () => {
    const empty = createEmptyReview();
    const state = addReviewCard(empty, word, now);
    expect(empty).toEqual({ version: 1, cards: {}, history: [] });
    expect(state.cards[word]).toEqual({
      id: word,
      dueAt: now,
      intervalDays: 0,
      stage: 0,
      lapses: 0,
      reviewCount: 0,
    });
    expect(state.history).toEqual([]);
    expect(Object.keys(state)).toEqual(["version", "cards", "history"]);
    expect(isReviewState(state, [word])).toBe(true);
    expect(getDueCards(state, now).map((card) => card.id)).toEqual([word]);
  });

  it("adding an existing card preserves its schedule and cannot reset its counters", () => {
    const state = grade(registered(), "good", "first-answer");
    expect(addReviewCard(state, word, "2027-01-01T00:00:00Z")).toBe(state);
    expect(state.cards[word].reviewCount).toBe(1);
  });

  it.each(["", " ", "bad id", "__proto__", "constructor", "a".repeat(101)])(
    "rejects an invalid identifier: %s",
    (id) => expect(() => registered(id)).toThrow("ID"),
  );

  it("normalizes a valid timezone timestamp without changing its instant", () => {
    const state = registered(word, "2026-10-18T19:00:00+09:00");
    expect(state.cards[word].dueAt).toBe(now);
  });
});

describe("deterministic review intervals", () => {
  it("good grows intervals through 1/3/7/14/30/60 days and caps the interval", () => {
    let state = registered();
    const intervals = [1, 3, 7, 14, 30, 60, 60, 60];
    intervals.forEach((intervalDays, index) => {
      const before = state;
      const reviewedAt = before.cards[word].dueAt;
      state = grade(state, "good", `answer-${index}`);
      expect(before.cards[word].reviewCount).toBe(index);
      expect(state.cards[word]).toMatchObject({
        intervalDays,
        stage: Math.min(index + 1, 6),
        reviewCount: index + 1,
        lapses: 0,
        lastReviewedAt: reviewedAt,
      });
      expect(new Date(state.cards[word].dueAt).getTime()).toBe(
        new Date(reviewedAt).getTime() + intervalDays * 86_400_000,
      );
      expect(isReviewState(state)).toBe(true);
    });
  });

  it("hard keeps the current step and schedules one day", () => {
    let state = registered();
    state = grade(state, "good", "first");
    state = grade(state, "good", "second");
    const hard = grade(state, "hard", "hard-answer");
    expect(hard.cards[word]).toMatchObject({
      stage: 2,
      intervalDays: 1,
      reviewCount: 3,
      lapses: 0,
    });
    const recovered = grade(hard, "good", "recovered");
    expect(recovered.cards[word]).toMatchObject({ intervalDays: 7, stage: 3 });
    expect(isReviewState(recovered)).toBe(true);
  });

  it("again schedules ten minutes, resets the step, and retains previous reviews", () => {
    let state = grade(registered(), "good", "first");
    state = grade(state, "good", "second");
    const at = state.cards[word].dueAt;
    const again = grade(state, "again", "try-again");
    expect(again.cards[word]).toMatchObject({
      stage: 0,
      intervalDays: 10 / 1440,
      lapses: 1,
      reviewCount: 3,
      lastReviewedAt: at,
    });
    expect(new Date(again.cards[word].dueAt).getTime()).toBe(
      new Date(at).getTime() + 600_000,
    );
    expect(again.history).toHaveLength(3);
    expect(isReviewState(again)).toBe(true);
    expect(grade(again, "good", "recovered").cards[word]).toMatchObject({
      intervalDays: 1,
      stage: 1,
      lapses: 1,
    });
  });

  it("does not silently grade a card before its due time or grade an unregistered word", () => {
    const first = grade(registered(), "good", "first");
    expect(() => reviewCard(first, word, "good", now, "another")).toThrow(
      "予定",
    );
    expect(() =>
      reviewCard(createEmptyReview(), word, "good", now, "first"),
    ).toThrow();
    expect(first.cards[word].reviewCount).toBe(1);
  });

  it("reusing a retained attempt ID is idempotent and cannot rate a different card or grade", () => {
    const first = grade(registered(), "good", "same-answer");
    expect(reviewCard(first, word, "good", now, "same-answer")).toBe(first);
    expect(() => reviewCard(first, word, "again", now, "same-answer")).toThrow(
      "回答ID",
    );
    const twoCards = addReviewCard(first, "vocab-pai", now);
    expect(() =>
      reviewCard(twoCards, "vocab-pai", "good", now, "same-answer"),
    ).toThrow("回答ID");
  });

  it.each([
    "not-a-date",
    "2026-02-30T00:00:00Z",
    "2026-10-18",
    "2026-10-18T10:00:00",
    "2026-10-18T24:00:00Z",
    "2026-10-18T10:60:00Z",
    "2026-10-18T10:00:00+24:00",
  ])("rejects invalid or ambiguous dates: %s", (at) => {
    const state = registered();
    expect(() => addReviewCard(state, "vocab-pai", at)).toThrow("日時");
    expect(() => reviewCard(state, word, "good", at, "invalid-date")).toThrow(
      "日時",
    );
    expect(state.cards[word].reviewCount).toBe(0);
  });

  it("rejects invalid Date and overflowing future schedule without a partial mutation", () => {
    const state = registered();
    expect(() => addReviewCard(state, "vocab-pai", new Date(NaN))).toThrow(
      "日時",
    );
    const future = registered(word, "9999-12-31T00:00:00Z");
    expect(() => grade(future, "good", "future-answer")).toThrow("日時");
    expect(future.history).toHaveLength(0);
  });

  it("retains a bounded history while preserving cumulative review and lapse counts", () => {
    let state = registered();
    for (let index = 0; index <= MAX_REVIEW_HISTORY; index += 1)
      state = grade(state, "again", `answer-${index}`);
    expect(state.history).toHaveLength(MAX_REVIEW_HISTORY);
    expect(state.history[0].id).toBe("answer-1");
    expect(state.cards[word].reviewCount).toBe(MAX_REVIEW_HISTORY + 1);
    expect(state.cards[word].lapses).toBe(MAX_REVIEW_HISTORY + 1);
    expect(
      getReviewStats(state, state.cards[word].lastReviewedAt).reviewCount,
    ).toBe(MAX_REVIEW_HISTORY + 1);
    expect(isReviewState(state)).toBe(true);
  });
});

describe("due cards and honest review statistics", () => {
  it("includes the exact due instant, sorts chronologically then by ID, and leaves state unchanged", () => {
    const state = addReviewCard(
      addReviewCard(registered("vocab-z"), "vocab-a", now),
      "vocab-earlier",
      "2026-10-18T09:00:00Z",
    );
    expect(
      getDueCards(state, "2026-10-18T09:59:59.999Z").map((card) => card.id),
    ).toEqual(["vocab-earlier"]);
    expect(getDueCards(state, now).map((card) => card.id)).toEqual([
      "vocab-earlier",
      "vocab-a",
      "vocab-z",
    ]);
    expect(state.history).toHaveLength(0);
  });

  it("counts review effort and wider intervals without adding XP or calling it mastery", () => {
    let state = registered();
    state = grade(state, "good", "one");
    state = grade(state, "good", "two");
    state = grade(state, "good", "three");
    state = addReviewCard(state, "vocab-pai", now);
    expect(
      getReviewStats(state, state.cards[word].lastReviewedAt),
    ).toMatchObject({
      totalCards: 2,
      dueCount: 1,
      reviewCount: 3,
      expandedCount: 1,
      reviewedToday: 1,
      lastReviewedAt: state.cards[word].lastReviewedAt,
    });
    expect(getReviewStats(createEmptyReview(), now)).toEqual({
      totalCards: 0,
      dueCount: 0,
      reviewCount: 0,
      expandedCount: 0,
      reviewedToday: 0,
    });
  });

  it("uses the learner's local day for today's retained attempts", () => {
    const at = new Date(2026, 9, 18, 23, 55);
    const state = reviewCard(
      registered(word, at.toISOString()),
      word,
      "good",
      at,
      "local-answer",
    );
    expect(
      getReviewStats(state, new Date(2026, 9, 18, 23, 59)).reviewedToday,
    ).toBe(1);
    expect(
      getReviewStats(state, new Date(2026, 9, 19, 0, 1)).reviewedToday,
    ).toBe(0);
  });
});

describe("validation at the storage boundary", () => {
  it("validates a real state, its vocabulary IDs, and history references", () => {
    const state = grade(registered(), "good", "real-answer");
    expect(isReviewState(state)).toBe(true);
    expect(isReviewState(state, [word])).toBe(true);
    expect(isReviewState(state, ["a-different-word"])).toBe(false);
    expect(isReviewState(state, [])).toBe(false);
  });

  it.each([
    ["unknown version", (state: ReviewState) => ({ ...state, version: 2 })],
    ["not an object", () => null],
    ["not a dictionary", (state: ReviewState) => ({ ...state, cards: [] })],
    [
      "missing card reference",
      (state: ReviewState) => ({ ...state, cards: {} }),
    ],
    [
      "duplicate attempt",
      (state: ReviewState) => ({
        ...state,
        history: [...state.history, ...state.history],
      }),
    ],
    [
      "invalid grade",
      (state: ReviewState) => ({
        ...state,
        history: [{ ...state.history[0], grade: "perfect" }],
      }),
    ],
    [
      "wrong grade interval",
      (state: ReviewState) => ({
        ...state,
        history: [{ ...state.history[0], intervalDays: 3 }],
      }),
    ],
    [
      "unknown history card",
      (state: ReviewState) => ({
        ...state,
        history: [{ ...state.history[0], cardId: "unknown" }],
      }),
    ],
    [
      "mismatching map key",
      (state: ReviewState) => ({
        ...state,
        cards: { other: state.cards[word] },
      }),
    ],
    [
      "impossible date",
      (state: ReviewState) => ({
        ...state,
        cards: {
          [word]: { ...state.cards[word], dueAt: "2026-02-30T00:00:00Z" },
        },
      }),
    ],
    [
      "negative interval",
      (state: ReviewState) => ({
        ...state,
        cards: { [word]: { ...state.cards[word], intervalDays: -1 } },
      }),
    ],
    [
      "nonfinite count",
      (state: ReviewState) => ({
        ...state,
        cards: { [word]: { ...state.cards[word], reviewCount: Infinity } },
      }),
    ],
    [
      "fractional count",
      (state: ReviewState) => ({
        ...state,
        cards: { [word]: { ...state.cards[word], lapses: 0.5 } },
      }),
    ],
    [
      "lapses exceed attempts",
      (state: ReviewState) => ({
        ...state,
        cards: { [word]: { ...state.cards[word], lapses: 2 } },
      }),
    ],
    [
      "stage exceeds successful steps",
      (state: ReviewState) => ({
        ...state,
        cards: { [word]: { ...state.cards[word], stage: 6 } },
      }),
    ],
    [
      "due interval tampered",
      (state: ReviewState) => ({
        ...state,
        cards: {
          [word]: { ...state.cards[word], dueAt: "2026-10-20T10:00:00Z" },
        },
      }),
    ],
    [
      "history later than card",
      (state: ReviewState) => ({
        ...state,
        history: [{ ...state.history[0], reviewedAt: "2026-10-20T10:00:00Z" }],
      }),
    ],
  ])("rejects %s", (_name, tamper) => {
    const valid = grade(registered(), "good", "real-answer");
    expect(isReviewState(tamper(valid))).toBe(false);
  });

  it("rejects unsafe dictionary keys and an out-of-order history", () => {
    const first = grade(registered(), "good", "first");
    const second = grade(first, "good", "second");
    expect(
      isReviewState({ ...second, history: [...second.history].reverse() }),
    ).toBe(false);
    expect(
      isReviewState(
        JSON.parse('{"version":1,"cards":{"__proto__":{}},"history":[]}'),
      ),
    ).toBe(false);
  });
});

describe("repository and independent tab preservation", () => {
  it("round-trips a separate versioned review payload without touching lesson storage", () => {
    const storage = memoryStorage();
    const repository = new LocalStorageReviewRepository(storage, [word]);
    expect(repository.load()).toEqual(createEmptyReview());
    expect(repository.loadResult.status).toBe("empty");
    const state = grade(registered(), "good", "answer");
    expect(repository.save(state)).toBe(true);
    expect(repository.load()).toEqual(state);
    expect(repository.loadResult.status).toBe("loaded");
    expect(storage.getItem("thai-learning.progress.v1")).toBeNull();
  });

  it.each([
    "{broken",
    "null",
    "[]",
    JSON.stringify({ ...createEmptyReview(), version: 2 }),
    JSON.stringify(registered("removed-vocabulary")),
  ])(
    "preserves corrupt, future-version, and unknown-vocabulary payloads: %s",
    (serialized) => {
      const storage = memoryStorage(serialized);
      const repository = new LocalStorageReviewRepository(storage, [word]);
      expect(repository.load()).toEqual(createEmptyReview());
      expect(repository.loadResult.status).toBe("invalid");
      expect(repository.loadResult.message).toContain("上書きせず");
      expect(repository.save(registered())).toBe(false);
      expect(repository.saveError).toContain("保護");
      expect(storage.getItem(REVIEW_STORAGE_KEY)).toBe(serialized);
    },
  );

  it("re-checks invalid data written by another tab between load and save", () => {
    const storage = memoryStorage();
    const repository = new LocalStorageReviewRepository(storage);
    repository.load();
    storage.setItem(REVIEW_STORAGE_KEY, '{"version":99}');
    expect(repository.save(registered())).toBe(false);
    expect(storage.getItem(REVIEW_STORAGE_KEY)).toBe('{"version":99}');
  });

  it("handles SSR, blocked reads, and failed writes while the pure scheduler remains usable", () => {
    const server = new LocalStorageReviewRepository(null);
    expect(server.load()).toEqual(createEmptyReview());
    expect(server.loadResult.status).toBe("unavailable");
    expect(server.save(registered())).toBe(false);
    const blocked = new LocalStorageReviewRepository({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(blocked.load()).toEqual(createEmptyReview());
    expect(blocked.loadResult.status).toBe("unavailable");
    expect(blocked.save(registered())).toBe(false);
    expect(
      grade(registered(), "good", "in-memory").cards[word].reviewCount,
    ).toBe(1);
    const noQuota = new LocalStorageReviewRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(noQuota.save(registered())).toBe(false);
    expect(noQuota.saveError).toContain("ページを閉じる");
  });

  it("merges independent tab additions and keeps their schedules and attempt IDs", () => {
    const a = grade(registered(), "good", "tab-a");
    const b = grade(registered("vocab-pai"), "again", "tab-b", "vocab-pai");
    const merged = mergeReviewStates(a, b);
    expect(merged.cards[word]).toEqual(a.cards[word]);
    expect(merged.cards["vocab-pai"]).toEqual(b.cards["vocab-pai"]);
    expect(merged.history.map((attempt) => attempt.id)).toEqual([
      "tab-a",
      "tab-b",
    ]);
    expect(isReviewState(merged)).toBe(true);
    expect(a.cards["vocab-pai"]).toBeUndefined();
  });

  it("keeps the later same-card schedule rather than inventing combined proficiency", () => {
    const a = grade(registered(), "good", "original");
    const b = grade(a, "again", "later");
    const merged = mergeReviewStates(b, a);
    expect(merged.cards[word]).toEqual(b.cards[word]);
    expect(merged.history).toHaveLength(2);
    expect(isReviewState(merged)).toBe(true);
  });

  it.each([false, true])(
    "preserves saved reviews over a later unsaved registration after storage recovers (saved first: %s)",
    (savedFirst) => {
      const saved = grade(registered(), "good", "saved-review");
      const temporary = addReviewCard(
        registered(word, "2026-10-20T10:00:00Z"),
        "vocab-pai",
        "2026-10-20T10:00:00Z",
      );
      const merged = savedFirst
        ? mergeReviewStates(saved, temporary)
        : mergeReviewStates(temporary, saved);

      expect(merged.cards[word]).toEqual(saved.cards[word]);
      expect(merged.history).toEqual(saved.history);
      expect(merged.cards["vocab-pai"]).toEqual(temporary.cards["vocab-pai"]);
      expect(isReviewState(merged)).toBe(true);
    },
  );

  it("keeps a coherent source when offline tabs grade the same card at the same instant", () => {
    const a = grade(registered(), "good", "tab-a");
    const b = grade(registered(), "again", "tab-b");
    const merged = mergeReviewStates(a, b);
    expect(merged.cards[word]).toEqual(a.cards[word]);
    expect(merged.history).toEqual(a.history);
    expect(isReviewState(merged)).toBe(true);
  });
});

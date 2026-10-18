/** SRS records are independent of lesson completion, understanding, and XP. */
export const REVIEW_STORAGE_KEY = "thai-learning.review.v1";
export const MAX_REVIEW_HISTORY = 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const AGAIN_MINUTES = 10;
const AGAIN_INTERVAL = AGAIN_MINUTES / (24 * 60);
const GOOD_INTERVALS = [1, 3, 7, 14, 30, 60] as const;
const MAX_CARDS = 5_000;
const MAX_COUNT = 1_000_000;

export type ReviewGrade = "again" | "hard" | "good";

export interface ReviewCard {
  id: string;
  dueAt: string;
  intervalDays: number;
  /** The number of successful interval steps, capped at six. */
  stage: number;
  lastReviewedAt?: string;
  lapses: number;
  reviewCount: number;
}

export interface ReviewAttempt {
  id: string;
  cardId: string;
  reviewedAt: string;
  grade: ReviewGrade;
  intervalDays: number;
}

export interface ReviewState {
  version: 1;
  cards: Record<string, ReviewCard>;
  /** Only the latest 1,000 attempts are retained; card totals remain cumulative. */
  history: ReviewAttempt[];
}

export interface ReviewStats {
  totalCards: number;
  dueCount: number;
  reviewCount: number;
  /** A wider review interval is not a language proficiency assessment. */
  expandedCount: number;
  /** Counted within the retained history in the learner's local time zone. */
  reviewedToday: number;
  lastReviewedAt?: string;
}

export type ReviewLoadStatus = "empty" | "loaded" | "invalid" | "unavailable";
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function createEmptyReview(): ReviewState {
  return { version: 1, cards: {}, history: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value) &&
    !["constructor", "prototype", "__proto__"].includes(value)
  );
}

function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_COUNT
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

function isGrade(value: unknown): value is ReviewGrade {
  return value === "again" || value === "hard" || value === "good";
}

function isInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    (value === 0 ||
      value === AGAIN_INTERVAL ||
      GOOD_INTERVALS.some((interval) => interval === value))
  );
}

function isCard(value: unknown): value is ReviewCard {
  if (
    !isRecord(value) ||
    !isIdentifier(value.id) ||
    !isTimestamp(value.dueAt) ||
    !isInterval(value.intervalDays) ||
    !isCount(value.stage) ||
    value.stage > GOOD_INTERVALS.length ||
    !isCount(value.lapses) ||
    !isCount(value.reviewCount) ||
    value.lapses > value.reviewCount ||
    value.stage > value.reviewCount
  )
    return false;
  if (value.reviewCount === 0)
    return (
      value.lastReviewedAt === undefined &&
      value.stage === 0 &&
      value.intervalDays === 0 &&
      value.lapses === 0
    );
  return (
    isTimestamp(value.lastReviewedAt) &&
    value.intervalDays > 0 &&
    new Date(value.dueAt).getTime() -
      new Date(value.lastReviewedAt).getTime() ===
      Math.round(value.intervalDays * DAY_MS) &&
    (value.intervalDays === AGAIN_INTERVAL
      ? value.stage === 0 && value.lapses > 0
      : value.intervalDays === 1 ||
        (value.stage > 0 &&
          value.intervalDays === GOOD_INTERVALS[value.stage - 1]))
  );
}

function isAttempt(value: unknown): value is ReviewAttempt {
  return (
    isRecord(value) &&
    isIdentifier(value.id) &&
    isIdentifier(value.cardId) &&
    isTimestamp(value.reviewedAt) &&
    isGrade(value.grade) &&
    isInterval(value.intervalDays) &&
    (value.grade === "again"
      ? value.intervalDays === AGAIN_INTERVAL
      : value.grade === "hard"
        ? value.intervalDays === 1
        : GOOD_INTERVALS.some((interval) => interval === value.intervalDays))
  );
}

/** Reject unknown vocabulary IDs when an allowlist is supplied at the boundary. */
export function isReviewState(
  value: unknown,
  vocabularyIds?: readonly string[],
): value is ReviewState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.cards) ||
    Object.keys(value.cards).length > MAX_CARDS ||
    !Array.isArray(value.history) ||
    value.history.length > MAX_REVIEW_HISTORY
  )
    return false;
  const allowed = vocabularyIds ? new Set(vocabularyIds) : undefined;
  if (
    !Object.entries(value.cards).every(
      ([id, card]) =>
        isIdentifier(id) &&
        (!allowed || allowed.has(id)) &&
        isCard(card) &&
        card.id === id,
    )
  )
    return false;
  const seen = new Set<string>();
  const retainedCounts = new Map<string, number>();
  let previousTime = -Infinity;
  for (const attempt of value.history) {
    if (
      !isAttempt(attempt) ||
      seen.has(attempt.id) ||
      !Object.hasOwn(value.cards, attempt.cardId)
    )
      return false;
    const card = value.cards[attempt.cardId];
    if (!isCard(card)) return false;
    const reviewedTime = new Date(attempt.reviewedAt).getTime();
    if (
      reviewedTime < previousTime ||
      !card.lastReviewedAt ||
      reviewedTime > new Date(card.lastReviewedAt).getTime() ||
      (reviewedTime === new Date(card.lastReviewedAt).getTime() &&
        (attempt.intervalDays !== card.intervalDays ||
          (attempt.grade === "again" && card.stage !== 0) ||
          (attempt.grade === "good" && card.stage === 0)))
    )
      return false;
    previousTime = reviewedTime;
    seen.add(attempt.id);
    const count = (retainedCounts.get(attempt.cardId) ?? 0) + 1;
    if (count > card.reviewCount) return false;
    retainedCounts.set(attempt.cardId, count);
  }
  return true;
}

function timestamp(now: string | Date): string {
  if (now instanceof Date && !Number.isFinite(now.getTime()))
    throw new Error("復習日時が正しくありません。");
  const value = now instanceof Date ? now.toISOString() : now;
  if (!isTimestamp(value)) throw new Error("復習日時が正しくありません。");
  return new Date(value).toISOString();
}

function assertState(state: ReviewState) {
  if (!isReviewState(state)) throw new Error("復習データが正しくありません。");
}

export function addReviewCard(
  state: ReviewState,
  cardId: string,
  now: string | Date = new Date(),
): ReviewState {
  assertState(state);
  if (!isIdentifier(cardId)) throw new Error("単語のIDが正しくありません。");
  const dueAt = timestamp(now);
  if (Object.hasOwn(state.cards, cardId)) return state;
  if (Object.keys(state.cards).length >= MAX_CARDS)
    throw new Error("復習カードの登録上限に達しました。");
  return {
    ...state,
    cards: {
      ...state.cards,
      [cardId]: {
        id: cardId,
        dueAt,
        intervalDays: 0,
        stage: 0,
        lapses: 0,
        reviewCount: 0,
      },
    },
  };
}

function newAttemptId(): string {
  // Modern supported browsers and Node provide randomUUID; never use a fixed ID.
  return `review-${globalThis.crypto.randomUUID()}`;
}

/** A small deterministic interval scheduler, not a proficiency or XP engine. */
export function reviewCard(
  state: ReviewState,
  cardId: string,
  grade: ReviewGrade,
  now: string | Date = new Date(),
  attemptId = newAttemptId(),
): ReviewState {
  assertState(state);
  if (
    !isIdentifier(cardId) ||
    !isGrade(grade) ||
    !isIdentifier(attemptId) ||
    !Object.hasOwn(state.cards, cardId)
  )
    throw new Error("復習の回答が正しくありません。");
  const reviewedAt = timestamp(now);
  const existingAttempt = state.history.find((item) => item.id === attemptId);
  if (existingAttempt) {
    if (existingAttempt.cardId === cardId && existingAttempt.grade === grade)
      return state;
    throw new Error("同じ回答IDで別の復習を記録できません。");
  }
  const previous = state.cards[cardId];
  if (new Date(previous.dueAt).getTime() > new Date(reviewedAt).getTime())
    throw new Error("この単語はまだ復習予定の時刻になっていません。");
  if (
    (previous.lastReviewedAt &&
      new Date(reviewedAt).getTime() <
        new Date(previous.lastReviewedAt).getTime()) ||
    previous.reviewCount >= MAX_COUNT
  )
    throw new Error("復習の日時または記録回数を確認してください。");
  const intervalDays =
    grade === "again"
      ? AGAIN_INTERVAL
      : grade === "hard"
        ? 1
        : GOOD_INTERVALS[Math.min(previous.stage, GOOD_INTERVALS.length - 1)];
  const card: ReviewCard = {
    id: cardId,
    dueAt: new Date(
      new Date(reviewedAt).getTime() + Math.round(intervalDays * DAY_MS),
    ).toISOString(),
    intervalDays,
    stage:
      grade === "again"
        ? 0
        : grade === "good"
          ? Math.min(previous.stage + 1, GOOD_INTERVALS.length)
          : previous.stage,
    lastReviewedAt: reviewedAt,
    lapses: previous.lapses + (grade === "again" ? 1 : 0),
    reviewCount: previous.reviewCount + 1,
  };
  if (!isTimestamp(card.dueAt))
    throw new Error("次の復習日時を設定できません。");
  const attempt: ReviewAttempt = {
    id: attemptId,
    cardId,
    reviewedAt,
    grade,
    intervalDays,
  };
  return {
    version: 1,
    cards: { ...state.cards, [cardId]: card },
    history: [...state.history, attempt]
      .sort(
        (a, b) =>
          new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime(),
      )
      .slice(-MAX_REVIEW_HISTORY),
  };
}

export function getDueCards(
  state: ReviewState,
  now: string | Date = new Date(),
): ReviewCard[] {
  const time = new Date(timestamp(now)).getTime();
  return Object.values(state.cards)
    .filter((card) => new Date(card.dueAt).getTime() <= time)
    .sort(
      (a, b) =>
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() ||
        a.id.localeCompare(b.id),
    );
}

function localDay(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

export function getReviewStats(
  state: ReviewState,
  now: string | Date = new Date(),
): ReviewStats {
  const at = timestamp(now);
  const cards = Object.values(state.cards);
  const dates = cards
    .map((card) => card.lastReviewedAt)
    .filter((date): date is string => date !== undefined)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return {
    totalCards: cards.length,
    dueCount: getDueCards(state, at).length,
    reviewCount: cards.reduce((sum, card) => sum + card.reviewCount, 0),
    expandedCount: cards.filter((card) => card.intervalDays >= 7).length,
    reviewedToday: state.history.filter(
      (attempt) =>
        localDay(new Date(attempt.reviewedAt)) === localDay(new Date(at)),
    ).length,
    ...(dates[0] ? { lastReviewedAt: dates[0] } : {}),
  };
}

/** Best-effort merging for a local unsaved tab; localStorage is not transactional. */
export function mergeReviewStates(a: ReviewState, b: ReviewState): ReviewState {
  assertState(a);
  assertState(b);
  const cards = { ...a.cards };
  const selectedSource = new Map(
    Object.keys(a.cards).map((id) => [id, a] as const),
  );
  for (const [id, candidate] of Object.entries(b.cards)) {
    const current = cards[id];
    const candidateTime = new Date(
      candidate.lastReviewedAt ?? candidate.dueAt,
    ).getTime();
    const currentTime = current
      ? new Date(current.lastReviewedAt ?? current.dueAt).getTime()
      : -Infinity;
    const candidateReviewed = candidate.reviewCount > 0;
    const currentReviewed = Boolean(current && current.reviewCount > 0);
    if (
      !current ||
      // A later registration made while storage was unavailable must not reset
      // an existing reviewed card when the saved record becomes readable again.
      (candidateReviewed && !currentReviewed) ||
      (candidateReviewed === currentReviewed &&
        (candidateTime > currentTime ||
          (candidateTime === currentTime &&
            candidate.reviewCount > current.reviewCount)))
    ) {
      cards[id] = candidate;
      selectedSource.set(id, b);
    }
  }
  // If two offline tabs reviewed one card independently, keep the later card and
  // its history, rather than inventing a combined scheduling/proficiency result.
  const byId = new Map<string, ReviewAttempt>();
  for (const source of [a, b])
    for (const attempt of source.history)
      if (
        selectedSource.get(attempt.cardId) === source &&
        !byId.has(attempt.id)
      )
        byId.set(attempt.id, attempt);
  const history = [...byId.values()].sort(
    (x, y) =>
      new Date(x.reviewedAt).getTime() - new Date(y.reviewedAt).getTime(),
  );
  if (Object.keys(cards).length > MAX_CARDS)
    throw new Error("復習カードの登録上限に達しました。");
  return {
    version: 1,
    cards,
    history: history.slice(-MAX_REVIEW_HISTORY),
  };
}

export class LocalStorageReviewRepository {
  private readonly storage?: StorageAdapter;
  private readonly vocabularyIds?: readonly string[];
  loadResult: { status: ReviewLoadStatus; message?: string } = {
    status: "empty",
  };
  saveError?: string;

  constructor(
    storage?: StorageAdapter | null,
    vocabularyIds?: readonly string[],
  ) {
    this.vocabularyIds = vocabularyIds;
    try {
      this.storage =
        storage === null
          ? undefined
          : (storage ??
            (typeof window === "undefined" ? undefined : window.localStorage));
    } catch {
      this.storage = undefined;
    }
  }

  load(): ReviewState {
    if (!this.storage) {
      this.loadResult = {
        status: "unavailable",
        message:
          "この環境では復習の記録を保存できません。この画面内だけで練習できます。",
      };
      return createEmptyReview();
    }
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(REVIEW_STORAGE_KEY);
    } catch {
      this.loadResult = {
        status: "unavailable",
        message: "復習の記録を読み込めません。この画面内だけで練習できます。",
      };
      return createEmptyReview();
    }
    if (serialized === null) {
      this.loadResult = { status: "empty" };
      return createEmptyReview();
    }
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!isReviewState(parsed, this.vocabularyIds))
        throw new Error("Invalid review");
      this.loadResult = { status: "loaded" };
      return parsed;
    } catch {
      this.loadResult = {
        status: "invalid",
        message:
          "復習の保存データを読み込めません。元のデータは上書きせず、この画面内だけで練習します。ページを閉じると今回の記録は失われます。",
      };
      return createEmptyReview();
    }
  }

  save(state: ReviewState): boolean {
    this.saveError = undefined;
    if (!this.storage || !isReviewState(state, this.vocabularyIds)) {
      this.saveError =
        "復習の記録を保存できません。ページを閉じると今回の記録は失われます。";
      return false;
    }
    try {
      // Re-check immediately before saving, including when another tab replaces
      // the saved payload with an unknown version after this tab has loaded.
      const serialized = this.storage.getItem(REVIEW_STORAGE_KEY);
      if (serialized !== null) {
        let existing: unknown;
        try {
          existing = JSON.parse(serialized);
        } catch {
          existing = undefined;
        }
        if (!isReviewState(existing, this.vocabularyIds)) {
          this.saveError =
            "読み込めない復習データを保護するため、上書きしていません。この画面の記録はページを閉じると失われます。";
          return false;
        }
      }
      this.storage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      this.saveError =
        "復習の記録を保存できません。ページを閉じると今回の記録は失われます。";
      return false;
    }
  }
}

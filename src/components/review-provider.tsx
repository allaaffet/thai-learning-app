"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addReviewCard,
  createEmptyReview,
  LocalStorageReviewRepository,
  mergeReviewStates,
  REVIEW_STORAGE_KEY,
  reviewCard,
  type ReviewGrade,
  type ReviewState,
} from "@/lib/review";

interface ReviewContextValue {
  state: ReviewState;
  ready: boolean;
  storageMessage: string | null;
  addCard: (id: string) => boolean;
  rateCard: (id: string, grade: ReviewGrade, attemptId?: string) => boolean;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewProvider({
  children,
  vocabularyIds,
}: {
  children: ReactNode;
  vocabularyIds: readonly string[];
}) {
  const [state, setState] = useState<ReviewState>(createEmptyReview);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const repository = useRef<LocalStorageReviewRepository | null>(null);
  const current = useRef<ReviewState>(createEmptyReview());
  const unsaved = useRef(false);
  // Keep the mount's ID boundary stable, even when a parent renders a new array.
  const allowedIds = useRef(new Set(vocabularyIds));

  useEffect(() => {
    const storage = new LocalStorageReviewRepository(undefined, [
      ...allowedIds.current,
    ]);
    const loaded = storage.load();
    repository.current = storage;
    current.current = loaded;
    // Browser storage is loaded after hydration; the empty SSR state is never saved.
    setState(loaded);
    setStorageMessage(storage.loadResult.message ?? null);
    setReady(true);
    function syncOtherTab(event: StorageEvent) {
      if (event.key !== REVIEW_STORAGE_KEY && event.key !== null) return;
      const updated = storage.load();
      if (
        storage.loadResult.status === "loaded" ||
        storage.loadResult.status === "empty"
      ) {
        current.current = unsaved.current
          ? mergeReviewStates(current.current, updated)
          : updated;
        setState(current.current);
        if (!unsaved.current) setStorageMessage(null);
      } else {
        setStorageMessage(storage.loadResult.message ?? null);
      }
    }
    window.addEventListener("storage", syncOtherTab);
    return () => window.removeEventListener("storage", syncOtherTab);
  }, []);

  const update = useCallback(
    (id: string, change: (base: ReviewState) => ReviewState): boolean => {
      const storage = repository.current;
      if (!storage) {
        setStorageMessage(
          "復習の記録を読み込み中です。少し待ってからお試しください。",
        );
        return false;
      }
      if (!allowedIds.current.has(id)) {
        setStorageMessage("この単語を復習に登録できません。");
        return false;
      }
      // Read immediately before a mutation to preserve another tab's cards.
      const disk = storage.load();
      let base = current.current;
      if (
        storage.loadResult.status === "loaded" ||
        storage.loadResult.status === "empty"
      )
        base = unsaved.current ? mergeReviewStates(base, disk) : disk;
      let next: ReviewState;
      try {
        next = change(base);
      } catch (error) {
        setStorageMessage(
          error instanceof Error
            ? error.message
            : "復習を記録できませんでした。",
        );
        return false;
      }
      current.current = next;
      setState(next);
      if (storage.save(next)) {
        unsaved.current = false;
        setStorageMessage(null);
      } else {
        unsaved.current = true;
        setStorageMessage(
          storage.saveError ?? "復習の記録を保存できませんでした。",
        );
      }
      // A valid in-memory answer is accepted even if storage is unavailable.
      return true;
    },
    [],
  );

  const addCard = useCallback(
    (id: string) => update(id, (base) => addReviewCard(base, id)),
    [update],
  );
  const rateCard = useCallback(
    (id: string, grade: ReviewGrade, attemptId?: string) =>
      update(id, (base) => reviewCard(base, id, grade, new Date(), attemptId)),
    [update],
  );

  return (
    <ReviewContext.Provider
      value={{ state, ready, storageMessage, addCard, rateCard }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) throw new Error("ReviewProvider が必要です。");
  return context;
}

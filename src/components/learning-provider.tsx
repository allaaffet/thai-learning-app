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
  completeLesson,
  createEmptyProgress,
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
  type LessonLike,
  type LessonResult,
} from "@/lib/progress";

interface LearningContextValue {
  progress: LearningProgress;
  ready: boolean;
  storageMessage: string | null;
  finishLesson: (
    lesson: LessonLike,
    result: LessonResult,
  ) => { passed: boolean; earnedXp: number };
}

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] =
    useState<LearningProgress>(createEmptyProgress);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const repository = useRef<LocalStorageProgressRepository | null>(null);
  const latestProgress = useRef<LearningProgress>(createEmptyProgress());
  const hasUnsavedChanges = useRef(false);

  useEffect(() => {
    const storage = new LocalStorageProgressRepository();
    const loaded = storage.load();
    repository.current = storage;
    latestProgress.current = loaded;
    // Browser storage is read after hydration; never save the initial empty state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loaded);
    setStorageMessage(storage.loadResult.message ?? null);
    setReady(true);
    function syncOtherTab(event: StorageEvent) {
      if (event.key !== PROGRESS_STORAGE_KEY || hasUnsavedChanges.current)
        return;
      const updated = storage.load();
      if (storage.loadResult.status === "loaded") {
        latestProgress.current = updated;
        setProgress(updated);
      }
    }
    window.addEventListener("storage", syncOtherTab);
    return () => window.removeEventListener("storage", syncOtherTab);
  }, []);

  const finishLesson = useCallback(
    (lesson: LessonLike, result: LessonResult) => {
      if (!repository.current)
        throw new Error("進捗を読み込み中です。少し待ってからお試しください。");
      // Read again immediately before writing to preserve another tab's completed lessons.
      // Keep this tab's in-memory work when a previous write was refused.
      const onDisk = repository.current.load();
      const base =
        repository.current.loadResult.status === "loaded" &&
        !hasUnsavedChanges.current
          ? onDisk
          : latestProgress.current;
      const completion = completeLesson(base, lesson, result);
      latestProgress.current = completion.progress;
      setProgress(completion.progress);
      if (!repository.current.save(completion.progress)) {
        hasUnsavedChanges.current = true;
        setStorageMessage(
          repository.current.saveError ?? "進捗を保存できませんでした。",
        );
      } else {
        hasUnsavedChanges.current = false;
        setStorageMessage(null);
      }
      return { passed: completion.passed, earnedXp: completion.earnedXp };
    },
    [],
  );

  return (
    <LearningContext.Provider
      value={{ progress, ready, storageMessage, finishLesson }}
    >
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error("LearningProvider が必要です。");
  return context;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterTrainingMode } from "@/lib/character-trainer";
import {
  CHARACTER_TRAINING_STORAGE_KEY,
  createEmptyCharacterTrainingState,
  loadCharacterTrainingState,
  recordCharacterTrainingSession,
  replaceCharacterTrainingState,
  saveCharacterTrainingState,
  withCharacterTrainingSettings,
  type CharacterTrainingState,
} from "@/lib/character-training-progress";

type LoadStatus = ReturnType<typeof loadCharacterTrainingState>["status"];
const UNSAVED_MESSAGE =
  "文字練習の記録を保存できません。このタブでは続けられますが、閉じると今回の記録が失われます。";
const INVALID_MESSAGE =
  "文字練習の保存データを読み取れません。元データを保護し、このタブだけで練習します。保存を再開するには、文字練習の記録を置き換えてください。";

/** Only the trainer's own key is accessed. Mounting never writes storage. */
export function useCharacterTraining() {
  const [state, setState] = useState(createEmptyCharacterTrainingState);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("empty");
  const current = useRef<CharacterTrainingState>(
    createEmptyCharacterTrainingState(),
  );
  const initialized = useRef(false);
  const unsaved = useRef(false);
  const protectedData = useRef(false);

  useEffect(() => {
    const loaded = loadCharacterTrainingState();
    current.current = loaded.state;
    initialized.current = true;
    protectedData.current = loaded.status === "invalid";
    // Storage is external state; load it only after hydration without saving defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded.state);
    setLoadStatus(loaded.status);
    setMessage(
      loaded.status === "invalid" ? INVALID_MESSAGE : (loaded.message ?? null),
    );
    setReady(true);

    function syncOtherTab(event: StorageEvent) {
      if (event.key !== CHARACTER_TRAINING_STORAGE_KEY && event.key !== null)
        return;
      const updated = loadCharacterTrainingState();
      if (updated.status === "invalid") {
        protectedData.current = true;
        setLoadStatus("invalid");
        setMessage(INVALID_MESSAGE);
      } else if (
        !unsaved.current &&
        (updated.status === "loaded" || updated.status === "empty")
      ) {
        current.current = updated.state;
        protectedData.current = false;
        setState(updated.state);
        setLoadStatus(updated.status);
        setMessage(null);
      }
    }
    window.addEventListener("storage", syncOtherTab);
    return () => window.removeEventListener("storage", syncOtherTab);
  }, []);

  const update = useCallback(
    (change: (base: CharacterTrainingState) => CharacterTrainingState) => {
      if (!initialized.current) return false;
      // Preserve sequential updates from another tab when this tab has no unsaved work.
      const disk = loadCharacterTrainingState();
      if (disk.status === "invalid") protectedData.current = true;
      const base =
        !unsaved.current &&
        !protectedData.current &&
        (disk.status === "loaded" || disk.status === "empty")
          ? disk.state
          : current.current;
      let next: CharacterTrainingState;
      try {
        next = change(base);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "文字練習を記録できませんでした。",
        );
        return false;
      }
      current.current = next;
      setState(next);
      if (protectedData.current) {
        unsaved.current = true;
        setLoadStatus("invalid");
        setMessage(INVALID_MESSAGE);
      } else if (saveCharacterTrainingState(next)) {
        unsaved.current = false;
        setLoadStatus("loaded");
        setMessage(null);
      } else {
        unsaved.current = true;
        setLoadStatus("unavailable");
        setMessage(UNSAVED_MESSAGE);
      }
      // Valid actions remain usable when the browser refuses persistence.
      return true;
    },
    [],
  );

  const saveSettings = useCallback(
    (selectedIds: string[], mode: CharacterTrainingMode) =>
      update((base) =>
        withCharacterTrainingSettings(base, { selectedIds, mode }),
      ),
    [update],
  );
  const saveSession = useCallback(
    (
      id: string,
      attempts: { characterId: string; correct: boolean }[],
      now?: string,
    ) =>
      update((base) =>
        recordCharacterTrainingSession(base, {
          id,
          attempts,
          completedAt: now ?? new Date().toISOString(),
        }),
      ),
    [update],
  );
  const recoverStorage = useCallback(() => {
    if (!initialized.current) return false;
    // This overwrite is offered only as an explicit, clearly labelled user action.
    if (!replaceCharacterTrainingState(current.current)) {
      setMessage(UNSAVED_MESSAGE);
      return false;
    }
    unsaved.current = false;
    protectedData.current = false;
    setLoadStatus("loaded");
    setMessage(null);
    return true;
  }, []);

  return {
    state,
    ready,
    message,
    loadStatus,
    saveSettings,
    saveSession,
    recoverStorage,
  };
}

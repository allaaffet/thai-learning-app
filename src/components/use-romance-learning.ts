"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROMANCE_LEARNING_STORAGE_KEY,
  completeRomanceLearning,
  createEmptyRomanceLearning,
  loadRomanceLearning,
  replaceRomanceLearning,
  saveRomanceLearning,
  type JourneyLearningInput,
  type JourneyLearningReceipt,
  type RomanceLearningState,
  type RomanceLearningStatus,
} from "@/lib/romance-journey";

const INVALID_MESSAGE =
  "会話練習の保存記録を読み取れません。元データを保護し、このタブだけで続けます。保存を再開するには、新しい会話練習の記録だけを明示的に置き換えてください。";
const UNSAVED_MESSAGE =
  "会話練習の記録を保存できません。このタブでは続けられますが、閉じると今回の記録が失われます。";

/** The new activity ledger is independent from relationship progress and course XP. */
export function useRomanceLearning() {
  const [state, setState] = useState(createEmptyRomanceLearning);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<RomanceLearningStatus>("empty");
  const [message, setMessage] = useState<string | null>(null);
  const current = useRef<RomanceLearningState>(createEmptyRomanceLearning());
  const initialized = useRef(false);
  const unsaved = useRef(false);
  const protectedData = useRef(false);
  // Replay only unsaved local completions over a fresh disk read, rather than
  // overwriting another tab's independently completed routes or characters.
  const pending = useRef<JourneyLearningInput[]>([]);

  useEffect(() => {
    const loaded = loadRomanceLearning();
    current.current = loaded.state;
    initialized.current = true;
    protectedData.current = loaded.status === "invalid";
    // Read after hydration, without writing empty defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded.state);
    setReady(true);
    setStatus(loaded.status);
    setMessage(
      loaded.status === "invalid" ? INVALID_MESSAGE : (loaded.message ?? null),
    );

    function synchronize(event: StorageEvent) {
      if (event.key !== ROMANCE_LEARNING_STORAGE_KEY && event.key !== null)
        return;
      const loaded = loadRomanceLearning();
      if (loaded.status === "invalid") {
        protectedData.current = true;
        setStatus("invalid");
        setMessage(INVALID_MESSAGE);
      } else if (
        !unsaved.current &&
        (loaded.status === "loaded" || loaded.status === "empty")
      ) {
        current.current = loaded.state;
        protectedData.current = false;
        setState(loaded.state);
        setStatus(loaded.status);
        setMessage(null);
      }
    }
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);

  const finish = useCallback(
    (input: JourneyLearningInput): JourneyLearningReceipt | null => {
      if (!initialized.current) return null;
      const disk = loadRomanceLearning();
      if (disk.status === "invalid") protectedData.current = true;
      try {
        let base = current.current;
        if (
          !protectedData.current &&
          (disk.status === "loaded" || disk.status === "empty")
        ) {
          base = disk.state;
          for (const previous of pending.current)
            base = completeRomanceLearning(base, previous).state;
        }
        const recordedInput = {
          ...input,
          now: input.now ?? new Date().toISOString(),
        };
        const completion = completeRomanceLearning(base, recordedInput);
        if (
          !completion.receipt.applied &&
          !pending.current.length &&
          !unsaved.current
        ) {
          current.current = completion.state;
          setState(completion.state);
          return completion.receipt;
        }
        if (completion.receipt.applied) {
          // The timestamp and responses must remain the same if a later explicit
          // completion retries persistence after a denied localStorage write.
          pending.current.push({
            ...recordedInput,
            attempts: input.attempts.map((attempt) => ({
              ...attempt,
              response:
                attempt.response.kind === "build"
                  ? { kind: "build", wordIds: [...attempt.response.wordIds] }
                  : { ...attempt.response },
            })),
          });
        }
        current.current = completion.state;
        setState(completion.state);
        if (protectedData.current) {
          unsaved.current = true;
          setStatus("invalid");
          setMessage(INVALID_MESSAGE);
        } else if (saveRomanceLearning(completion.state)) {
          pending.current = [];
          unsaved.current = false;
          setStatus("loaded");
          setMessage(null);
        } else {
          unsaved.current = true;
          setStatus("unavailable");
          setMessage(UNSAVED_MESSAGE);
        }
        return completion.receipt;
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : "会話練習を記録できませんでした。",
        );
        return null;
      }
    },
    [],
  );

  const replaceSaved = useCallback(() => {
    if (!initialized.current) return false;
    if (!replaceRomanceLearning(current.current)) {
      setMessage(UNSAVED_MESSAGE);
      return false;
    }
    protectedData.current = false;
    unsaved.current = false;
    pending.current = [];
    setStatus("loaded");
    setMessage(null);
    return true;
  }, []);

  return { state, ready, status, message, finish, replaceSaved };
}

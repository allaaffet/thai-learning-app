"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONVERSATION_STORAGE_KEY,
  createEmptyConversationProgress,
  loadConversationProgress,
  recordConversationCompletion,
  replaceConversationProgress,
  saveConversationProgress,
} from "@/lib/conversation";

type Progress = ReturnType<typeof createEmptyConversationProgress>;
type Completion = Parameters<typeof recordConversationCompletion>[1];
type LoadStatus = ReturnType<typeof loadConversationProgress>["status"];

const UNSAVED_MESSAGE =
  "会話の練習記録を保存できません。このタブでは続けられますが、閉じると今回の記録が失われます。";
const INVALID_MESSAGE =
  "会話の保存データを読み取れません。元データを保護し、このタブだけで練習します。保存を再開するには、会話の保存記録を置き換えてください。";

/** Reading and practice never write storage. Only explicit completion records it. */
export function useConversations() {
  const [state, setState] = useState(createEmptyConversationProgress);
  const current = useRef<Progress>(createEmptyConversationProgress());
  const [ready, setReady] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("empty");
  const [message, setMessage] = useState<string | null>(null);
  const initialized = useRef(false);
  const unsaved = useRef(false);
  const protectedData = useRef(false);

  useEffect(() => {
    const loaded = loadConversationProgress();
    current.current = loaded.state;
    initialized.current = true;
    protectedData.current = loaded.status === "invalid";
    // Browser storage is external state; never save the empty SSR defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded.state);
    setReady(true);
    setLoadStatus(loaded.status);
    setMessage(
      loaded.status === "invalid" ? INVALID_MESSAGE : (loaded.message ?? null),
    );

    function syncOtherTab(event: StorageEvent) {
      if (event.key !== CONVERSATION_STORAGE_KEY && event.key !== null) return;
      const updated = loadConversationProgress();
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

  const complete = useCallback((completion: Completion) => {
    if (!initialized.current) return false;
    const disk = loadConversationProgress();
    if (disk.status === "invalid") protectedData.current = true;
    const base =
      !unsaved.current &&
      !protectedData.current &&
      (disk.status === "loaded" || disk.status === "empty")
        ? disk.state
        : current.current;
    let next: Progress;
    try {
      next = recordConversationCompletion(base, completion);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "会話の練習を記録できませんでした。",
      );
      return false;
    }
    current.current = next;
    setState(next);
    if (protectedData.current) {
      unsaved.current = true;
      setLoadStatus("invalid");
      setMessage(INVALID_MESSAGE);
    } else if (saveConversationProgress(next)) {
      unsaved.current = false;
      setLoadStatus("loaded");
      setMessage(null);
    } else {
      unsaved.current = true;
      setLoadStatus("unavailable");
      setMessage(UNSAVED_MESSAGE);
    }
    return true;
  }, []);

  const recoverStorage = useCallback(() => {
    if (!initialized.current) return false;
    if (!replaceConversationProgress(current.current)) {
      setMessage(UNSAVED_MESSAGE);
      return false;
    }
    unsaved.current = false;
    protectedData.current = false;
    setLoadStatus("loaded");
    setMessage(null);
    return true;
  }, []);

  return { state, ready, loadStatus, message, complete, recoverStorage };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  loadRomanceProgress,
  replaceRomanceProgress,
  saveRomanceProgress,
  setRomanceProfile,
  type RomanceEpisodeInput,
  type RomanceLoadStatus,
  type RomanceReceipt,
  type RomanceState,
} from "@/lib/romance";
import type { RomanceGender, RomancePreference } from "@/lib/romance-types";

import {
  createRomanceStoryStorage,
  romanceSettings,
  type RomanceSetting,
} from "@/lib/romance-setting";

const INVALID_MESSAGE =
  "物語の保存データを読み取れません。元データを保護し、このタブだけで続けます。保存を再開するには、物語の保存記録を明示的に置き換えてください。";
const UNSAVED_MESSAGE =
  "物語の記録を保存できません。このタブでは続けられますが、閉じると今回の記録が失われます。";

/** This route owns one independent local record; it never changes course XP. */
export function useRomance(setting: RomanceSetting = "city") {
  const storage = useMemo(() => createRomanceStoryStorage(setting), [setting]);
  const storageKey = romanceSettings[setting].relationshipKey;
  const [state, setState] = useState(createEmptyRomance);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<RomanceLoadStatus>("empty");
  const [message, setMessage] = useState<string | null>(null);
  const current = useRef<RomanceState>(createEmptyRomance());
  const initialized = useRef(false);
  const unsaved = useRef(false);
  const protectedData = useRef(false);
  // A failed local role change leaves the previous role on disk. Keep that
  // baseline so it is not mistaken for a later change made by another tab.
  const persistedGender = useRef<RomanceGender | null | undefined>(undefined);

  useEffect(() => {
    const loaded = loadRomanceProgress(storage);
    current.current = loaded.state;
    initialized.current = true;
    protectedData.current = loaded.status === "invalid";
    if (loaded.status === "loaded" || loaded.status === "empty")
      persistedGender.current = loaded.state.profile?.gender ?? null;
    // Read after hydration and never write empty defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded.state);
    setReady(true);
    setStatus(loaded.status);
    setMessage(
      loaded.status === "invalid" ? INVALID_MESSAGE : (loaded.message ?? null),
    );
    function synchronize(event: StorageEvent) {
      if (event.key !== storageKey && event.key !== null) return;
      const next = loadRomanceProgress(storage);
      if (next.status === "invalid") {
        protectedData.current = true;
        setStatus("invalid");
        setMessage(INVALID_MESSAGE);
      } else if (
        !unsaved.current &&
        (next.status === "loaded" || next.status === "empty")
      ) {
        current.current = next.state;
        persistedGender.current = next.state.profile?.gender ?? null;
        protectedData.current = false;
        setState(next.state);
        setStatus(next.status);
        setMessage(null);
      }
    }
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [storage, storageKey]);

  const save = useCallback(
    (next: RomanceState) => {
      current.current = next;
      setState(next);
      if (protectedData.current) {
        unsaved.current = true;
        setStatus("invalid");
        setMessage(INVALID_MESSAGE);
      } else if (saveRomanceProgress(next, storage)) {
        unsaved.current = false;
        persistedGender.current = next.profile?.gender ?? null;
        setStatus("loaded");
        setMessage(null);
      } else {
        unsaved.current = true;
        setStatus("unavailable");
        setMessage(UNSAVED_MESSAGE);
      }
    },
    [storage],
  );

  const saveProfile = useCallback(
    (gender: RomanceGender, preference: RomancePreference) => {
      if (!initialized.current) return false;
      const disk = loadRomanceProgress(storage);
      if (disk.status === "invalid") protectedData.current = true;
      if (disk.status === "loaded" || disk.status === "empty")
        persistedGender.current = disk.state.profile?.gender ?? null;
      const base =
        !unsaved.current &&
        !protectedData.current &&
        (disk.status === "loaded" || disk.status === "empty")
          ? disk.state
          : current.current;
      try {
        save(setRomanceProfile(base, gender, preference));
        return true;
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : "主人公の設定を記録できませんでした。",
        );
        return false;
      }
    },
    [save, storage],
  );

  const finishEpisode = useCallback(
    (input: RomanceEpisodeInput): RomanceReceipt | null => {
      if (!initialized.current) return null;
      const disk = loadRomanceProgress(storage);
      if (disk.status === "invalid") protectedData.current = true;
      // A different tab's role change must not award the now-ineligible partner.
      if (
        disk.status === "loaded" &&
        disk.state.profile?.gender !== current.current.profile?.gender &&
        (!unsaved.current ||
          disk.state.profile?.gender !== persistedGender.current)
      ) {
        setMessage(
          "別のタブで主人公の設定が変わりました。相手を選び直すか、画面を再読み込みしてください。",
        );
        if (!unsaved.current) {
          current.current = disk.state;
          persistedGender.current = disk.state.profile?.gender ?? null;
          setState(disk.state);
        }
        return null;
      }
      const base =
        !unsaved.current &&
        !protectedData.current &&
        (disk.status === "loaded" || disk.status === "empty")
          ? disk.state
          : current.current;
      try {
        const completion = completeRomanceEpisode(base, input);
        if (completion.receipt.applied) save(completion.state);
        return completion.receipt;
      } catch (caught) {
        setMessage(
          caught instanceof Error
            ? caught.message
            : "会話を記録できませんでした。",
        );
        return null;
      }
    },
    [save, storage],
  );

  const replaceSaved = useCallback(() => {
    if (!initialized.current) return false;
    if (!replaceRomanceProgress(current.current, storage)) {
      setMessage(UNSAVED_MESSAGE);
      return false;
    }
    unsaved.current = false;
    protectedData.current = false;
    persistedGender.current = current.current.profile?.gender ?? null;
    setStatus("loaded");
    setMessage(null);
    return true;
  }, [storage]);

  return {
    state,
    ready,
    status,
    message,
    saveProfile,
    finishEpisode,
    replaceSaved,
  };
}

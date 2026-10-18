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
import { usePathname } from "next/navigation";
import { audioFocus } from "@/lib/audio-focus";
import {
  getBrowserSoundEffectsPlayer,
  type SoundEffect,
} from "@/lib/sound-effects";
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_KEY,
  loadSoundPreferences,
  saveSoundPreferences,
  type SoundPreferences,
} from "@/lib/sound-preferences";

interface SoundEffectsValue {
  preferences: SoundPreferences;
  ready: boolean;
  supported: boolean;
  message: string | null;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  playEffect: (effect: SoundEffect) => void;
}
const SoundEffectsContext = createContext<SoundEffectsValue | null>(null);

export function SoundEffectsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<SoundPreferences>(
    DEFAULT_SOUND_PREFERENCES,
  );
  const current = useRef<SoundPreferences>(DEFAULT_SOUND_PREFERENCES);
  const player =
    useRef<ReturnType<typeof getBrowserSoundEffectsPlayer>>(undefined);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const unsaved = useRef(false);
  useEffect(() => {
    let mounted = true;
    const instance = getBrowserSoundEffectsPlayer({
      isBlocked: () => audioFocus.isBusy(),
      onError: () => {
        if (mounted)
          setMessage(
            "効果音を再生できませんでした。音を使わずに学習を続けられます。",
          );
      },
    });
    player.current = instance;
    const loaded = loadSoundPreferences();
    current.current = loaded.preferences;
    queueMicrotask(() => {
      if (!mounted) return;
      setPreferences(loaded.preferences);
      setReady(true);
      setSupported(Boolean(instance));
      if (loaded.status === "unavailable")
        setMessage(
          "効果音の設定を読み込めません。このタブでは切り替えられます。",
        );
      else if (loaded.status === "invalid")
        setMessage(
          "保存された効果音の設定を確認できないため、初期設定を使います。",
        );
    });
    const unsubscribe = audioFocus.subscribe(() => {
      if (audioFocus.isBusy()) instance?.stop();
    });
    const stop = () => instance?.stop();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        (event.key !== SOUND_PREFERENCES_KEY && event.key !== null) ||
        unsaved.current
      )
        return;
      const next = loadSoundPreferences();
      if (next.status === "saved" || next.status === "default") {
        current.current = next.preferences;
        setPreferences(next.preferences);
        stop();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      unsubscribe();
      instance?.dispose();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    player.current?.stop();
  }, [pathname]);
  const update = useCallback((next: SoundPreferences) => {
    current.current = next;
    setPreferences(next);
    player.current?.stop();
    const saved = saveSoundPreferences(next);
    unsaved.current = !saved;
    setMessage(
      saved
        ? null
        : "効果音の設定を保存できませんでした。このタブでは変更を使えます。",
    );
  }, []);
  const setEnabled = useCallback(
    (enabled: boolean) => update({ ...current.current, enabled }),
    [update],
  );
  const setVolume = useCallback(
    (volume: number) => {
      if (Number.isFinite(volume))
        update({
          ...current.current,
          volume: Math.min(1, Math.max(0, volume)),
        });
    },
    [update],
  );
  const playEffect = useCallback((effect: SoundEffect) => {
    const value = current.current;
    if (value.enabled && value.volume > 0 && !audioFocus.isBusy())
      player.current?.play(effect, value.volume);
  }, []);
  return (
    <SoundEffectsContext.Provider
      value={{
        preferences,
        ready,
        supported,
        message,
        setEnabled,
        setVolume,
        playEffect,
      }}
    >
      {children}
    </SoundEffectsContext.Provider>
  );
}

export function useSoundEffects() {
  const context = useContext(SoundEffectsContext);
  if (!context) throw new Error("SoundEffectsProvider が必要です。");
  return context;
}

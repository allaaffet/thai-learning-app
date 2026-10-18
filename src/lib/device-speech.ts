import { audioFocus, type AudioFocus } from "./audio-focus";

/** Thai speech is an optional device capability, never a native recording. */
export interface SpeechVoice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}
export interface SpeechEvents {
  start: () => void;
  end: () => void;
  error: (reason: string) => void;
}
export interface SpeechBackend {
  voices: () => readonly SpeechVoice[];
  subscribe: (listener: () => void) => () => void;
  speak: (text: string, voice: SpeechVoice, events: SpeechEvents) => void;
  cancel: () => void;
}
export interface SpeechCallbacks {
  start: () => void;
  complete: () => void;
  cancel: () => void;
  error: (message: string) => void;
}

/** Spelling diagrams and placeholders must not be read as model words. */
export function isThaiSpeechText(text: string): boolean {
  return (
    text.length <= 200 &&
    /[\u0e01-\u0e2e]/u.test(text) &&
    /^[\u0e01-\u0e3a\u0e40-\u0e4e\s]+$/u.test(text)
  );
}

export function isThaiVoice(voice: SpeechVoice): boolean {
  const lang = voice.lang.toLowerCase().replaceAll("_", "-");
  return lang === "th" || lang.startsWith("th-");
}
export function selectThaiVoice(
  voices: readonly SpeechVoice[],
): SpeechVoice | undefined {
  const thai = voices.filter(isThaiVoice);
  return thai.find((voice) => voice.localService) ?? thai[0];
}

/** Own playback by component: navigation cancels only that component's voice. */
export function createSpeechController(
  backend: SpeechBackend,
  focus: AudioFocus = audioFocus,
) {
  let active:
    | {
        owner: string;
        token: symbol;
        callbacks: SpeechCallbacks;
        releaseFocus: () => void;
        timer?: ReturnType<typeof setTimeout>;
      }
    | undefined;
  function finish(kind: "complete" | "cancel" | "error", message = "") {
    const previous = active;
    active = undefined; // Ignore synchronous/delayed browser events after cancel.
    if (!previous) return;
    clearTimeout(previous.timer);
    if (kind !== "complete") {
      try {
        backend.cancel();
      } catch {
        /* The session is already invalidated. */
      }
    }
    previous.releaseFocus();
    if (kind === "error") previous.callbacks.error(message);
    else previous.callbacks[kind]();
  }
  return {
    backend,
    play(
      owner: string,
      text: string,
      voice: SpeechVoice,
      callbacks: SpeechCallbacks,
    ) {
      if (!text.trim() || text.length > 200 || !isThaiVoice(voice)) {
        callbacks.error("タイ語の音声と対応する短いテキストが必要です。");
        return;
      }
      finish("cancel");
      const token = Symbol(owner);
      active = { owner, token, callbacks, releaseFocus: focus.acquire() };
      active.timer = setTimeout(() => {
        if (active?.token === token)
          finish(
            "error",
            "合成音声の再生を確認できませんでした。端末の音声設定や接続を確認してください。",
          );
      }, 30_000);
      try {
        backend.speak(text, voice, {
          start: () => {
            if (active?.token === token) callbacks.start();
          },
          end: () => {
            if (active?.token === token) finish("complete");
          },
          error: () => {
            if (active?.token === token)
              finish(
                "error",
                "合成音声を再生できませんでした。別のブラウザや端末の音声設定を確認してください。",
              );
          },
        });
      } catch {
        if (active?.token === token)
          finish("error", "この端末では合成音声を開始できませんでした。");
      }
    },
    stop(owner: string) {
      if (active?.owner === owner) finish("cancel");
    },
    /** Cancel this app's model playback before opening a microphone. */
    stopAll() {
      finish("cancel");
    },
  };
}
export type SpeechController = ReturnType<typeof createSpeechController>;
let cachedController: SpeechController | undefined;

export function getBrowserSpeechController(): SpeechController | undefined {
  if (typeof window === "undefined") return undefined;
  if (cachedController) return cachedController;
  try {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    )
      return undefined;
    const synthesis = window.speechSynthesis;
    if (!synthesis || typeof synthesis.getVoices !== "function")
      return undefined;
    cachedController = createSpeechController({
      voices: () => synthesis.getVoices(),
      subscribe(listener) {
        synthesis.addEventListener("voiceschanged", listener);
        return () => synthesis.removeEventListener("voiceschanged", listener);
      },
      speak(text, voice, events) {
        const nativeVoice = synthesis
          .getVoices()
          .find(
            (item) =>
              item.voiceURI === voice.voiceURI &&
              item.lang === voice.lang &&
              isThaiVoice(item),
          );
        if (!nativeVoice) throw new Error("Thai voice is no longer available");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = nativeVoice;
        utterance.lang = nativeVoice.lang;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onstart = events.start;
        utterance.onend = events.end;
        utterance.onerror = () => events.error("speech-error");
        synthesis.speak(utterance);
      },
      cancel: () => synthesis.cancel(),
    });
    return cachedController;
  } catch {
    return undefined;
  }
}

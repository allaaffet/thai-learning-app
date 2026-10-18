/** Original, short interface tones. These are not Thai model speech. */
export type SoundEffect =
  | "correct"
  | "incorrect"
  | "lesson-complete"
  | "review-complete";

export interface SoundEffectTone {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
}

export interface SoundEffectVoice {
  stop: () => void;
  disconnect: () => void;
}

/** Narrow adapter keeps Web Audio and playback cancellation independently testable. */
export interface SoundEffectsContext {
  readonly state: string;
  readonly currentTime: number;
  resume: () => Promise<void>;
  close: () => Promise<void>;
  scheduleTone: (tone: SoundEffectTone) => SoundEffectVoice;
}

export interface SoundEffectsPlayerOptions {
  isBlocked?: () => boolean;
  onError?: (message: string) => void;
  createContext?: () => SoundEffectsContext | undefined;
}

const notes: Record<
  SoundEffect,
  ReadonlyArray<Readonly<Omit<SoundEffectTone, "gain">>>
> = {
  correct: [
    { frequency: 659.25, start: 0, duration: 0.095 },
    { frequency: 880, start: 0.115, duration: 0.115 },
  ],
  incorrect: [
    { frequency: 392, start: 0, duration: 0.08 },
    { frequency: 329.63, start: 0.1, duration: 0.08 },
  ],
  "lesson-complete": [
    { frequency: 523.25, start: 0, duration: 0.15 },
    { frequency: 659.25, start: 0.18, duration: 0.15 },
    { frequency: 783.99, start: 0.36, duration: 0.17 },
  ],
  "review-complete": [
    { frequency: 659.25, start: 0, duration: 0.14 },
    { frequency: 783.99, start: 0.17, duration: 0.14 },
  ],
};

function isSoundEffect(value: unknown): value is SoundEffect {
  return (
    value === "correct" ||
    value === "incorrect" ||
    value === "lesson-complete" ||
    value === "review-complete"
  );
}

function createBrowserContext(): SoundEffectsContext | undefined {
  if (
    typeof window === "undefined" ||
    typeof window.AudioContext !== "function"
  )
    return undefined;
  const context = new window.AudioContext();
  return {
    get state() {
      return context.state;
    },
    get currentTime() {
      return context.currentTime;
    },
    resume: () => context.resume(),
    close: () => context.close(),
    scheduleTone(tone) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      let stopped = false;
      let disconnected = false;
      const disconnect = () => {
        if (disconnected) return;
        disconnected = true;
        oscillator.onended = null;
        try {
          oscillator.disconnect();
        } catch {
          /* A browser may have disconnected an ended source. */
        }
        try {
          envelope.disconnect();
        } catch {
          /* Continue releasing the other resources. */
        }
      };
      try {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, tone.start);
        envelope.gain.setValueAtTime(0, tone.start);
        envelope.gain.linearRampToValueAtTime(tone.gain, tone.start + 0.008);
        envelope.gain.linearRampToValueAtTime(0, tone.start + tone.duration);
        oscillator.connect(envelope);
        envelope.connect(context.destination);
        oscillator.onended = disconnect;
        oscillator.start(tone.start);
        oscillator.stop(tone.start + tone.duration);
      } catch (error) {
        try {
          oscillator.stop();
        } catch {
          /* It may not have started. */
        }
        disconnect();
        throw error;
      }
      return {
        stop() {
          if (stopped) return;
          stopped = true;
          // Cancel future gain changes before silencing and releasing the source.
          try {
            const now = context.currentTime;
            envelope.gain.cancelScheduledValues(now);
            envelope.gain.setValueAtTime(0, now);
            oscillator.stop(now);
          } catch {
            /* Stopping an already ended source is harmless. */
          }
        },
        disconnect,
      };
    },
  };
}

/** The caller starts playback only from a user action, never while mounting. */
export function createSoundEffectsPlayer(
  options: SoundEffectsPlayerOptions = {},
) {
  let context: SoundEffectsContext | undefined;
  let disposed = false;
  let active:
    | {
        token: symbol;
        voices: SoundEffectVoice[];
        timer?: ReturnType<typeof setTimeout>;
      }
    | undefined;

  function stop() {
    const previous = active;
    active = undefined;
    if (!previous) return;
    clearTimeout(previous.timer);
    for (const voice of previous.voices) {
      try {
        voice.stop();
      } catch {
        /* Cleanup must never interrupt learning. */
      }
      try {
        voice.disconnect();
      } catch {
        /* Continue releasing all sources. */
      }
    }
  }

  function report(message: string) {
    try {
      options.onError?.(message);
    } catch {
      /* An optional status callback cannot break learning. */
    }
  }

  function blocked() {
    try {
      return options.isBlocked?.() ?? false;
    } catch {
      return true;
    }
  }

  async function start(kind: SoundEffect, volume: number, token: symbol) {
    try {
      if (!context || context.state === "closed")
        context = (options.createContext ?? createBrowserContext)();
      const target = context;
      if (!target) {
        if (active?.token === token) {
          stop();
          report(
            "このブラウザでは効果音を再生できません。学習はそのまま続けられます。",
          );
        }
        return;
      }
      if (target.state !== "running") await target.resume();
      if (disposed || active?.token !== token) return;
      if (blocked()) {
        stop();
        return;
      }
      if (target.state !== "running")
        throw new Error("Audio context did not resume");
      const session = active;
      const base = target.currentTime + 0.008;
      const sequence = notes[kind];
      for (const note of sequence) {
        session.voices.push(
          target.scheduleTone({
            ...note,
            start: base + note.start,
            gain: 0.12 * volume,
          }),
        );
      }
      const end = Math.max(
        ...sequence.map((note) => note.start + note.duration),
      );
      session.timer = setTimeout(
        () => {
          if (active?.token === token) stop();
        },
        Math.ceil((end + 0.15) * 1000),
      );
    } catch {
      if (active?.token === token) {
        stop();
        report("効果音を開始できませんでした。学習はそのまま続けられます。");
      }
    }
  }

  return {
    play(kind: SoundEffect, volume: number) {
      if (disposed) return;
      stop();
      if (
        !isSoundEffect(kind) ||
        typeof volume !== "number" ||
        !Number.isFinite(volume)
      )
        return;
      const level = Math.max(0, Math.min(1, volume));
      if (level === 0 || blocked()) return;
      const token = Symbol(kind);
      active = { token, voices: [] };
      void start(kind, level, token);
    },
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      const previous = context;
      context = undefined;
      if (previous && previous.state !== "closed") {
        try {
          void previous.close().catch(() => {
            /* Closing is best effort after invalidation. */
          });
        } catch {
          /* Unsupported close cannot revive playback. */
        }
      }
    },
  };
}

export type SoundEffectsPlayer = ReturnType<typeof createSoundEffectsPlayer>;

/** Capability checking does not create or resume an AudioContext. */
export function getBrowserSoundEffectsPlayer(
  options: SoundEffectsPlayerOptions = {},
): SoundEffectsPlayer | undefined {
  if (
    typeof window === "undefined" ||
    typeof window.AudioContext !== "function"
  )
    return undefined;
  return createSoundEffectsPlayer(options);
}

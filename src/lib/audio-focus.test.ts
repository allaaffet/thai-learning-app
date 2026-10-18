import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioFocus } from "./audio-focus";
import {
  createSpeechController,
  type SpeechEvents,
  type SpeechVoice,
} from "./device-speech";
import {
  createMicrophoneRecorder,
  type MicrophoneStream,
  type RecordingCallbacks,
} from "./microphone-recorder";
import { createBrowserRecognitionSession } from "./speech-recognition";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("learning audio focus", () => {
  it("notifies synchronously and stays busy until every owner releases once", () => {
    const focus = createAudioFocus();
    const changes: boolean[] = [];
    const unsubscribe = focus.subscribe(() => changes.push(focus.isBusy()));
    const one = focus.acquire();
    expect(changes).toEqual([true]);
    const two = focus.acquire();
    one();
    one();
    expect(focus.isBusy()).toBe(true);
    expect(changes).toEqual([true]);
    two();
    expect(changes).toEqual([true, false]);
    unsubscribe();
    const three = focus.acquire();
    three();
    expect(changes).toEqual([true, false]);
  });

  it("a failed optional sound subscriber cannot prevent acquisition or release", () => {
    const focus = createAudioFocus();
    focus.subscribe(() => {
      throw new Error("sound unavailable");
    });
    const observed = vi.fn();
    focus.subscribe(observed);
    const release = focus.acquire();
    expect(focus.isBusy()).toBe(true);
    expect(release).not.toThrow();
    expect(focus.isBusy()).toBe(false);
    expect(observed).toHaveBeenCalledTimes(2);
  });
});

const thai: SpeechVoice = {
  name: "Thai test voice",
  lang: "th-TH",
  voiceURI: "test-thai",
  localService: true,
  default: false,
};

function speechFixture() {
  const focus = createAudioFocus();
  const events: SpeechEvents[] = [];
  const callbacks = {
    start: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
  };
  const speak = vi.fn(
    (_text: string, _voice: SpeechVoice, next: SpeechEvents) => {
      expect(focus.isBusy()).toBe(true);
      events.push(next);
    },
  );
  const controller = createSpeechController(
    {
      voices: () => [thai],
      subscribe: () => () => undefined,
      speak,
      cancel: vi.fn(),
    },
    focus,
  );
  return { focus, controller, events, callbacks, speak };
}

describe("model speech focus", () => {
  it.each(["complete", "cancel", "error", "timeout", "throw"] as const)(
    "releases before %s feedback and never leaks a busy owner",
    (kind) => {
      vi.useFakeTimers();
      const f = speechFixture();
      const done = vi.fn(() => expect(f.focus.isBusy()).toBe(false));
      f.callbacks.complete = done;
      f.callbacks.cancel = done;
      f.callbacks.error = done;
      if (kind === "throw")
        f.speak.mockImplementation(() => {
          throw new Error("device failure");
        });
      f.controller.play("model", "กา", thai, f.callbacks);
      if (kind === "complete") f.events[0].end();
      if (kind === "cancel") f.controller.stopAll();
      if (kind === "error") f.events[0].error("device failure");
      if (kind === "timeout") vi.advanceTimersByTime(30_000);
      expect(f.focus.isBusy()).toBe(false);
      expect(done).toHaveBeenCalledOnce();
      f.events[0]?.end();
      f.controller.stopAll();
      expect(done).toHaveBeenCalledOnce();
    },
  );

  it("an old replaced speech event cannot release its replacement", () => {
    const f = speechFixture();
    f.controller.play("one", "กา", thai, f.callbacks);
    f.controller.play("two", "ขา", thai, f.callbacks);
    f.events[0].end();
    expect(f.focus.isBusy()).toBe(true);
    f.events[1].end();
    expect(f.focus.isBusy()).toBe(false);
  });
});

function microphoneFixture() {
  const focus = createAudioFocus();
  let events: RecordingCallbacks | undefined;
  let recorderState = "inactive";
  const trackStop = vi.fn();
  const stream: MicrophoneStream = {
    getTracks: () => [{ stop: trackStop }],
    createRecorder(next) {
      events = next;
      return {
        get state() {
          return recorderState;
        },
        mimeType: "audio/webm",
        start: () => {
          recorderState = "recording";
        },
        stop: () => {
          recorderState = "inactive";
        },
        detach: vi.fn(),
      };
    },
  };
  const request = vi.fn(async () => stream);
  const controller = createMicrophoneRecorder(
    {
      request,
      createUrl: () => "blob:test-clip",
      revokeUrl: vi.fn(),
    },
    vi.fn(),
    focus,
  );
  return {
    focus,
    controller,
    request,
    stream,
    trackStop,
    events: () => events,
  };
}

describe("microphone focus", () => {
  it("covers pending permission, recording and final data then releases", async () => {
    const f = microphoneFixture();
    const starting = f.controller.start();
    expect(f.focus.isBusy()).toBe(true);
    await starting;
    f.events()?.data(new Blob(["recorded words"]));
    f.controller.stop();
    expect(f.focus.isBusy()).toBe(true);
    f.events()?.stop();
    expect(f.focus.isBusy()).toBe(false);
    f.controller.dispose();
  });

  it("releases a cancelled permission request and closes the late stream", async () => {
    const f = microphoneFixture();
    let resolve: ((stream: MicrophoneStream) => void) | undefined;
    f.request.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = f.controller.start();
    expect(f.focus.isBusy()).toBe(true);
    f.controller.reset();
    expect(f.focus.isBusy()).toBe(false);
    resolve?.(f.stream);
    await pending;
    expect(f.trackStop).toHaveBeenCalledOnce();
    expect(f.focus.isBusy()).toBe(false);
    f.controller.dispose();
  });

  it.each(["permission", "recorder", "timeout", "dispose"])(
    "releases after %s failure or cleanup",
    async (kind) => {
      vi.useFakeTimers();
      const f = microphoneFixture();
      if (kind === "permission")
        f.request.mockRejectedValue(
          new DOMException("Denied", "NotAllowedError"),
        );
      await f.controller.start();
      if (kind === "recorder") f.events()?.error();
      if (kind === "timeout") {
        f.controller.stop();
        vi.advanceTimersByTime(3_000);
      }
      if (kind === "dispose") f.controller.dispose();
      expect(f.focus.isBusy()).toBe(false);
      f.controller.dispose();
    },
  );
});

class Recognition {
  static instance: Recognition | undefined;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  constructor() {
    Recognition.instance = this;
  }
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

describe("recognition focus", () => {
  it.each(["result", "error", "end", "stop", "dispose", "timeout"])(
    "releases a pending recognition on %s",
    (kind) => {
      vi.useFakeTimers();
      vi.stubGlobal("window", { SpeechRecognition: Recognition });
      const focus = createAudioFocus();
      const callbacks = {
        onTranscript: vi.fn(() => expect(focus.isBusy()).toBe(false)),
        onStatus: vi.fn(),
        onError: vi.fn(() => expect(focus.isBusy()).toBe(false)),
      };
      const session = createBrowserRecognitionSession(callbacks, focus);
      session?.start();
      expect(focus.isBusy()).toBe(true);
      const recognition = Recognition.instance;
      if (kind === "result")
        recognition?.onresult?.({
          resultIndex: 0,
          results: { length: 1, 0: { isFinal: true, 0: { transcript: "กา" } } },
        });
      if (kind === "error") recognition?.onerror?.({ error: "not-allowed" });
      if (kind === "end") recognition?.onend?.();
      if (kind === "stop") session?.stop();
      if (kind === "dispose") session?.dispose();
      if (kind === "timeout") vi.advanceTimersByTime(9_000);
      expect(focus.isBusy()).toBe(false);
      session?.dispose();
    },
  );

  it.each(["constructor", "start"])(
    "releases when the API fails at %s",
    (kind) => {
      const focus = createAudioFocus();
      class FailedRecognition extends Recognition {
        constructor() {
          super();
          if (kind === "constructor")
            throw new Error("constructor unavailable");
        }
        start = vi.fn(() => {
          throw new Error("start unavailable");
        });
      }
      vi.stubGlobal("window", { SpeechRecognition: FailedRecognition });
      const onError = vi.fn(() => expect(focus.isBusy()).toBe(false));
      const session = createBrowserRecognitionSession(
        {
          onTranscript: vi.fn(),
          onStatus: vi.fn(),
          onError,
        },
        focus,
      );
      session?.start();
      expect(focus.isBusy()).toBe(false);
      expect(onError).toHaveBeenCalledOnce();
      session?.dispose();
    },
  );
});

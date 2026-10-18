import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseRecordingMimeType,
  createMicrophoneRecorder,
  getBrowserMicrophoneBackend,
  MAX_RECORDING_BYTES,
  MAX_RECORDING_SECONDS,
  microphoneErrorMessage,
  type MicrophoneBackend,
  type MicrophoneRecording,
  type MicrophoneStream,
  type RecordingCallbacks,
  type RecordingSnapshot,
} from "./microphone-recorder";

function fixture() {
  let callbacks: RecordingCallbacks | undefined;
  let recorderState = "inactive";
  const trackStops = [vi.fn(), vi.fn()];
  const start = vi.fn(() => {
    recorderState = "recording";
  });
  const stop = vi.fn(() => {
    recorderState = "inactive";
  });
  const detach = vi.fn();
  const recording: MicrophoneRecording = {
    get state() {
      return recorderState;
    },
    mimeType: "audio/webm",
    start,
    stop,
    detach,
  };
  const stream: MicrophoneStream = {
    getTracks: () => trackStops.map((stop) => ({ stop })),
    createRecorder: vi.fn((events: RecordingCallbacks) => {
      callbacks = events;
      return recording;
    }),
  };
  const request = vi.fn(async () => stream);
  const createUrl = vi.fn<(blob: Blob) => string>(() => "blob:own-recording");
  const revokeUrl = vi.fn();
  const backend: MicrophoneBackend = { request, createUrl, revokeUrl };
  const changes: RecordingSnapshot[] = [];
  const controller = createMicrophoneRecorder(backend, (state) =>
    changes.push(state),
  );
  function data(text = "sample") {
    callbacks?.data(new Blob([text], { type: "audio/webm" }));
  }
  function end() {
    callbacks?.stop();
  }
  return {
    controller,
    stream,
    request,
    createUrl,
    revokeUrl,
    changes,
    start,
    stop,
    detach,
    trackStops,
    data,
    end,
    callbacks: () => callbacks,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("short local microphone recording", () => {
  it("does not request permission before an explicit start", () => {
    const f = fixture();
    expect(f.controller.getSnapshot().status).toBe("idle");
    expect(f.request).not.toHaveBeenCalled();
    f.controller.dispose();
  });

  it("records real chunks, stops every track, then exposes one playable URL", async () => {
    const f = fixture();
    const starting = f.controller.start();
    expect(f.controller.getSnapshot().status).toBe("requesting");
    await starting;
    expect(f.start).toHaveBeenCalledWith(250);
    expect(f.controller.getSnapshot().status).toBe("recording");
    f.data("first");
    f.data("second");
    f.controller.stop();
    expect(f.controller.getSnapshot().status).toBe("stopping");
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    expect(f.createUrl).not.toHaveBeenCalled();
    f.end();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "recorded",
      audioUrl: "blob:own-recording",
    });
    const blob = f.createUrl.mock.calls[0]?.[0];
    expect(blob?.type).toBe("audio/webm");
    expect(await blob?.text()).toBe("firstsecond");
    expect(f.detach).toHaveBeenCalledTimes(1);
    f.controller.dispose();
    expect(f.revokeUrl).toHaveBeenCalledWith("blob:own-recording");
  });

  it("ignores rapid repeated starts and stops", async () => {
    const f = fixture();
    const first = f.controller.start();
    await f.controller.start();
    await first;
    await f.controller.start();
    expect(f.request).toHaveBeenCalledTimes(1);
    f.controller.stop();
    f.controller.stop();
    expect(f.stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("stops a late permission stream after disposal without updating the UI", async () => {
    const f = fixture();
    let resolve: ((stream: MicrophoneStream) => void) | undefined;
    f.request.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = f.controller.start();
    f.controller.dispose();
    const count = f.changes.length;
    resolve?.(f.stream);
    await starting;
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    expect(f.start).not.toHaveBeenCalled();
    expect(f.changes).toHaveLength(count);
  });

  it("cancels a pending request and permits a newer request without reviving the old one", async () => {
    const f = fixture();
    let resolve: ((stream: MicrophoneStream) => void) | undefined;
    f.request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = f.controller.start();
    f.controller.stop();
    expect(f.controller.getSnapshot().status).toBe("idle");
    await f.controller.start();
    resolve?.(f.stream);
    await first;
    expect(f.start).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().status).toBe("recording");
    f.controller.dispose();
  });

  it.each([
    "NotAllowedError",
    "NotFoundError",
    "NotReadableError",
    "SecurityError",
    "UnknownError",
  ])("handles %s without creating a recording", async (name) => {
    const f = fixture();
    f.request.mockRejectedValue({ name });
    await f.controller.start();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "error",
      message: microphoneErrorMessage({ name }),
    });
    expect(f.createUrl).not.toHaveBeenCalled();
    f.controller.dispose();
  });

  it("releases tracks when constructing or starting a recorder fails", async () => {
    const f = fixture();
    f.start.mockImplementation(() => {
      throw new Error("unsupported format");
    });
    await f.controller.start();
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().status).toBe("error");
    expect(f.detach).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("releases streams if recorder construction fails", async () => {
    const f = fixture();
    f.stream.createRecorder = () => {
      throw new Error("no recorder");
    };
    await f.controller.start();
    expect(f.controller.getSnapshot().status).toBe("error");
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("releases streams if stopping the recorder throws", async () => {
    const f = fixture();
    f.stop.mockImplementation(() => {
      throw new Error("lost recorder");
    });
    await f.controller.start();
    f.controller.stop();
    expect(f.controller.getSnapshot().status).toBe("error");
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("releases all tracks even if stopping one throws", async () => {
    const f = fixture();
    f.trackStops[0].mockImplementation(() => {
      throw new Error("disconnected");
    });
    await f.controller.start();
    f.controller.dispose();
    expect(f.trackStops[1]).toHaveBeenCalledTimes(1);
  });

  it("automatically stops at 20 seconds, then keeps the recorded clip", async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.controller.start();
    f.data();
    vi.advanceTimersByTime(MAX_RECORDING_SECONDS * 1000 - 1);
    expect(f.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f.stop).toHaveBeenCalledTimes(1);
    f.end();
    expect(f.controller.getSnapshot().message).toContain("20秒");
    vi.advanceTimersByTime(10_000);
    expect(f.controller.getSnapshot().status).toBe("recorded");
    f.controller.dispose();
  });

  it("discards an oversized clip and ignores all late recorder events", async () => {
    const f = fixture();
    await f.controller.start();
    const callbacks = f.callbacks();
    callbacks?.data(new Blob([new Uint8Array(MAX_RECORDING_BYTES)]));
    expect(f.controller.getSnapshot().status).toBe("recording");
    f.data("overflow");
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "error",
      message: expect.stringContaining("5MB"),
    });
    callbacks?.data(new Blob(["late"]));
    callbacks?.stop();
    callbacks?.error();
    expect(f.createUrl).not.toHaveBeenCalled();
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("handles a recorder error and never retains a partial clip", async () => {
    const f = fixture();
    await f.controller.start();
    f.data();
    f.callbacks()?.error();
    expect(f.controller.getSnapshot().status).toBe("error");
    expect(f.createUrl).not.toHaveBeenCalled();
    f.end();
    expect(f.createUrl).not.toHaveBeenCalled();
    f.controller.dispose();
  });

  it("reports empty output rather than inventing recorded audio", async () => {
    const f = fixture();
    await f.controller.start();
    f.controller.stop();
    f.end();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "error",
      message: expect.stringContaining("録音データを取得できません"),
    });
    expect(f.createUrl).not.toHaveBeenCalled();
    f.controller.dispose();
  });

  it("ends a recorder that never acknowledges stop", async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.controller.start();
    f.controller.stop();
    vi.advanceTimersByTime(3000);
    expect(f.controller.getSnapshot().status).toBe("error");
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });

  it("revokes clips on deletion, replacement and dispose, each exactly once", async () => {
    const f = fixture();
    await f.controller.start();
    f.data();
    f.controller.stop();
    f.end();
    f.controller.reset();
    expect(f.revokeUrl).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().audioUrl).toBeUndefined();
    await f.controller.start();
    f.data();
    f.controller.stop();
    f.end();
    await f.controller.start();
    expect(f.revokeUrl).toHaveBeenCalledTimes(2);
    f.data();
    f.controller.stop();
    f.end();
    f.controller.dispose();
    f.controller.dispose();
    expect(f.revokeUrl).toHaveBeenCalledTimes(3);
  });

  it("handles failure to create a playback URL and frees the microphone", async () => {
    const f = fixture();
    f.createUrl.mockImplementation(() => {
      throw new Error("no URL");
    });
    await f.controller.start();
    f.data();
    f.controller.stop();
    f.end();
    expect(f.controller.getSnapshot().status).toBe("error");
    for (const stop of f.trackStops) expect(stop).toHaveBeenCalledTimes(1);
    f.controller.dispose();
  });
});

describe("browser recording capabilities", () => {
  it("is safe to call during server rendering", () => {
    expect(getBrowserMicrophoneBackend()).toEqual({
      error: "録音はブラウザで利用できます。",
    });
  });
  it("requires HTTPS or localhost without attempting to use a microphone", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    expect(getBrowserMicrophoneBackend()).toEqual({
      error: expect.stringContaining("HTTPSまたはlocalhost"),
    });
  });
  it("reports an unsupported browser before requesting permission", () => {
    const request = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: request } });
    expect(getBrowserMicrophoneBackend()).toEqual({
      error: expect.stringContaining("録音に対応していません"),
    });
    expect(request).not.toHaveBeenCalled();
  });
  it("prefers Opus/WebM and supports Safari MP4", () => {
    expect(chooseRecordingMimeType(() => true)).toBe("audio/webm;codecs=opus");
    expect(chooseRecordingMimeType((type) => type === "audio/mp4")).toBe(
      "audio/mp4",
    );
  });
  it("lets the browser select its format when explicit probes fail", () => {
    expect(chooseRecordingMimeType()).toBeUndefined();
    expect(chooseRecordingMimeType(() => false)).toBeUndefined();
    expect(
      chooseRecordingMimeType(() => {
        throw new Error("unsupported probe");
      }),
    ).toBeUndefined();
  });
});

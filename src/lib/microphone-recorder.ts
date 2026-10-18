import { audioFocus, type AudioFocus } from "./audio-focus";

/** A short, in-memory recording. No browser storage, upload, or speech scoring. */
export const MAX_RECORDING_SECONDS = 20;
export const MAX_RECORDING_BYTES = 5 * 1024 * 1024;

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "recorded"
  | "error";

export interface RecordingSnapshot {
  status: RecordingStatus;
  message: string;
  audioUrl?: string;
}

export interface RecordingCallbacks {
  data: (data: Blob) => void;
  stop: () => void;
  error: () => void;
}

export interface MicrophoneRecording {
  readonly state: string;
  readonly mimeType: string;
  start: (timeslice: number) => void;
  stop: () => void;
  detach: () => void;
}

export interface MicrophoneStream {
  getTracks: () => readonly { stop: () => void }[];
  createRecorder: (callbacks: RecordingCallbacks) => MicrophoneRecording;
}

export interface MicrophoneBackend {
  request: () => Promise<MicrophoneStream>;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
}

const idle: RecordingSnapshot = {
  status: "idle",
  message: "自分の声を録音し、見本と聞き比べられます（最大20秒）。",
};

export function microphoneErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "マイクの使用が許可されませんでした。ブラウザのサイト設定でマイクを許可してから、もう一度お試しください。";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "マイクが見つかりません。接続と端末の入力設定を確認してください。";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "マイクを使用できません。ほかの録音アプリを閉じ、端末のマイク権限を確認してください。";
  if (name === "SecurityError")
    return "このページではマイクが許可されていません。HTTPSまたはlocalhostで開き、ブラウザのサイト設定を確認してください。";
  return "録音を開始できませんでした。マイクの接続・権限を確認し、対応するブラウザでお試しください。";
}

export function chooseRecordingMimeType(
  isSupported?: (type: string) => boolean,
): string | undefined {
  if (!isSupported) return undefined;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // Some older browsers expose the method but reject a particular format.
    }
  }
  return undefined; // Let the browser choose its supported default format.
}

function stopTracks(stream: MicrophoneStream) {
  try {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Continue closing the remaining tracks if one device fails.
      }
    }
  } catch {
    // A disconnected device may no longer expose its tracks.
  }
}

/** Owns one recording and its URL; pending permission requests are invalidated. */
export function createMicrophoneRecorder(
  backend: MicrophoneBackend,
  onChange: (snapshot: RecordingSnapshot) => void,
  focus: AudioFocus = audioFocus,
) {
  interface Session {
    token: symbol;
    stream?: MicrophoneStream;
    recorder?: MicrophoneRecording;
    chunks: Blob[];
    bytes: number;
    tracksStopped: boolean;
    automatic: boolean;
    releaseFocus: () => void;
    durationTimer?: ReturnType<typeof setTimeout>;
    stopTimer?: ReturnType<typeof setTimeout>;
  }
  let disposed = false;
  let session: Session | undefined;
  let audioUrl: string | undefined;
  let snapshot: RecordingSnapshot = idle;

  function emit(next: RecordingSnapshot) {
    snapshot = next;
    if (!disposed) onChange(next);
  }
  function revoke() {
    if (!audioUrl) return;
    const previous = audioUrl;
    audioUrl = undefined;
    try {
      backend.revokeUrl(previous);
    } catch {
      // The URL is no longer exposed, even if the browser rejects revocation.
    }
  }
  function closeTracks(current: Session) {
    if (current.tracksStopped || !current.stream) return;
    current.tracksStopped = true;
    stopTracks(current.stream);
  }
  function clean(current: Session) {
    clearTimeout(current.durationTimer);
    clearTimeout(current.stopTimer);
    try {
      current.recorder?.detach();
    } catch {
      // Tracks must still be stopped if listener cleanup fails.
    }
    try {
      if (current.recorder && current.recorder.state !== "inactive")
        current.recorder.stop();
    } catch {
      // A recorder that has already stopped can throw InvalidStateError.
    }
    closeTracks(current);
    current.chunks = [];
    current.releaseFocus();
  }
  function active(current: Session) {
    return !disposed && session?.token === current.token;
  }
  function fail(current: Session, message: string) {
    if (!active(current)) return;
    session = undefined; // Ignore synchronous or queued events during cleanup.
    clean(current);
    revoke();
    emit({ status: "error", message });
  }
  function finish(current: Session) {
    if (!active(current)) return;
    if (!current.bytes) {
      fail(
        current,
        "録音データを取得できませんでした。少し話してから停止し、マイクの入力設定も確認してください。",
      );
      return;
    }
    try {
      const blob = new Blob(current.chunks, {
        type: current.recorder?.mimeType || current.chunks[0]?.type,
      });
      audioUrl = backend.createUrl(blob);
    } catch {
      fail(
        current,
        "録音を再生する準備ができませんでした。もう一度録音してください。",
      );
      return;
    }
    session = undefined;
    clean(current);
    emit({
      status: "recorded",
      audioUrl,
      message: current.automatic
        ? "20秒で録音を止めました。自分の声を再生して聞き比べましょう。"
        : "録音できました。自分の声を再生して聞き比べましょう。",
    });
  }
  function stop(current: Session, automatic = false) {
    if (!active(current) || snapshot.status !== "recording") return;
    current.automatic = automatic;
    clearTimeout(current.durationTimer);
    emit({ status: "stopping", message: "録音を終了しています…" });
    current.stopTimer = setTimeout(
      () =>
        fail(current, "録音を終了できませんでした。もう一度録音してください。"),
      3000,
    );
    try {
      current.recorder?.stop();
    } catch {
      fail(current, "録音を終了できませんでした。もう一度録音してください。");
    } finally {
      closeTracks(current); // Never keep the microphone open while preparing playback.
    }
  }
  function reset() {
    const previous = session;
    session = undefined;
    if (previous) clean(previous);
    revoke();
    emit(idle);
  }

  return {
    getSnapshot: () => snapshot,
    async start() {
      if (disposed || session) return;
      revoke();
      const current: Session = {
        token: Symbol("microphone"),
        chunks: [],
        bytes: 0,
        tracksStopped: false,
        automatic: false,
        releaseFocus: focus.acquire(),
      };
      session = current;
      emit({
        status: "requesting",
        message:
          "ブラウザでマイクの使用を許可してください。許可するまでは録音されません。",
      });
      let stream: MicrophoneStream;
      try {
        stream = await backend.request();
      } catch (error) {
        fail(current, microphoneErrorMessage(error));
        return;
      }
      if (!active(current)) {
        stopTracks(stream); // Permission may resolve after unmount or cancellation.
        return;
      }
      current.stream = stream;
      try {
        current.recorder = stream.createRecorder({
          data(data) {
            if (!active(current) || !data.size) return;
            if (current.bytes + data.size > MAX_RECORDING_BYTES) {
              fail(
                current,
                "録音が5MBの上限を超えたため破棄しました。短く録音し直してください。",
              );
              return;
            }
            current.bytes += data.size;
            current.chunks.push(data);
          },
          stop: () => finish(current),
          error: () =>
            fail(
              current,
              "録音中にエラーが発生しました。マイクを確認し、もう一度録音してください。",
            ),
        });
        current.recorder.start(250);
      } catch (error) {
        fail(current, microphoneErrorMessage(error));
        return;
      }
      if (!active(current)) return;
      emit({
        status: "recording",
        message: "録音中です。見本の言葉を話してください（最大20秒）。",
      });
      current.durationTimer = setTimeout(
        () => stop(current, true),
        MAX_RECORDING_SECONDS * 1000,
      );
    },
    stop() {
      if (snapshot.status === "requesting") reset();
      else if (session) stop(session);
    },
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}

export type MicrophoneRecorder = ReturnType<typeof createMicrophoneRecorder>;

export function getBrowserMicrophoneBackend():
  | { backend: MicrophoneBackend }
  | { error: string } {
  if (typeof window === "undefined")
    return { error: "録音はブラウザで利用できます。" };
  if (!window.isSecureContext)
    return {
      error:
        "録音はHTTPSまたはlocalhostで利用できます。開いているページのアドレスを確認してください。",
    };
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof window.MediaRecorder !== "function" ||
    typeof URL.createObjectURL !== "function" ||
    typeof URL.revokeObjectURL !== "function"
  )
    return {
      error:
        "このブラウザは録音に対応していません。最新版のSafariまたはChromeなどでお試しください。",
    };
  return {
    backend: {
      async request() {
        const nativeStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        return {
          getTracks: () => nativeStream.getTracks(),
          createRecorder(callbacks) {
            const mimeType = chooseRecordingMimeType(
              typeof MediaRecorder.isTypeSupported === "function"
                ? (type) => MediaRecorder.isTypeSupported(type)
                : undefined,
            );
            let recorder: MediaRecorder;
            try {
              recorder = new MediaRecorder(
                nativeStream,
                mimeType ? { mimeType } : undefined,
              );
            } catch {
              recorder = new MediaRecorder(nativeStream);
            }
            const data = (event: BlobEvent) => callbacks.data(event.data);
            const stopped = () => callbacks.stop();
            const error = () => callbacks.error();
            recorder.addEventListener("dataavailable", data);
            recorder.addEventListener("stop", stopped);
            recorder.addEventListener("error", error);
            return {
              get state() {
                return recorder.state;
              },
              get mimeType() {
                return recorder.mimeType;
              },
              start: (timeslice) => recorder.start(timeslice),
              stop: () => recorder.stop(),
              detach() {
                recorder.removeEventListener("dataavailable", data);
                recorder.removeEventListener("stop", stopped);
                recorder.removeEventListener("error", error);
              },
            };
          },
        };
      },
      createUrl: (blob) => URL.createObjectURL(blob),
      revokeUrl: (url) => URL.revokeObjectURL(url),
    },
  };
}

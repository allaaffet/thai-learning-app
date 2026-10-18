"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audioFocus } from "@/lib/audio-focus";
import {
  createMicrophoneRecorder,
  getBrowserMicrophoneBackend,
  type MicrophoneRecorder,
  type RecordingSnapshot,
} from "@/lib/microphone-recorder";

interface LessonRecorderProps {
  resetKey: string;
  disabled?: boolean;
  onRecordingChange?: (active: boolean) => void;
  beforeStart?: () => void;
}

function RecorderSurface({
  disabled = false,
  onRecordingChange,
  beforeStart,
}: Omit<LessonRecorderProps, "resetKey">) {
  const controller = useRef<MicrophoneRecorder | undefined>(undefined);
  const player = useRef<HTMLAudioElement | null>(null);
  const playbackRelease = useRef<(() => void) | undefined>(undefined);
  const callbacks = useRef({ onRecordingChange, beforeStart });
  const [state, setState] = useState<RecordingSnapshot>({
    status: "idle",
    message: "自分の声を録音し、見本と聞き比べられます（最大20秒）。",
  });
  const releasePlayback = useCallback(() => {
    playbackRelease.current?.();
    playbackRelease.current = undefined;
  }, []);
  const pausePlayback = useCallback(() => {
    player.current?.pause();
    releasePlayback();
  }, [releasePlayback]);
  useEffect(() => {
    callbacks.current = { onRecordingChange, beforeStart };
  }, [onRecordingChange, beforeStart]);
  useEffect(() => {
    const audio = player.current;
    return () => {
      audio?.pause();
      releasePlayback();
    };
  }, [state.audioUrl, releasePlayback]);
  useEffect(() => {
    const leavePage = () => {
      pausePlayback();
      controller.current?.reset();
    };
    window.addEventListener("pagehide", leavePage);
    return () => {
      window.removeEventListener("pagehide", leavePage);
      // Both permission requests and active recordings are invalidated on leave.
      controller.current?.dispose();
      callbacks.current.onRecordingChange?.(false);
    };
  }, [pausePlayback]);

  function start() {
    if (
      disabled ||
      state.status === "requesting" ||
      state.status === "recording" ||
      state.status === "stopping"
    )
      return;
    callbacks.current.beforeStart?.();
    pausePlayback();
    if (!controller.current) {
      const result = getBrowserMicrophoneBackend();
      if ("error" in result) {
        setState({ status: "error", message: result.error });
        return;
      }
      controller.current = createMicrophoneRecorder(result.backend, (next) => {
        setState(next);
        callbacks.current.onRecordingChange?.(
          next.status === "requesting" ||
            next.status === "recording" ||
            next.status === "stopping",
        );
      });
    }
    void controller.current.start();
  }
  const busy =
    state.status === "requesting" ||
    state.status === "recording" ||
    state.status === "stopping";
  return (
    <section
      className="space-y-3 rounded-2xl border border-[var(--line)] p-4"
      aria-label="自分の声を録音"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Mic size={18} aria-hidden="true" />
        <h3 className="font-semibold">自分の声を聞き比べる</h3>
        <span className="badge neutral">任意・採点なし</span>
      </div>
      <p className="text-sm leading-relaxed">
        録音はこの画面の中だけで扱い、保存・送信しません。発音や声調の自動採点は行いません。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={start}
          disabled={busy || disabled}
        >
          <Mic size={16} aria-hidden="true" />
          録音を始める
        </Button>
        {(state.status === "requesting" ||
          state.status === "recording" ||
          state.status === "stopping") && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => controller.current?.stop()}
            disabled={state.status === "stopping"}
          >
            <Square size={15} aria-hidden="true" />
            {state.status === "requesting"
              ? "録音の開始を取り消す"
              : "録音を止める"}
          </Button>
        )}
      </div>
      <p className="text-sm leading-relaxed" role="status">
        {state.message}
      </p>
      {state.audioUrl && (
        <div className="space-y-2">
          <audio
            ref={player}
            controls
            preload="metadata"
            src={state.audioUrl}
            aria-label="自分の録音"
            className="w-full max-w-full"
            onPlay={(event) => {
              // The parent can reject playback during microphone capture.
              if (event.currentTarget.paused) return;
              releasePlayback();
              playbackRelease.current = audioFocus.acquire();
            }}
            onPause={releasePlayback}
            onEnded={releasePlayback}
            onError={() => {
              releasePlayback();
              setState((current) => ({
                ...current,
                message:
                  "この録音を再生できませんでした。録音し直すか、別のブラウザでお試しください。",
              }));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              pausePlayback();
              controller.current?.reset();
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            録音を削除
          </Button>
        </div>
      )}
      <p className="text-xs leading-relaxed">
        マイクを許可するのは「録音を始める」を押したときだけです。最大20秒・5MB。問題の変更・画面の移動で録音は破棄されます。
      </p>
    </section>
  );
}

export function LessonRecorder({ resetKey, ...props }: LessonRecorderProps) {
  return <RecorderSurface key={resetKey} {...props} />;
}

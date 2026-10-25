"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Headphones, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThaiSpeech } from "@/components/speech-practice";

export interface CharacterAudioReadiness {
  questionId: string;
  heard: boolean;
  playing: boolean;
  /** null means that the browser's Thai voices are still being checked. */
  available: boolean | null;
}

interface CharacterAudioPromptProps {
  questionId: string;
  text: string;
  onReadyChange: (state: CharacterAudioReadiness) => void;
}

/** The source name is spoken only; it must not reveal the answer in the UI. */
export function CharacterAudioPrompt({
  questionId,
  text,
  onReadyChange,
}: CharacterAudioPromptProps) {
  const speech = useThaiSpeech();
  const [heard, setHeard] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  const available =
    speech.status === "checking" ? null : speech.status === "ready";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onReadyChange({
      questionId,
      heard,
      playing: speech.playing,
      available,
    });
  }, [
    questionId,
    heard,
    speech.playing,
    speech.message,
    available,
    attempt,
    onReadyChange,
  ]);

  function togglePlayback() {
    // Lock the answer in the same user event, before asynchronous speech starts.
    setHeard(false);
    // Publish the final state even when a synchronous error batches playing back to false.
    setAttempt((current) => current + 1);
    if (speech.playing) {
      onReadyChange({ questionId, heard: false, playing: false, available });
      speech.stop();
      return;
    }
    if (available !== true) return;
    onReadyChange({ questionId, heard: false, playing: true, available: true });
    speech.play(text, () => {
      if (!mounted.current) return;
      setHeard(true);
      onReadyChange({
        questionId,
        heard: true,
        playing: false,
        available: true,
      });
    });
  }

  return (
    <div className="ct-listen-prompt">
      <div className="ct-listen-control">
        <Headphones size={34} aria-hidden="true" />
        <Button
          type="button"
          size="lg"
          disabled={!speech.playing && available !== true}
          onClick={togglePlayback}
        >
          {speech.playing ? (
            <Square size={20} aria-hidden="true" />
          ) : (
            <Volume2 size={23} aria-hidden="true" />
          )}
          {speech.playing ? "問題の音声を停止" : "問題の音声を聞く"}
        </Button>
      </div>

      <p className="ct-small">
        最後まで聞くと回答できます。何度でも聞き直せます。
      </p>
      {speech.status === "ready" && speech.voice && (
        <p className="ct-small ct-listen-voice">
          使用する声：{speech.voice.name}（{speech.voice.lang}）
          {speech.voice.localService
            ? "・端末内の音声"
            : "・音声提供元へ通信する場合があります"}
        </p>
      )}
      {speech.status === "checking" && (
        <p className="ct-listen-status ct-small" role="status">
          タイ語の音声を確認中…
        </p>
      )}
      {speech.status === "unavailable" && (
        <p className="ct-listen-error ct-small" role="status">
          この端末ではタイ語の合成音声を利用できません。端末の音声設定でタイ語を追加するか、文字だけの練習へ切り替えてください。
        </p>
      )}
      {speech.message && (
        <p className="ct-listen-error ct-small" role="status">
          {speech.message}
        </p>
      )}
      {heard && !speech.playing && (
        <p className="ct-listen-status ct-small" role="status">
          <Check size={16} aria-hidden="true" />{" "}
          音声を確認しました。文字を選びましょう。
        </p>
      )}
    </div>
  );
}

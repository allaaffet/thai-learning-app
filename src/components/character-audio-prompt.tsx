"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
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
  active?: boolean;
  ref?: Ref<CharacterAudioPromptHandle>;
}

export interface CharacterAudioPromptHandle {
  play: (questionId: string, text: string) => boolean;
  stop: () => void;
}

/** The source name is spoken only; it must not reveal the answer in the UI. */
export function CharacterAudioPrompt({
  questionId,
  text,
  onReadyChange,
  active = true,
  ref,
}: CharacterAudioPromptProps) {
  const speech = useThaiSpeech();
  const [heard, setHeard] = useState(false);
  const [playTarget, setPlayTarget] = useState<{
    questionId: string;
    text: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const current = useRef<{
    questionId: string;
    text: string;
    token: number;
  } | null>(null);
  const available =
    speech.status === "checking" ? null : speech.status === "ready";
  const heardCurrent = Boolean(
    active &&
      heard &&
      playTarget?.questionId === questionId &&
      playTarget.text === text,
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);

  const stop = speech.stop;
  useEffect(
    () => () => {
      // A gesture can already have requested the new target before props commit.
      // Only cancel the old target owned by this effect's props.
      if (
        current.current?.questionId === questionId &&
        current.current.text === text
      ) {
        sequence.current += 1;
        current.current = null;
        stop();
      }
    },
    [questionId, text, stop],
  );

  useEffect(() => {
    if (!active) return;
    onReadyChange({
      questionId,
      heard: heardCurrent,
      playing: speech.playing,
      available,
    });
  }, [
    questionId,
    heardCurrent,
    speech.playing,
    speech.message,
    available,
    attempt,
    onReadyChange,
    active,
  ]);

  function stopPlayback() {
    sequence.current += 1;
    const previousId = current.current?.questionId ?? questionId;
    current.current = null;
    setPlayTarget(null);
    setHeard(false);
    setAttempt((current) => current + 1);
    speech.stop();
    onReadyChange({
      questionId: previousId,
      heard: false,
      playing: false,
      available,
    });
  }

  function play(nextId: string, nextText: string): boolean {
    const token = ++sequence.current;
    current.current = { questionId: nextId, text: nextText, token };
    setPlayTarget({ questionId: nextId, text: nextText });
    setHeard(false);
    setAttempt((value) => value + 1);
    speech.stop();
    // Lock synchronously, including replays of the same card and voice errors.
    onReadyChange({
      questionId: nextId,
      heard: false,
      playing: true,
      available,
    });
    const started = speech.play(nextText, () => {
      if (!mounted.current || sequence.current !== token) return;
      setHeard(true);
      onReadyChange({
        questionId: nextId,
        heard: true,
        playing: false,
        available: true,
      });
    });
    if (!started)
      onReadyChange({
        questionId: nextId,
        heard: false,
        playing: false,
        available,
      });
    return started;
  }

  useImperativeHandle(ref, () => ({ play, stop: stopPlayback }));

  function togglePlayback() {
    if (speech.playing) stopPlayback();
    else play(questionId, text);
  }

  if (!active) return null;

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
      {heardCurrent && !speech.playing && (
        <p className="ct-listen-status ct-small" role="status">
          <Check size={16} aria-hidden="true" />{" "}
          音声を確認しました。文字を選びましょう。
        </p>
      )}
    </div>
  );
}

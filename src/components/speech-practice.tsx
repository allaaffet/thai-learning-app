"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Headphones, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speechQuestions } from "@/data/speech-practice";
import {
  getBrowserSpeechController,
  selectThaiVoice,
  type SpeechController,
  type SpeechVoice,
} from "@/lib/device-speech";

function useThaiSpeech() {
  const owner = useId();
  const controller = useRef<SpeechController | undefined>(undefined);
  const [voice, setVoice] = useState<SpeechVoice>();
  const [status, setStatus] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const instance = getBrowserSpeechController();
    controller.current = instance;
    let mounted = true;
    function updateVoices(final = false) {
      if (!mounted) return;
      try {
        const selected = instance && selectThaiVoice(instance.backend.voices());
        setVoice(selected);
        setStatus(selected ? "ready" : final ? "unavailable" : "checking");
      } catch {
        setStatus("unavailable");
      }
    }
    queueMicrotask(() => updateVoices(!instance));
    const timer = window.setTimeout(() => updateVoices(true), 2500);
    const unsubscribe = instance?.backend.subscribe(() => updateVoices(true));
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      unsubscribe?.();
      instance?.stop(owner);
    };
  }, [owner]);
  const stop = useCallback(() => {
    controller.current?.stop(owner);
  }, [owner]);
  function play(text: string, complete?: () => void) {
    if (!voice || !controller.current) return;
    setMessage(null);
    setPlaying(true);
    controller.current.play(owner, text, voice, {
      start: () => setPlaying(true),
      complete: () => {
        setPlaying(false);
        complete?.();
      },
      cancel: () => setPlaying(false),
      error: (error) => {
        setPlaying(false);
        setMessage(error);
      },
    });
  }
  return { voice, status, playing, message, play, stop };
}

const voiceUnavailable =
  "この端末ではタイ語の合成音声を利用できません。端末の音声設定でタイ語を追加するか、対応するブラウザでお試しください。";

export function SpeakButton({
  text,
  label = "合成音声で確認",
}: {
  text: string;
  label?: string;
}) {
  const speech = useThaiSpeech();
  const stop = speech.stop;
  useEffect(() => () => stop(), [text, stop]); // Changing an example must stop its previous speech.
  return (
    <div className="speech-inline">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={speech.status !== "ready"}
        onClick={() => (speech.playing ? speech.stop() : speech.play(text))}
      >
        {speech.playing ? <Square size={15} /> : <Volume2 size={16} />}
        {speech.playing ? "読み上げを停止" : label}
      </Button>
      <small>端末の合成音声（未監修）</small>
      {speech.status === "checking" && (
        <p role="status">タイ語の音声を確認中…</p>
      )}
      {speech.status === "unavailable" && (
        <p role="status">{voiceUnavailable}</p>
      )}
      {speech.message && <p role="status">{speech.message}</p>}
    </div>
  );
}

export function SpeechPractice() {
  const speech = useThaiSpeech();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [heard, setHeard] = useState(false);
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = speechQuestions[index];
  const answerCorrect = selected === question.thai;
  function next() {
    speech.stop();
    if (index === speechQuestions.length - 1) setFinished(true);
    else {
      setIndex(index + 1);
      setSelected("");
      setSubmitted(false);
      setHeard(false);
    }
    heading.current?.focus({ preventScroll: true });
  }
  return (
    <section
      className="surface speech-practice"
      aria-labelledby="speech-practice-heading"
    >
      <div className="speech-practice-heading">
        <Headphones size={23} />
        <div>
          <p className="eyebrow">OPTIONAL · LISTEN</p>
          <h2 id="speech-practice-heading" ref={heading} tabIndex={-1}>
            合成音声で、聞き分けを試す
          </h2>
        </div>
        <span className="badge neutral">XP加算なし</span>
      </div>
      <p className="speech-disclosure">
        端末の合成音声（未監修）を使います。録音された教材音声ではありません。声によって読み方や声調の自然さが異なるため、発音の正確性は未検証です。結果はXPやレッスンの解放に使いません。
      </p>
      {speech.status === "checking" && (
        <p role="status">端末にタイ語の音声があるか確認しています…</p>
      )}
      {speech.status === "unavailable" && (
        <p className="speech-unavailable" role="status">
          {voiceUnavailable} 声調ラボとレッスンは音声なしでも利用できます。
        </p>
      )}
      {speech.voice && (
        <p className="speech-voice">
          使用する声：{speech.voice.name}（{speech.voice.lang}）
          {speech.voice.localService
            ? "・端末内の音声"
            : "・音声提供元への通信が発生する場合があります"}
        </p>
      )}
      {speech.status === "ready" &&
        (finished ? (
          <div className="speech-complete" role="status">
            <h3>3問の練習、おつかれさまでした。</h3>
            <p>音と文字の関係は、上の規則と照らして確かめましょう。</p>
            <Button
              variant="outline"
              onClick={() => {
                setIndex(0);
                setSelected("");
                setSubmitted(false);
                setHeard(false);
                setFinished(false);
              }}
            >
              もう一度聞く
            </Button>
          </div>
        ) : (
          <div className="speech-question">
            <p className="eyebrow">
              QUESTION {index + 1} / {speechQuestions.length}
            </p>
            <h3>読み上げられた語を選んでください</h3>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                speech.playing
                  ? speech.stop()
                  : speech.play(question.thai, () => setHeard(true))
              }
            >
              {speech.playing ? <Square size={17} /> : <Volume2 size={18} />}
              {speech.playing ? "問題の読み上げを停止" : "問題の合成音声を再生"}
            </Button>
            {!heard && (
              <p className="speech-hint">
                音声を最後まで聞いてから、答えを確認できます。
              </p>
            )}
            {speech.message && (
              <p className="speech-unavailable" role="status">
                {speech.message}
              </p>
            )}
            <fieldset disabled={submitted} className="speech-choices">
              <legend className="sr-only">聞こえた語</legend>
              {question.options.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="speech-answer"
                    value={option}
                    checked={selected === option}
                    onChange={() => setSelected(option)}
                  />
                  <span className="thai" lang="th">
                    {option}
                  </span>
                </label>
              ))}
            </fieldset>
            {submitted ? (
              <>
                <div
                  className={`speech-feedback${answerCorrect ? " is-correct" : ""}`}
                  role="status"
                >
                  <strong>
                    {answerCorrect
                      ? "選んだ答えは正解です"
                      : "答えを確かめましょう"}
                  </strong>
                  <p>
                    <span className="thai" lang="th">
                      {question.thai}
                    </span>{" "}
                    {question.ipa} · {question.meaning}
                  </p>
                  <p>{question.explanation}</p>
                </div>
                <Button onClick={next}>
                  {index === speechQuestions.length - 1
                    ? "練習を終える"
                    : "次の聞き分けへ"}
                </Button>
              </>
            ) : (
              <Button
                disabled={!heard || !selected || speech.playing}
                onClick={() => {
                  speech.stop();
                  setSubmitted(true);
                }}
              >
                聞き分けの答えを確認
              </Button>
            )}
          </div>
        ))}
    </section>
  );
}

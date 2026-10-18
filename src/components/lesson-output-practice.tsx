"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Keyboard, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/speech-practice";
import { LessonRecorder } from "@/components/lesson-recorder";
import type { LessonOutputTask } from "@/data/lesson-output";
import {
  compareThaiAnswer,
  type ThaiAnswerComparison,
} from "@/lib/answer-comparison";
import { getBrowserSpeechController } from "@/lib/device-speech";
import {
  createBrowserRecognitionSession,
  type BrowserRecognitionSession,
} from "@/lib/speech-recognition";

function ModelWord({ task }: { task: LessonOutputTask }) {
  return (
    <div className="output-model">
      <strong className="thai" lang="th">
        {task.target}
      </strong>
      <span className="ipa">{task.ipa}</span>
      <span>{task.meaning}</span>
    </div>
  );
}

function TextPractice({ task }: { task: LessonOutputTask }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ThaiAnswerComparison>();
  return (
    <div className="output-body">
      <p className="output-prompt">{task.prompt}</p>
      <details className="output-hint">
        <summary>ヒントを見る</summary>
        <p>{task.hint}</p>
      </details>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResult(compareThaiAnswer(value, task.acceptedAnswers));
        }}
      >
        <label htmlFor={id}>タイ語で回答</label>
        <input
          id={id}
          className="thai output-input"
          lang="th"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setResult(undefined);
          }}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="output-help">
          声調記号・母音記号も含めて入力します。何度でも試せます。
        </p>
        <Button type="submit">
          <Check size={16} aria-hidden="true" />
          文字の答えを確認
        </Button>
      </form>
      <details className="output-hint">
        <summary>タイ文字を入力するには</summary>
        <p>
          端末のキーボードにタイ語を追加します。Macでは「システム設定 →
          キーボード → テキスト入力 → 編集 →
          ＋」からタイ語を追加し、入力メニューで切り替えます。文字入力を使わず「声で確かめる」へ進むこともできます。
        </p>
      </details>
      {result && (
        <div
          className={`output-feedback ${result.status === "correct" ? "correct" : ""}`}
          role="status"
        >
          <p className="font-semibold">
            {result.status === "correct"
              ? "正しい綴りです"
              : result.status === "empty"
                ? "タイ文字を入力してください"
                : result.status === "invalid"
                  ? "200文字以内のタイ語で入力してください"
                  : "見本と見比べてみましょう"}
          </p>
          {(result.status === "correct" || result.status === "incorrect") && (
            <>
              <ModelWord task={task} />
              <p>{task.explanation}</p>
              <p className="output-help">
                確認したのは文字の綴りです。発音の評価ではありません。
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function VoicePractice({
  task,
  onCaptureChange,
}: {
  task: LessonOutputTask;
  onCaptureChange: (active: boolean) => void;
}) {
  const session = useRef<BrowserRecognitionSession | undefined>(undefined);
  const surface = useRef<HTMLDivElement>(null);
  const [support, setSupport] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>();
  const [error, setError] = useState<string>();
  const busy = listening || recording;
  useEffect(() => {
    let mounted = true;
    const instance = createBrowserRecognitionSession({
      onStatus: (status) => {
        if (mounted) setListening(status === "listening");
      },
      onTranscript: (text) => {
        if (mounted) setTranscript(text);
      },
      onError: (message) => {
        if (mounted) setError(message);
      },
    });
    session.current = instance;
    const leavePage = () => instance?.stop();
    window.addEventListener("pagehide", leavePage);
    queueMicrotask(() => {
      if (mounted) setSupport(instance ? "ready" : "unavailable");
    });
    return () => {
      mounted = false;
      window.removeEventListener("pagehide", leavePage);
      instance?.dispose();
    };
  }, []);
  useEffect(() => {
    onCaptureChange(busy);
    return () => onCaptureChange(false);
  }, [busy, onCaptureChange]);

  function pauseOutput() {
    getBrowserSpeechController()?.stopAll();
    surface.current
      ?.querySelectorAll("audio")
      .forEach((audio) => audio.pause());
  }
  const result =
    transcript === undefined
      ? undefined
      : compareThaiAnswer(transcript, task.acceptedAnswers);
  return (
    <div
      ref={surface}
      className="output-body"
      onPlayCapture={(event) => {
        if (event.target instanceof HTMLAudioElement) {
          if (busy) event.target.pause();
          else getBrowserSpeechController()?.stopAll();
        }
      }}
    >
      <p>
        この語を声に出してみましょう。見本と自分の録音を交互に聞いて、母音の長さ・息・声の高さを確かめます。
      </p>
      <ModelWord task={task} />
      <SpeakButton
        text={task.target}
        disabled={busy}
        beforePlay={pauseOutput}
      />
      <p className="output-help">
        見本は端末の合成音声（未監修）です。声によって読み方や声調の自然さが異なります。音声提供元への通信が発生する場合があります。
      </p>
      <LessonRecorder
        resetKey={task.id}
        disabled={listening}
        onRecordingChange={setRecording}
        beforeStart={pauseOutput}
      />
      <section
        className="output-recognition"
        aria-label="認識された言葉を確かめる"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3>認識された言葉を確かめる</h3>
          <span className="badge neutral">参考・任意</span>
        </div>
        <p>
          ブラウザの音声認識で、話した言葉がどんなタイ文字になるか確認できます。音声はブラウザ提供元のサービスに送信される場合があります。利用条件はブラウザに依存します。
        </p>
        <p>
          <strong>発音・声調の自動採点は行いません。</strong>
          一致しても正確な発音の証明にはならず、異なっても発音が間違いとは限りません。
        </p>
        {support === "checking" && (
          <p role="status">音声認識への対応を確認中…</p>
        )}
        {support === "unavailable" && (
          <p role="status">
            このブラウザは音声認識に対応していません。文字入力や録音の聞き直しで練習できます。
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={support !== "ready" || busy}
            onClick={() => {
              pauseOutput();
              setTranscript(undefined);
              setError(undefined);
              session.current?.start();
            }}
          >
            <Mic size={16} aria-hidden="true" />
            音声認識を始める
          </Button>
          {listening && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => session.current?.stop()}
            >
              <Square size={15} aria-hidden="true" />
              音声認識を取り消す
            </Button>
          )}
        </div>
        <p className="output-help">
          開始ボタンを押したときだけマイクを使います。短い語を1つ話してください。約9秒で自動停止します。録音機能とは同時に使えません。
        </p>
        {listening && <p role="status">聞き取り中です…</p>}
        {error && <p role="status">{error}</p>}
        {transcript !== undefined && (
          <div className="output-feedback" role="status">
            <p>
              認識された言葉：
              <strong
                className="thai"
                lang="th"
                data-testid="recognized-transcript"
              >
                {transcript}
              </strong>
            </p>
            <p className="font-semibold">
              {result?.status === "correct"
                ? "一致しました（参考）"
                : "見本とは異なる文字列です（参考）"}
            </p>
            <p>{task.explanation}</p>
            <p className="output-help">
              文字列の一致を比較しています。認識結果は保存せず、XP・理解度・レッスンの解放には使いません。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function LessonOutputPractice({
  task,
  onCaptureChange,
}: {
  task: LessonOutputTask;
  onCaptureChange: (active: boolean) => void;
}) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  return (
    <section
      className="surface lesson-output"
      aria-label="言葉を入力・録音する練習"
    >
      <p className="eyebrow">TRY IT YOURSELF</p>
      <div className="output-title">
        <h2>今度は、自分で。</h2>
        <span className="badge neutral">任意・XP加算なし</span>
      </div>
      <p>
        学んだ語を、書いて・話して確かめましょう。この練習を飛ばしても、次のクイズに進めます。
      </p>
      <div className="output-modes" role="group" aria-label="入力練習の方法">
        <Button
          type="button"
          variant={mode === "text" ? "secondary" : "outline"}
          aria-pressed={mode === "text"}
          onClick={() => setMode("text")}
        >
          <Keyboard size={17} aria-hidden="true" />
          文字で答える
        </Button>
        <Button
          type="button"
          variant={mode === "voice" ? "secondary" : "outline"}
          aria-pressed={mode === "voice"}
          onClick={() => setMode("voice")}
        >
          <Mic size={17} aria-hidden="true" />
          声で確かめる
        </Button>
      </div>
      {mode === "text" ? (
        <TextPractice task={task} />
      ) : (
        <VoicePractice task={task} onCaptureChange={onCaptureChange} />
      )}
      <p className="output-help">
        教材案・専門家レビュー前。入力内容・認識結果・録音は学習記録に保存しません。
      </p>
    </section>
  );
}

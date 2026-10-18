export type BrowserRecognitionStatus = "listening" | "idle";

export interface BrowserRecognitionCallbacks {
  onTranscript: (text: string) => void;
  onStatus: (status: BrowserRecognitionStatus) => void;
  onError: (message: string) => void;
}

export interface BrowserRecognitionSession {
  start: () => void;
  /** この回を中断する。停止後に遅れて届いた認識結果は通知しない。 */
  stop: () => void;
  /** 画面の破棄時に呼ぶ。以降は再開せず、すべての通知を無効にする。 */
  dispose: () => void;
}

interface RecognitionAdapter {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onresult: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface RecognitionRun {
  recognition: RecognitionAdapter;
  timeout: ReturnType<typeof setTimeout> | undefined;
}

const timeoutMilliseconds = 9_000;
type RecognitionConstructor = new () => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecognitionConstructor(
  value: unknown,
): value is RecognitionConstructor {
  return typeof value === "function";
}

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const standard: unknown = Reflect.get(window, "SpeechRecognition");
    if (isRecognitionConstructor(standard)) return standard;
    const prefixed: unknown = Reflect.get(window, "webkitSpeechRecognition");
    return isRecognitionConstructor(prefixed) ? prefixed : undefined;
  } catch {
    return undefined;
  }
}

export function getBrowserRecognitionSupport(): boolean {
  return recognitionConstructor() !== undefined;
}

function isRecognitionAdapter(value: unknown): value is RecognitionAdapter {
  return (
    isRecord(value) &&
    typeof value.start === "function" &&
    typeof value.stop === "function" &&
    typeof value.abort === "function"
  );
}

/** Web Speech APIの外部イベントは、型アサーションで信頼しない。 */
function readTranscript(
  event: unknown,
): { status: "final"; text: string } | { status: "interim" | "invalid" } {
  try {
    if (
      !isRecord(event) ||
      !isRecord(event.results) ||
      typeof event.results.length !== "number" ||
      !Number.isInteger(event.results.length) ||
      event.results.length < 1 ||
      event.results.length > 32 ||
      typeof event.resultIndex !== "number" ||
      !Number.isInteger(event.resultIndex) ||
      event.resultIndex < 0 ||
      event.resultIndex >= event.results.length
    ) {
      return { status: "invalid" };
    }
    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      const result: unknown = event.results[index];
      if (!isRecord(result) || typeof result.isFinal !== "boolean")
        return { status: "invalid" };
      if (!result.isFinal) continue;
      const alternative: unknown = result[0];
      if (
        !isRecord(alternative) ||
        typeof alternative.transcript !== "string" ||
        alternative.transcript.length > 200 ||
        alternative.transcript.trim().length === 0
      ) {
        return { status: "invalid" };
      }
      return { status: "final", text: alternative.transcript };
    }
    return { status: "interim" };
  } catch {
    return { status: "invalid" };
  }
}

function recognitionErrorMessage(event: unknown): string {
  const code =
    isRecord(event) && typeof event.error === "string"
      ? event.error
      : "unknown";
  switch (code) {
    case "not-allowed":
      return "マイクの使用が許可されていません。ブラウザのサイト設定でマイクを許可し、もう一度お試しください。文字入力でも回答できます。";
    case "service-not-allowed":
      return "ブラウザの音声認識サービスを利用できません。別の対応ブラウザを使うか、文字入力で回答してください。";
    case "audio-capture":
      return "マイクから音声を取得できません。マイクの接続とブラウザのマイク設定を確認してください。文字入力でも回答できます。";
    case "no-speech":
      return "音声を検出できませんでした。マイクを確認し、開始後に短いタイ語の語を話してみてください。";
    case "network":
      return "音声認識サービスへの通信に失敗しました。接続を確認して再度試すか、文字入力で回答してください。";
    case "language-not-supported":
      return "このブラウザの音声認識ではタイ語を利用できません。別の対応ブラウザを使うか、文字入力で回答してください。";
    case "aborted":
      return "音声認識が中断されました。もう一度開始するか、文字入力で回答してください。";
    default:
      return "音声認識を利用できませんでした。ブラウザとマイクの設定を確認するか、文字入力で回答してください。";
  }
}

/**
 * 認識した文字列だけを返す。IPA・音高・発音の正確さ・信頼度の採点は行わない。
 * 音声の処理先・利用条件はブラウザ依存であり、開始前の説明は呼出側UIで行う。
 */
export function createBrowserRecognitionSession(
  callbacks: BrowserRecognitionCallbacks,
): BrowserRecognitionSession | undefined {
  const Constructor = recognitionConstructor();
  if (!Constructor) return undefined;

  let activeRun: RecognitionRun | undefined;
  let disposed = false;
  let status: BrowserRecognitionStatus = "idle";

  function isCurrent(run: RecognitionRun): boolean {
    return !disposed && activeRun === run;
  }

  function setStatus(next: BrowserRecognitionStatus) {
    if (status !== next) {
      status = next;
      if (!disposed) callbacks.onStatus(next);
    }
  }

  function endRun(run: RecognitionRun, method: "abort" | "stop" = "abort") {
    if (activeRun !== run) return;
    activeRun = undefined;
    if (run.timeout !== undefined) clearTimeout(run.timeout);
    run.recognition.onstart = null;
    run.recognition.onresult = null;
    run.recognition.onerror = null;
    run.recognition.onend = null;
    try {
      run.recognition[method]();
    } catch {
      // 一部の実装は終了済みインスタンスへのstop/abortで例外を返す。
      if (method === "stop") {
        try {
          run.recognition.abort();
        } catch {
          /* 既に停止済み。 */
        }
      }
    }
    setStatus("idle");
  }

  function failRun(run: RecognitionRun, message: string) {
    if (!isCurrent(run)) return;
    endRun(run);
    if (!disposed) callbacks.onError(message);
  }

  return {
    start() {
      if (disposed || activeRun) return;
      let recognition: RecognitionAdapter;
      try {
        const candidate: unknown = Reflect.construct(Constructor, []);
        if (!isRecognitionAdapter(candidate))
          throw new Error("Unsupported recognition implementation");
        recognition = candidate;
        recognition.lang = "th-TH";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
      } catch {
        callbacks.onError(
          "このブラウザでは音声認識を開始できません。別の対応ブラウザを使うか、文字入力で回答してください。",
        );
        return;
      }

      const run: RecognitionRun = { recognition, timeout: undefined };
      activeRun = run;
      recognition.onstart = () => {
        if (isCurrent(run)) setStatus("listening");
      };
      recognition.onresult = (event) => {
        if (!isCurrent(run)) return;
        const result = readTranscript(event);
        if (result.status === "invalid") {
          failRun(
            run,
            "認識結果を確認できませんでした。短いタイ語の語でもう一度試すか、文字入力で回答してください。",
          );
        } else if (result.status === "final") {
          endRun(run, "stop");
          if (!disposed) callbacks.onTranscript(result.text);
        }
      };
      recognition.onerror = (event) =>
        failRun(run, recognitionErrorMessage(event));
      recognition.onend = () => {
        if (isCurrent(run))
          failRun(
            run,
            "認識結果を取得できませんでした。もう一度開始して短いタイ語の語を話すか、文字入力で回答してください。",
          );
      };
      run.timeout = setTimeout(() => {
        failRun(
          run,
          "時間内に認識結果を取得できませんでした。もう一度開始して短いタイ語の語を話すか、文字入力で回答してください。",
        );
      }, timeoutMilliseconds);
      try {
        recognition.start();
        if (isCurrent(run)) setStatus("listening");
      } catch (error) {
        const permissionDenied =
          isRecord(error) &&
          (error.name === "NotAllowedError" || error.name === "SecurityError");
        failRun(
          run,
          permissionDenied
            ? recognitionErrorMessage({ error: "not-allowed" })
            : "音声認識を開始できませんでした。少し待って再度開始するか、文字入力で回答してください。",
        );
      }
    },
    stop() {
      if (activeRun) endRun(activeRun);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (activeRun) endRun(activeRun);
    },
  };
}

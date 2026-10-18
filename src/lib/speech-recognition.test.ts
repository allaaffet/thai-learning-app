import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserRecognitionSession,
  getBrowserRecognitionSupport,
} from "@/lib/speech-recognition";

class MockRecognition {
  static instances: MockRecognition[] = [];
  lang = "";
  continuous = true;
  interimResults = true;
  maxAlternatives = 9;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    MockRecognition.instances.push(this);
  }
}

function setup(prefixed = false) {
  vi.stubGlobal(
    "window",
    prefixed
      ? { webkitSpeechRecognition: MockRecognition }
      : { SpeechRecognition: MockRecognition },
  );
  const callbacks = {
    onTranscript: vi.fn(),
    onStatus: vi.fn(),
    onError: vi.fn(),
  };
  const session = createBrowserRecognitionSession(callbacks);
  if (!session) throw new Error("Expected supported session");
  return { session, callbacks };
}

function finalResult(transcript: unknown, resultIndex = 0) {
  return {
    resultIndex,
    results: {
      length: 1,
      0: { isFinal: true, 0: { transcript, confidence: 0.99 } },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  MockRecognition.instances = [];
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ブラウザの機能検出", () => {
  it("SSR・非対応ブラウザではAPIを呼び出さない", () => {
    vi.stubGlobal("window", undefined);
    expect(getBrowserRecognitionSupport()).toBe(false);
    expect(
      createBrowserRecognitionSession({
        onTranscript: vi.fn(),
        onStatus: vi.fn(),
        onError: vi.fn(),
      }),
    ).toBeUndefined();
    vi.stubGlobal("window", {});
    expect(getBrowserRecognitionSupport()).toBe(false);
    vi.stubGlobal("window", { SpeechRecognition: "unavailable" });
    expect(getBrowserRecognitionSupport()).toBe(false);
  });

  it("標準版・webkit版を検出し、利用者が開始するまで起動しない", () => {
    const { session } = setup(true);
    expect(getBrowserRecognitionSupport()).toBe(true);
    expect(MockRecognition.instances).toHaveLength(0);
    session.start();
    const recognition = MockRecognition.instances[0];
    expect(recognition.lang).toBe("th-TH");
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(false);
    expect(recognition.maxAlternatives).toBe(1);
  });

  it("標準版が使えるときはwebkit版を生成しない", () => {
    const prefixed = vi.fn();
    vi.stubGlobal("window", {
      SpeechRecognition: MockRecognition,
      webkitSpeechRecognition: prefixed,
    });
    createBrowserRecognitionSession({
      onTranscript: vi.fn(),
      onStatus: vi.fn(),
      onError: vi.fn(),
    })?.start();
    expect(MockRecognition.instances).toHaveLength(1);
    expect(prefixed).not.toHaveBeenCalled();
  });

  it("コンストラクタが失敗しても利用可能と偽って結果を返さない", () => {
    vi.stubGlobal("window", { SpeechRecognition: () => undefined });
    const callbacks = {
      onTranscript: vi.fn(),
      onStatus: vi.fn(),
      onError: vi.fn(),
    };
    createBrowserRecognitionSession(callbacks)?.start();
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("文字入力"),
    );
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
  });
});

describe("確定した認識文字列だけを返す", () => {
  it("途中経過は通知せず、確定結果を文字列のまま1回だけ返す", () => {
    const { session, callbacks } = setup();
    session.start();
    const recognition = MockRecognition.instances[0];
    const oldResult = recognition.onresult;
    recognition.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: false, 0: { transcript: "ข่าว" } } },
    });
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    oldResult?.(finalResult(" ข้าว "));
    expect(callbacks.onTranscript.mock.calls).toEqual([[" ข้าว "]]);
    expect(callbacks.onStatus.mock.calls).toEqual([["listening"], ["idle"]]);
    expect(recognition.stop).toHaveBeenCalledOnce();
    oldResult?.(finalResult("ข่าว"));
    vi.advanceTimersByTime(10_000);
    expect(callbacks.onTranscript).toHaveBeenCalledOnce();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resultIndex以前の古い結果を採用しない", () => {
    const { session, callbacks } = setup();
    session.start();
    MockRecognition.instances[0].onresult?.({
      resultIndex: 1,
      results: {
        length: 2,
        0: { isFinal: true, 0: { transcript: "旧結果" } },
        1: { isFinal: true, 0: { transcript: "น้ำ" } },
      },
    });
    expect(callbacks.onTranscript).toHaveBeenCalledWith("น้ำ");
  });

  it.each([
    undefined,
    {},
    { resultIndex: 0, results: null },
    { resultIndex: -1, results: { length: 1 } },
    { resultIndex: 1, results: { length: 1 } },
    { resultIndex: 0.5, results: { length: 1 } },
    { resultIndex: 0, results: { length: 33 } },
    { resultIndex: 0, results: { length: 1, 0: { isFinal: "true" } } },
    finalResult(undefined),
    finalResult(3),
    finalResult("  "),
    finalResult("ก".repeat(201)),
  ])("不正なブラウザ結果から回答を生成しない: %j", (event) => {
    const { session, callbacks } = setup();
    session.start();
    const recognition = MockRecognition.instances[0];
    recognition.onresult?.(event);
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("認識結果を確認できません"),
    );
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("停止・再開・破棄の境界", () => {
  it("二重開始を避け、停止後の古いイベントを次の回答に使わない", () => {
    const { session, callbacks } = setup();
    session.start();
    const first = MockRecognition.instances[0];
    const oldResult = first.onresult;
    const oldError = first.onerror;
    session.start();
    expect(MockRecognition.instances).toHaveLength(1);
    session.stop();
    expect(first.abort).toHaveBeenCalledOnce();
    expect(callbacks.onStatus).toHaveBeenLastCalledWith("idle");
    expect(first.onresult).toBeNull();
    session.start();
    expect(MockRecognition.instances).toHaveLength(2);
    oldResult?.(finalResult("旧結果"));
    oldError?.({ error: "network" });
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    MockRecognition.instances[1].onresult?.(finalResult("กา"));
    expect(callbacks.onTranscript.mock.calls).toEqual([["กา"]]);
  });

  it("マイク許可待ちでも開始を重ねず、9秒で中断する", () => {
    const callbacks = {
      onTranscript: vi.fn(),
      onStatus: vi.fn(),
      onError: vi.fn(),
    };
    // onstartが届かないブラウザを、インスタンスの初期化時に差し替える。
    class PendingRecognition extends MockRecognition {
      start = vi.fn();
    }
    vi.stubGlobal("window", { SpeechRecognition: PendingRecognition });
    const pendingSession = createBrowserRecognitionSession(callbacks);
    pendingSession?.start();
    pendingSession?.start();
    expect(MockRecognition.instances).toHaveLength(1);
    expect(callbacks.onStatus).toHaveBeenCalledWith("listening");
    vi.advanceTimersByTime(8_999);
    expect(callbacks.onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("時間内"),
    );
    expect(callbacks.onStatus).toHaveBeenLastCalledWith("idle");
    expect(MockRecognition.instances[0].abort).toHaveBeenCalledOnce();
    pendingSession?.dispose();
  });

  it("disposeはマイクを中断し、その後の通知と開始をすべて無効にする", () => {
    const { session, callbacks } = setup();
    session.start();
    const recognition = MockRecognition.instances[0];
    const lateResult = recognition.onresult;
    const lateEnd = recognition.onend;
    callbacks.onStatus.mockClear();
    session.dispose();
    session.dispose();
    session.stop();
    session.start();
    lateResult?.(finalResult("กา"));
    lateEnd?.();
    vi.advanceTimersByTime(20_000);
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onStatus).not.toHaveBeenCalled();
    expect(MockRecognition.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("利用者へ返すエラー", () => {
  it.each([
    ["not-allowed", "マイクを許可"],
    ["service-not-allowed", "文字入力"],
    ["no-speech", "音声を検出できません"],
    ["audio-capture", "マイクの接続"],
    ["network", "通信に失敗"],
    ["language-not-supported", "タイ語を利用できません"],
    ["aborted", "中断"],
    ["unexpected", "文字入力"],
  ])("%s を日本語の操作案内へ変換する", (error, message) => {
    const { session, callbacks } = setup();
    session.start();
    const recognition = MockRecognition.instances[0];
    const oldEnd = recognition.onend;
    recognition.onerror?.({ error, message: "Untrusted browser detail" });
    oldEnd?.();
    expect(callbacks.onError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(message),
    );
    expect(callbacks.onError.mock.calls[0][0]).not.toContain(
      "Untrusted browser detail",
    );
    expect(callbacks.onStatus).toHaveBeenLastCalledWith("idle");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("結果なしの終了にも再試行手順を表示する", () => {
    const { session, callbacks } = setup();
    session.start();
    MockRecognition.instances[0].onend?.();
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("認識結果を取得できません"),
    );
    expect(callbacks.onStatus).toHaveBeenLastCalledWith("idle");
  });

  it("開始時の権限例外でもタイマーとセッションを残さない", () => {
    class DeniedRecognition extends MockRecognition {
      start = vi.fn(() => {
        throw new DOMException("Denied", "NotAllowedError");
      });
    }
    const callbacks = {
      onTranscript: vi.fn(),
      onStatus: vi.fn(),
      onError: vi.fn(),
    };
    vi.stubGlobal("window", { SpeechRecognition: DeniedRecognition });
    const session = createBrowserRecognitionSession(callbacks);
    session?.start();
    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("マイクを許可"),
    );
    expect(vi.getTimerCount()).toBe(0);
    session?.start();
    expect(MockRecognition.instances).toHaveLength(2);
  });
});

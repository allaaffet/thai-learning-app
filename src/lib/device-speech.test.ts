import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSpeechController,
  isThaiSpeechText,
  selectThaiVoice,
  type SpeechBackend,
  type SpeechCallbacks,
  type SpeechEvents,
  type SpeechVoice,
} from "./device-speech";
import { speechQuestions } from "@/data/speech-practice";
import { lookupSyllable } from "@/data/syllables";

const thai: SpeechVoice = {
  name: "Thai device voice",
  lang: "th-TH",
  voiceURI: "thai",
  localService: true,
  default: false,
};
const japanese: SpeechVoice = {
  ...thai,
  name: "Japanese voice",
  voiceURI: "ja",
  lang: "ja-JP",
  default: true,
};
function fixture() {
  const events: SpeechEvents[] = [];
  const backend: SpeechBackend = {
    voices: () => [thai],
    subscribe: () => () => undefined,
    cancel: vi.fn(),
    speak: vi.fn((_text, _voice, callbacks) => {
      events.push(callbacks);
    }),
  };
  const controller = createSpeechController(backend);
  function callbacks(): SpeechCallbacks {
    return {
      start: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
      error: vi.fn(),
    };
  }
  return { backend, controller, events, callbacks };
}
afterEach(() => vi.useRealTimers());

describe("端末のタイ語合成音声", () => {
  it("例語の音声を綴りの模式図や母音のプレースホルダーに付けない", () => {
    expect(isThaiSpeechText("ป้า")).toBe(true);
    expect(isThaiSpeechText("กา ขา")).toBe(true);
    for (const text of [
      "-า",
      "ก + า → กา",
      "IPA /kaː/",
      "",
      " ี",
      "ก".repeat(201),
    ]) {
      expect(isThaiSpeechText(text)).toBe(false);
    }
  });
  it("マイク開始時は見本の再生を中断し、遅れた完了を無視する", () => {
    const f = fixture();
    const cb = f.callbacks();
    f.controller.play("lesson-example", "กา", thai, cb);
    f.controller.stopAll();
    expect(cb.cancel).toHaveBeenCalledOnce();
    expect(f.backend.cancel).toHaveBeenCalledOnce();
    f.events[0].end();
    expect(cb.complete).not.toHaveBeenCalled();
    f.controller.stopAll();
    expect(f.backend.cancel).toHaveBeenCalledOnce();
  });
  it("日本語の既定音声を代用せず、実際に見つかったタイ語音声だけを選ぶ", () => {
    expect(selectThaiVoice([japanese])).toBeUndefined();
    expect(selectThaiVoice([])).toBeUndefined();
    expect(selectThaiVoice([japanese, thai])).toBe(thai);
    expect(selectThaiVoice([{ ...thai, lang: "th_TH" }])?.lang).toBe("th_TH");
    expect(selectThaiVoice([{ ...thai, lang: "tha" }])).toBeUndefined();
  });
  it("タイ語の候補が複数あるときは端末内の声を優先する", () => {
    expect(selectThaiVoice([{ ...thai, localService: false }, thai])).toBe(
      thai,
    );
  });
  it("開始と完了を実際のAPIイベントから通知する", () => {
    const f = fixture();
    const cb = f.callbacks();
    f.controller.play("one", "กา", thai, cb);
    expect(cb.complete).not.toHaveBeenCalled();
    f.events[0].start();
    expect(cb.start).toHaveBeenCalledTimes(1);
    f.events[0].end();
    expect(cb.complete).toHaveBeenCalledTimes(1);
    f.events[0].end();
    expect(cb.complete).toHaveBeenCalledTimes(1);
  });
  it("再生を切り替えると古い音声を止め、遅れた古いイベントを無視する", () => {
    const f = fixture();
    const a = f.callbacks();
    const b = f.callbacks();
    f.controller.play("one", "กา", thai, a);
    f.controller.play("two", "หมา", thai, b);
    expect(a.cancel).toHaveBeenCalledTimes(1);
    f.events[0].end();
    f.events[0].error("old-error");
    expect(b.complete).not.toHaveBeenCalled();
    expect(b.error).not.toHaveBeenCalled();
    f.events[1].end();
    expect(b.complete).toHaveBeenCalledTimes(1);
  });
  it("画面を離れた古い所有者が、新しい所有者の音声を止めない", () => {
    const f = fixture();
    const a = f.callbacks();
    const b = f.callbacks();
    f.controller.play("one", "กา", thai, a);
    f.controller.play("two", "หมา", thai, b);
    vi.mocked(f.backend.cancel).mockClear();
    f.controller.stop("one");
    expect(f.backend.cancel).not.toHaveBeenCalled();
    f.controller.stop("two");
    expect(b.cancel).toHaveBeenCalledTimes(1);
    f.events[1].end();
    expect(b.complete).not.toHaveBeenCalled();
  });
  it("APIのエラーを完了扱いせず、再試行できる", () => {
    const f = fixture();
    const a = f.callbacks();
    f.controller.play("one", "กา", thai, a);
    f.events[0].error("network");
    expect(a.error).toHaveBeenCalledOnce();
    expect(a.complete).not.toHaveBeenCalled();
    const b = f.callbacks();
    f.controller.play("one", "กา", thai, b);
    f.events[1].end();
    expect(b.complete).toHaveBeenCalledOnce();
  });
  it("APIが例外を投げても再生中に取り残さない", () => {
    const f = fixture();
    vi.mocked(f.backend.speak).mockImplementation(() => {
      throw new Error("unavailable");
    });
    const cb = f.callbacks();
    expect(() => f.controller.play("one", "กา", thai, cb)).not.toThrow();
    expect(cb.error).toHaveBeenCalledOnce();
    expect(cb.complete).not.toHaveBeenCalled();
  });
  it("イベントが返らない端末でもタイムアウトして停止できる", () => {
    vi.useFakeTimers();
    const f = fixture();
    const cb = f.callbacks();
    f.controller.play("one", "กา", thai, cb);
    vi.advanceTimersByTime(30_000);
    expect(cb.error).toHaveBeenCalledOnce();
    expect(f.backend.cancel).toHaveBeenCalledOnce();
    f.events[0].end();
    expect(cb.complete).not.toHaveBeenCalled();
  });
  it("非タイ語音声や空の語をAPIへ渡さない", () => {
    const f = fixture();
    const cb = f.callbacks();
    f.controller.play("one", "กา", japanese, cb);
    f.controller.play("one", " ", thai, cb);
    expect(f.backend.speak).not.toHaveBeenCalled();
    expect(cb.error).toHaveBeenCalledTimes(2);
  });
  it.each(speechQuestions)(
    "$id の正解とIPAがカタログに一致し、選択肢が実在する",
    (question) => {
      expect(lookupSyllable(question.thai)).toMatchObject({
        ipa: question.ipa,
        expectedTone: question.tone,
      });
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(
        question.options.filter((option) => option === question.thai),
      ).toHaveLength(1);
      for (const option of question.options)
        expect(lookupSyllable(option)).toBeDefined();
    },
  );
});

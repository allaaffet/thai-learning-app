import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSoundEffectsPlayer,
  getBrowserSoundEffectsPlayer,
  type SoundEffect,
  type SoundEffectTone,
  type SoundEffectsContext,
  type SoundEffectVoice,
} from "@/lib/sound-effects";

function fakeContext(initial = "running") {
  let state = initial;
  const voices: SoundEffectVoice[] = [];
  const tones: SoundEffectTone[] = [];
  const context: SoundEffectsContext = {
    get state() {
      return state;
    },
    currentTime: 5,
    resume: vi.fn(async () => {
      state = "running";
    }),
    close: vi.fn(async () => {
      state = "closed";
    }),
    scheduleTone: vi.fn((tone) => {
      tones.push(tone);
      const voice = { stop: vi.fn(), disconnect: vi.fn() };
      voices.push(voice);
      return voice;
    }),
  };
  return {
    context,
    voices,
    tones,
    setState: (next: string) => {
      state = next;
    },
  };
}

function deferred() {
  let resolve: () => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("短い効果音の再生・取消し", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("作成・SSRではAudioContextを生成せず自動再生もしない", () => {
    const createContext = vi.fn(() => fakeContext().context);
    const player = createSoundEffectsPlayer({ createContext });
    expect(createContext).not.toHaveBeenCalled();
    expect(getBrowserSoundEffectsPlayer()).toBeUndefined();
    player.dispose();
    expect(createContext).not.toHaveBeenCalled();
  });

  it("ブラウザではゼロから上げてゼロへ戻す包絡を使い、終了した音源を解放する", () => {
    class FakeOscillator {
      type = "";
      frequency = { setValueAtTime: vi.fn() };
      onended: (() => void) | null = null;
      connect = vi.fn();
      start = vi.fn();
      stop = vi.fn();
      disconnect = vi.fn();
    }
    class FakeGain {
      gain = {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      };
      connect = vi.fn();
      disconnect = vi.fn();
    }
    class FakeAudioContext {
      static instances: FakeAudioContext[] = [];
      state = "running";
      currentTime = 2;
      destination = {};
      oscillators: FakeOscillator[] = [];
      gains: FakeGain[] = [];
      constructor() {
        FakeAudioContext.instances.push(this);
      }
      resume = vi.fn(async () => {});
      close = vi.fn(async () => {
        this.state = "closed";
      });
      createOscillator(): FakeOscillator {
        const oscillator = new FakeOscillator();
        this.oscillators.push(oscillator);
        return oscillator;
      }
      createGain(): FakeGain {
        const gain = new FakeGain();
        this.gains.push(gain);
        return gain;
      }
    }
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const player = getBrowserSoundEffectsPlayer();
    expect(player).toBeDefined();
    expect(FakeAudioContext.instances).toHaveLength(0);
    player?.play("correct", 0.35);
    const context = FakeAudioContext.instances[0];
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[0].type).toBe("sine");
    expect(
      context.oscillators[0].frequency.setValueAtTime,
    ).toHaveBeenCalledWith(659.25, 2.008);
    const envelope = context.gains[0].gain;
    expect(envelope.setValueAtTime).toHaveBeenCalledWith(0, 2.008);
    expect(envelope.linearRampToValueAtTime).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(0.042, 8),
      2.016,
    );
    expect(envelope.linearRampToValueAtTime).toHaveBeenNthCalledWith(
      2,
      0,
      expect.closeTo(2.103, 8),
    );
    context.oscillators[0].onended?.();
    expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce();
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce();
    player?.stop();
    expect(envelope.cancelScheduledValues).toHaveBeenCalledWith(2);
    expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce();
    expect(context.oscillators[1].disconnect).toHaveBeenCalledOnce();
    player?.dispose();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it.each<[SoundEffect, number, number]>([
    ["correct", 2, 0.3],
    ["incorrect", 2, 0.25],
    ["lesson-complete", 3, 0.65],
    ["review-complete", 2, 0.45],
  ])(
    "%s は小音量で短く終わり、すべての音源を解放する",
    async (kind, count, limit) => {
      const { context, voices, tones } = fakeContext();
      const player = createSoundEffectsPlayer({ createContext: () => context });
      player.play(kind, 0.35);
      expect(tones).toHaveLength(count);
      const first = tones[0].start;
      expect(
        Math.max(...tones.map((tone) => tone.start - first + tone.duration)),
      ).toBeLessThan(limit);
      for (const tone of tones) {
        expect(tone.gain).toBeCloseTo(0.042);
        expect(tone.frequency).toBeGreaterThan(250);
        expect(tone.start).toBeGreaterThan(context.currentTime);
      }
      await vi.runAllTimersAsync();
      for (const voice of voices) {
        expect(voice.stop).toHaveBeenCalledOnce();
        expect(voice.disconnect).toHaveBeenCalledOnce();
      }
      player.dispose();
      expect(context.close).toHaveBeenCalledOnce();
    },
  );

  it("新しい効果音は前の効果音を止める", () => {
    const { context, voices, tones } = fakeContext();
    const player = createSoundEffectsPlayer({ createContext: () => context });
    player.play("lesson-complete", 1);
    const previous = voices.slice();
    player.play("incorrect", 0.5);
    for (const voice of previous) expect(voice.stop).toHaveBeenCalledOnce();
    expect(tones).toHaveLength(5);
    for (const voice of voices.slice(3))
      expect(voice.stop).not.toHaveBeenCalled();
    player.dispose();
  });

  it("録音・読み上げなどでブロックされていればContextも作らない", () => {
    const createContext = vi.fn(() => fakeContext().context);
    const player = createSoundEffectsPlayer({
      isBlocked: () => true,
      createContext,
    });
    player.play("correct", 0.35);
    expect(createContext).not.toHaveBeenCalled();
    player.dispose();
  });

  it("resume待ちのあいだに音声フォーカスが移った場合も鳴らさない", async () => {
    const fake = fakeContext("suspended");
    const wait = deferred();
    let isBlocked = false;
    fake.context.resume = vi.fn(() => wait.promise);
    const player = createSoundEffectsPlayer({
      createContext: () => fake.context,
      isBlocked: () => isBlocked,
    });
    player.play("correct", 1);
    isBlocked = true;
    fake.setState("running");
    wait.resolve();
    await Promise.resolve();
    expect(fake.tones).toHaveLength(0);
    player.dispose();
  });

  it.each(["stop", "mute", "dispose", "replace"])(
    "resume待ちを%sしたあと遅れて完了しても復活しない",
    async (action) => {
      const fake = fakeContext("suspended");
      const wait = deferred();
      fake.context.resume = vi.fn(() => wait.promise);
      const player = createSoundEffectsPlayer({
        createContext: () => fake.context,
      });
      player.play("correct", 0.35);
      if (action === "stop") player.stop();
      else if (action === "mute") player.play("correct", 0);
      else if (action === "dispose") player.dispose();
      else player.play("incorrect", 0.35);
      fake.setState("running");
      wait.resolve();
      await Promise.resolve();
      expect(fake.tones.map((tone) => tone.frequency)).toEqual(
        action === "replace" ? [392, 329.63] : [],
      );
      player.dispose();
    },
  );

  it("再開が拒否されても学習を例外で止めず、次の操作で再試行できる", async () => {
    const fake = fakeContext("suspended");
    const wait = deferred();
    fake.context.resume = vi.fn(() => wait.promise);
    const onError = vi.fn();
    const player = createSoundEffectsPlayer({
      createContext: () => fake.context,
      onError,
    });
    expect(() => player.play("correct", 0.35)).not.toThrow();
    wait.reject(new Error("NotAllowedError"));
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("学習はそのまま"),
    );
    expect(fake.tones).toHaveLength(0);
    fake.setState("running");
    player.play("correct", 0.35);
    expect(fake.tones).toHaveLength(2);
    player.dispose();
  });

  it("取消し済みのresume失敗を画面へ遅れて通知しない", async () => {
    const fake = fakeContext("suspended");
    const wait = deferred();
    fake.context.resume = vi.fn(() => wait.promise);
    const onError = vi.fn();
    const player = createSoundEffectsPlayer({
      createContext: () => fake.context,
      onError,
    });
    player.play("correct", 1);
    player.stop();
    wait.reject(new Error("denied"));
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
    player.dispose();
  });

  it("非対応・Context生成失敗・音源途中失敗を隔離する", () => {
    const onError = vi.fn();
    const unsupported = createSoundEffectsPlayer({
      createContext: () => undefined,
      onError,
    });
    expect(() => unsupported.play("correct", 1)).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    const failed = createSoundEffectsPlayer({
      createContext: () => {
        throw new Error("unavailable");
      },
      onError,
    });
    expect(() => failed.play("correct", 1)).not.toThrow();
    const fake = fakeContext();
    const original = fake.context.scheduleTone;
    fake.context.scheduleTone = vi.fn((tone) => {
      if (fake.tones.length === 1) throw new Error("source failed");
      return original(tone);
    });
    const partial = createSoundEffectsPlayer({
      createContext: () => fake.context,
      onError,
    });
    expect(() => partial.play("correct", 1)).not.toThrow();
    expect(fake.voices[0].stop).toHaveBeenCalledOnce();
    expect(fake.voices[0].disconnect).toHaveBeenCalledOnce();
    unsupported.dispose();
    failed.dispose();
    partial.dispose();
  });

  it("有限の音量は0〜1に制限し、無効な入力は音源を作らない", () => {
    const fake = fakeContext();
    const createContext = vi.fn(() => fake.context);
    const player = createSoundEffectsPlayer({ createContext });
    for (const volume of [-1, 0, NaN, Infinity]) player.play("correct", volume);
    expect(createContext).not.toHaveBeenCalled();
    expect(() =>
      Reflect.apply(player.play, undefined, ["unknown", 1]),
    ).not.toThrow();
    expect(createContext).not.toHaveBeenCalled();
    player.play("correct", 100);
    expect(fake.tones.every((tone) => tone.gain === 0.12)).toBe(true);
    player.dispose();
    player.play("correct", 1);
    expect(fake.tones).toHaveLength(2);
  });

  it("外部で閉じられたContextを次回だけ作り直す", () => {
    const first = fakeContext();
    const second = fakeContext();
    const createContext = vi
      .fn()
      .mockReturnValueOnce(first.context)
      .mockReturnValueOnce(second.context);
    const player = createSoundEffectsPlayer({ createContext });
    player.play("correct", 1);
    first.setState("closed");
    player.play("incorrect", 1);
    expect(createContext).toHaveBeenCalledTimes(2);
    expect(second.tones).toHaveLength(2);
    player.dispose();
  });

  it("closeやcleanupの失敗も破棄後の再生を復活させない", async () => {
    const fake = fakeContext();
    fake.context.close = vi.fn(async () => {
      throw new Error("close failed");
    });
    const player = createSoundEffectsPlayer({
      createContext: () => fake.context,
    });
    player.play("correct", 1);
    fake.voices[0].stop = () => {
      throw new Error("stop failed");
    };
    expect(() => player.dispose()).not.toThrow();
    expect(fake.voices[1].disconnect).toHaveBeenCalledOnce();
    await Promise.resolve();
    player.dispose();
    expect(fake.context.close).toHaveBeenCalledOnce();
    player.play("correct", 1);
    expect(fake.tones).toHaveLength(2);
  });
});

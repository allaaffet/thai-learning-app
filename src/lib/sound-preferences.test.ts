import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_PREFERENCES_KEY,
  isSoundPreferences,
  loadSoundPreferences,
  parseSoundPreferences,
  saveSoundPreferences,
} from "@/lib/sound-preferences";

describe("任意の効果音設定", () => {
  it("初回は音を有効にせず、学習進捗とは別のキーを使う", () => {
    const getItem = vi.fn(() => null);
    expect(loadSoundPreferences({ getItem })).toEqual({
      preferences: { version: 1, enabled: false, volume: 0.35 },
      status: "default",
    });
    expect(getItem).toHaveBeenCalledWith("thai-learning.sound.v1");
    expect(Object.isFrozen(DEFAULT_SOUND_PREFERENCES)).toBe(true);
  });

  it("有効・無効と音量の両端を正しく復元する", () => {
    for (const enabled of [true, false]) {
      for (const volume of [0, 0.35, 1]) {
        const preferences = { version: 1, enabled, volume };
        const raw = JSON.stringify(preferences);
        expect(parseSoundPreferences(raw)).toEqual(preferences);
        expect(loadSoundPreferences({ getItem: () => raw })).toEqual({
          preferences,
          status: "saved",
        });
      }
    }
  });

  it.each([
    "broken",
    "null",
    "[]",
    "true",
    "{}",
    '{"version":2,"enabled":true,"volume":0.35}',
    '{"version":1,"enabled":"true","volume":0.35}',
    '{"version":1,"enabled":true,"volume":"0.35"}',
    '{"version":1,"enabled":true,"volume":-0.1}',
    '{"version":1,"enabled":true,"volume":1.01}',
    '{"version":1,"enabled":true,"volume":null}',
    '{"version":1,"enabled":true,"volume":1e400}',
  ])("不正な保存値 %s を勝手に修復・上書きしない", (raw) => {
    const setItem = vi.fn();
    const storage = { getItem: () => raw, setItem };
    expect(parseSoundPreferences(raw)).toBeUndefined();
    expect(loadSoundPreferences(storage)).toEqual({
      preferences: DEFAULT_SOUND_PREFERENCES,
      status: "invalid",
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("保存できない環境・SSRでも初期値を安全に使う", () => {
    expect(loadSoundPreferences().status).toBe("unavailable");
    expect(
      loadSoundPreferences({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toEqual({
      preferences: DEFAULT_SOUND_PREFERENCES,
      status: "unavailable",
    });
    expect(saveSoundPreferences({ ...DEFAULT_SOUND_PREFERENCES })).toBe(false);
  });

  it("明示された設定だけを書き込み、余分な情報や進捗を保存しない", () => {
    const setItem = vi.fn();
    const settings = {
      version: 1,
      enabled: true,
      volume: 0.2,
      ignored: "not saved",
    };
    expect(isSoundPreferences(settings)).toBe(true);
    if (!isSoundPreferences(settings))
      throw new Error("Expected valid settings");
    expect(saveSoundPreferences(settings, { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledExactlyOnceWith(
      SOUND_PREFERENCES_KEY,
      '{"version":1,"enabled":true,"volume":0.2}',
    );
    expect(
      saveSoundPreferences(settings, {
        setItem: () => {
          throw new Error("full");
        },
      }),
    ).toBe(false);
  });

  it("外部から不正な設定を渡しても保存しない", () => {
    const setItem = vi.fn();
    for (const value of [
      undefined,
      null,
      { version: 1, enabled: true, volume: NaN },
      { version: 1, enabled: true, volume: Infinity },
      { version: 1, enabled: true, volume: -1 },
    ]) {
      expect(
        Reflect.apply(saveSoundPreferences, undefined, [value, { setItem }]),
      ).toBe(false);
    }
    expect(setItem).not.toHaveBeenCalled();
  });

  it("初期値の参照を共有しない", () => {
    const first = loadSoundPreferences({ getItem: () => null });
    first.preferences.enabled = true;
    expect(
      loadSoundPreferences({ getItem: () => null }).preferences.enabled,
    ).toBe(false);
    expect(DEFAULT_SOUND_PREFERENCES.enabled).toBe(false);
  });
});

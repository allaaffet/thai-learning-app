import { describe, expect, it } from "vitest";
import {
  createRomanceStoryStorage,
  isRomanceSetting,
  romanceSettings,
} from "@/lib/romance-setting";
import {
  createEmptyRomance,
  loadRomanceProgress,
  replaceRomanceProgress,
  saveRomanceProgress,
  setRomanceProfile,
} from "@/lib/romance";

function memory(initial: [string, string][] = []) {
  const values = new Map(initial);
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("物語ごとの保存領域", () => {
  it("既存の街のキーを保ち、4つの保存先が重複しない", () => {
    expect(romanceSettings.city.relationshipKey).toBe(
      "thai-learning.romance.v1",
    );
    expect(romanceSettings.city.learningKey).toBe(
      "thai-learning.romance-learning.v1",
    );
    expect(
      new Set(
        Object.values(romanceSettings).flatMap((story) => [
          story.relationshipKey,
          story.learningKey,
        ]),
      ).size,
    ).toBe(4);
    expect(isRomanceSetting("city")).toBe(true);
    expect(isRomanceSetting("campus")).toBe(true);
    for (const value of ["unknown", "__proto__", null, {}, 1])
      expect(isRomanceSetting(value)).toBe(false);
  });

  it("キャンパスのプロフィールを保存しても街の履歴へ触れない", () => {
    const city = setRomanceProfile(createEmptyRomance(), "male", "warm");
    const campus = setRomanceProfile(createEmptyRomance(), "female", "curious");
    const disk = memory([
      [romanceSettings.city.relationshipKey, JSON.stringify(city)],
    ]);
    const scoped = createRomanceStoryStorage("campus", disk);
    expect(loadRomanceProgress(scoped).status).toBe("empty");
    expect(saveRomanceProgress(campus, scoped)).toBe(true);
    expect(loadRomanceProgress(scoped).state).toEqual(campus);
    expect(
      loadRomanceProgress(createRomanceStoryStorage("city", disk)).state,
    ).toEqual(city);
    expect(disk.values.size).toBe(2);
  });

  it("会話ノートも舞台ごとに分けて読み書きする", () => {
    const disk = memory([[romanceSettings.city.learningKey, "city-note"]]);
    const campus = createRomanceStoryStorage("campus", disk);
    expect(campus.getItem(romanceSettings.city.learningKey)).toBeNull();
    campus.setItem(romanceSettings.city.learningKey, "campus-note");
    expect(campus.getItem(romanceSettings.city.learningKey)).toBe(
      "campus-note",
    );
    expect(disk.getItem(romanceSettings.city.learningKey)).toBe("city-note");
    expect(disk.getItem(romanceSettings.campus.learningKey)).toBe(
      "campus-note",
    );
  });

  it("学園の未知版を保護し、明示置換も学園だけに限定する", () => {
    const valid = setRomanceProfile(createEmptyRomance(), "male", "calm");
    const unknown = '{"version":99,"keep":"campus"}';
    const city = JSON.stringify(valid);
    const disk = memory([
      [romanceSettings.city.relationshipKey, city],
      [romanceSettings.campus.relationshipKey, unknown],
    ]);
    const campus = createRomanceStoryStorage("campus", disk);
    expect(loadRomanceProgress(campus).status).toBe("invalid");
    expect(saveRomanceProgress(valid, campus)).toBe(false);
    expect(disk.getItem(romanceSettings.campus.relationshipKey)).toBe(unknown);
    expect(replaceRomanceProgress(valid, campus)).toBe(true);
    expect(loadRomanceProgress(campus).state).toEqual(valid);
    expect(disk.getItem(romanceSettings.city.relationshipKey)).toBe(city);
  });

  it("本編やSRS等のキーへ保存範囲を広げない", () => {
    const disk = memory();
    const campus = createRomanceStoryStorage("campus", disk);
    expect(() => campus.getItem("thai-learning.progress.v1")).toThrow();
    expect(() => campus.setItem("thai-learning.review.v1", "bad")).toThrow();
    expect(disk.values.size).toBe(0);
  });

  it("ストレージの拒否は既存の保存エラー処理へ渡す", () => {
    const denied = {
      getItem() {
        throw new DOMException("Denied", "SecurityError");
      },
      setItem() {
        throw new DOMException("Denied", "SecurityError");
      },
    };
    const campus = createRomanceStoryStorage("campus", denied);
    expect(loadRomanceProgress(campus).status).toBe("unavailable");
    expect(saveRomanceProgress(createEmptyRomance(), campus)).toBe(false);
    expect(replaceRomanceProgress(createEmptyRomance(), campus)).toBe(false);
  });
});

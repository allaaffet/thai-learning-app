/** Each adult story has its own local relationship and learning records. */
export type RomanceSetting = "city" | "campus";

export const romanceSettings = {
  city: {
    title: "街のデート編",
    href: "/romance",
    place: "Bangkok · After hours",
    description:
      "夜の待ち合わせ、ふたりだけの寄り道。ことばの先にある気持ちへ。",
    relationshipKey: "thai-learning.romance.v1",
    learningKey: "thai-learning.romance-learning.v1",
  },
  campus: {
    title: "キャンパス恋愛編",
    href: "/romance/campus",
    place: "Bangkok · Evening campus",
    description:
      "社会人が集う大学の夜間講座。隣の席から、放課後の特別な約束へ。",
    relationshipKey: "thai-learning.romance-campus.v1",
    learningKey: "thai-learning.romance-campus-learning.v1",
  },
} as const;

export function isRomanceSetting(value: unknown): value is RomanceSetting {
  return value === "city" || value === "campus";
}

/** Defer browser access until the guarded storage calls, including denied access. */
export function createRomanceStoryStorage(
  setting: RomanceSetting,
  storage?: Pick<Storage, "getItem" | "setItem">,
): Pick<Storage, "getItem" | "setItem"> {
  const keys = romanceSettings[setting];
  function scopedKey(key: string) {
    if (key === romanceSettings.city.relationshipKey)
      return keys.relationshipKey;
    if (key === romanceSettings.city.learningKey) return keys.learningKey;
    throw new Error("この物語の保存領域ではありません。");
  }
  return {
    getItem(key) {
      return (storage ?? window.localStorage).getItem(scopedKey(key));
    },
    setItem(key, value) {
      (storage ?? window.localStorage).setItem(scopedKey(key), value);
    },
  };
}

import { alphabetCharacters } from "@/data/alphabet";
import type { AlphabetCharacter } from "@/lib/alphabet-types";

function characterIdsFor(glyphs: string[]): string[] {
  return glyphs.map((glyph) => {
    const character = alphabetCharacters.find((entry) => entry.thai === glyph);
    if (!character) throw new Error(`文字データが見つかりません: ${glyph}`);
    return character.id;
  });
}

export const DEFAULT_CHARACTER_SELECTION: string[] = characterIdsFor([
  "ก",
  "ม",
  "น",
  "ง",
]);

export interface CharacterTrainingPreset {
  id: string;
  title: string;
  description: string;
  characterIds: string[];
}

/** 教材の字形・音価はalphabet.tsを参照し、ここでは練習する組合せだけを持つ。 */
export const CHARACTER_TRAINING_PRESETS: CharacterTrainingPreset[] = [
  {
    id: "first-four",
    title: "はじめの4文字",
    description: "4文字の名前を聞いて、字形と結び付けましょう。",
    characterIds: [...DEFAULT_CHARACTER_SELECTION],
  },
  {
    id: "basic-eight",
    title: "基本の8文字",
    description: "4文字に慣れたら、練習する文字を増やしましょう。",
    characterIds: characterIdsFor(["ก", "ม", "น", "ง", "จ", "ด", "ต", "บ"]),
  },
  {
    id: "shape-a",
    title: "見比べセット A",
    description: "3つの形を並べて見比べましょう。",
    characterIds: characterIdsFor(["ก", "ถ", "ภ"]),
  },
  {
    id: "shape-b",
    title: "見比べセット B",
    description: "形と名前を一緒に思い出しましょう。",
    characterIds: characterIdsFor(["ข", "ช", "ซ"]),
  },
  {
    id: "shape-c",
    title: "見比べセット C",
    description: "4つの形をゆっくり見比べましょう。",
    characterIds: characterIdsFor(["บ", "ป", "ผ", "ฝ"]),
  },
];

/** 「星形の凧の ฬ」のような語中の「の」を保ち、末尾の字母説明だけを外す。 */
export function getCharacterTrainingCue(
  entryOrId: AlphabetCharacter | string,
): string {
  const entry =
    typeof entryOrId === "string"
      ? alphabetCharacters.find((character) => character.id === entryOrId)
      : entryOrId;
  if (
    !entry ||
    typeof entry.meaning !== "string" ||
    typeof entry.thai !== "string"
  ) {
    throw new Error("文字の名前を確認できません。");
  }
  const suffix = `の ${entry.thai}`;
  const suffixIndex = entry.meaning.lastIndexOf(suffix);
  const annotation = entry.meaning.slice(suffixIndex + suffix.length);
  const cue = entry.meaning.slice(0, suffixIndex);
  if (
    suffixIndex <= 0 ||
    (annotation !== "" && annotation !== "（現在は通常使わない）") ||
    /[\u0e00-\u0e7f]/u.test(cue)
  ) {
    throw new Error("文字の名前の形式を確認できません。");
  }
  return cue;
}

/** IPAは既存の「字母名の最初の音節」、英字部分は発音記号ではないUnicode名。 */
export function getCharacterTrainingReading(
  entryOrId: AlphabetCharacter | string,
): { ipa: string; romanizedName: string } {
  const entry =
    typeof entryOrId === "string"
      ? alphabetCharacters.find((character) => character.id === entryOrId)
      : entryOrId;
  const match =
    entry && typeof entry.unicodeName === "string"
      ? /^THAI CHARACTER ([A-Z]+(?: [A-Z]+)*)$/.exec(entry.unicodeName)
      : null;
  if (
    !entry ||
    !match ||
    match[0] !== entry.unicodeName ||
    typeof entry.ipa !== "string" ||
    entry.ipa.length === 0
  ) {
    throw new Error("字母名の表記を確認できません。");
  }
  return { ipa: entry.ipa, romanizedName: match[1].toLowerCase() };
}

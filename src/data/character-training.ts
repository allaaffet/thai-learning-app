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
  {
    id: "shape-d",
    title: "見比べセット D",
    description: "文字の名前を聞きながら、細部を見比べましょう。",
    characterIds: characterIdsFor(["น", "ม", "ห"]),
  },
  {
    id: "shape-e",
    title: "見比べセット E",
    description: "名前と形を結び付けて、3文字を選び分けましょう。",
    characterIds: characterIdsFor(["ด", "ค", "ต"]),
  },
  {
    id: "mid-main",
    title: "中子音の7文字",
    description: "中子音の名前と字形を、一緒に確認しましょう。",
    characterIds: characterIdsFor(["ก", "จ", "ด", "ต", "บ", "ป", "อ"]),
  },
  {
    id: "mid-lookalikes",
    title: "中子音をもうひと組",
    description: "ฎ・ฏを加え、ด・ตと見比べましょう。",
    characterIds: characterIdsFor(["ฎ", "ฏ", "ด", "ต"]),
  },
  {
    id: "high-first",
    title: "高子音の6文字",
    description: "高子音の文字名を、6文字で聞いて確認しましょう。",
    characterIds: characterIdsFor(["ข", "ฉ", "ถ", "ผ", "ฝ", "ห"]),
  },
  {
    id: "high-more",
    title: "高子音をもうひと組",
    description: "ฐ・ศ・ษ・สの形と文字名を確認しましょう。",
    characterIds: characterIdsFor(["ฐ", "ศ", "ษ", "ส"]),
  },
  {
    id: "low-first",
    title: "低子音の5文字",
    description: "ค・ฆ・ช・ซ・ฌの名前を聞いて選びましょう。",
    characterIds: characterIdsFor(["ค", "ฆ", "ช", "ซ", "ฌ"]),
  },
  {
    id: "low-more",
    title: "低子音をもうひと組",
    description: "ฑ・ฒ・ท・ธ・พ・ฟ・ฮも、文字名で確かめましょう。",
    characterIds: characterIdsFor(["ฑ", "ฒ", "ท", "ธ", "พ", "ฟ", "ฮ"]),
  },
  {
    id: "sonorants-first",
    title: "響く子音の5文字",
    description: "ง・ญ・ณ・น・มの名前と形を結び付けましょう。",
    characterIds: characterIdsFor(["ง", "ญ", "ณ", "น", "ม"]),
  },
  {
    id: "sonorants-more",
    title: "響く子音をもうひと組",
    description: "ย・ร・ล・ว・ฬの文字名を聞き比べましょう。",
    characterIds: characterIdsFor(["ย", "ร", "ล", "ว", "ฬ"]),
  },
  {
    id: "sound-kh",
    title: "同じ基本音の文字 /kʰ/",
    description: "基本初頭音は共通です。字母名の全体を聞いて区別します。",
    characterIds: characterIdsFor(["ข", "ค", "ฆ"]),
  },
  {
    id: "sound-s",
    title: "同じ基本音の文字 /s/",
    description: "基本初頭音と字母名の違いを、4文字で確認しましょう。",
    characterIds: characterIdsFor(["ซ", "ศ", "ษ", "ส"]),
  },
  {
    id: "sound-ph",
    title: "同じ基本音の文字 /pʰ/",
    description: "ผ・พ・ภは、完全な字母名を聞いて選び分けます。",
    characterIds: characterIdsFor(["ผ", "พ", "ภ"]),
  },
  {
    id: "obsolete-letters",
    title: "廃用字も確認",
    description: "ฃ・ฅは現在通常使わない廃用字です。字母名と字形の確認用です。",
    characterIds: characterIdsFor(["ฃ", "ฅ"]),
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

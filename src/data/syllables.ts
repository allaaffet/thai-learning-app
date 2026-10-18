import type { ContentSource } from "@/lib/content-types";
import { determineTone, isSyllableAnalysis } from "@/lib/tone-engine";
import {
  toneLabels,
  type SyllableAnalysis,
  type SyllableEntry,
  type Tone,
  type ToneResult,
} from "@/lib/tone-types";

/** プログラム資料で基本表だけを照合。個々の語義・IPAの辞書照合とは区別する。 */
export const toneSources: ContentSource[] = [
  {
    id: "thai-tone-rules-phase3",
    title: "thpronun — ToneFromWritten の基本声調対応",
    publisher: "Thai Linux Working Group",
    url: "https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/thortho/thcons.cxx#L97",
    checkedAt: "2026-10-18",
    access: "accessible",
    scope:
      "固定コミットの97〜131行で、無記号の子音クラス・生死音節・母音長、およびไม้เอก/ไม้โทの基本対応のみ照合。実装コードは転載せず独立実装。この資料だけでは個別語のIPA・訳・先行子音の分析や綴りの適否は確認できないため、教材はunreviewed。",
  },
  {
    id: "wiktionary-ipa-phase3",
    title: "Thai Wiktionary IPA corpus（2020-02-11抽出）",
    publisher: "Thai Wiktionary contributors / PyThaiNLP",
    url: "https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv",
    checkedAt: "2026-10-18",
    access: "accessible",
    scope:
      "32語中30語のIPAのみ照合（จ๊ะ・จ๋า は収録なし）。音素間の空白を除き、/ / を付けて表記。ข้าว は長短両変種の収録があり長母音形を採用。日本語訳・字の分解・先行子音の説明は未照合。Thai Wiktionary由来、CC BY-SA 3.0。G2P/README.md に出典とライセンス記載。",
  },
  {
    id: "thai-language-tone-rules-blocked-phase3",
    title: "Thai-language.com — Tone Rules",
    publisher: "Thai-language.com",
    url: "https://www.thai-language.com/ref/tone-rules",
    checkedAt: "2026-10-18",
    access: "blocked",
    scope:
      "ネットワーク制限で本文を取得できず、教材との照合は未実施。語義・IPA・声調の専門家監修も未実施。",
  },
];

function analysis(
  consonantClass: SyllableAnalysis["consonantClass"],
  vowelLength: SyllableAnalysis["vowelLength"],
  codaType: SyllableAnalysis["codaType"],
  toneMark: SyllableAnalysis["toneMark"] = "none",
  onsetRule: SyllableAnalysis["onsetRule"] = "single",
): SyllableAnalysis {
  return { consonantClass, vowelLength, codaType, toneMark, onsetRule };
}

function syllable(
  id: string,
  thai: string,
  ipa: string,
  meaning: string,
  onset: string,
  vowel: string,
  coda: string,
  expectedTone: Tone,
  analyzed: SyllableAnalysis,
  note?: string,
): SyllableEntry {
  return {
    id,
    thai,
    ipa,
    meaning,
    onset,
    vowel,
    coda,
    analysis: analyzed,
    expectedTone,
    sourceIds: [
      "thai-tone-rules-phase3",
      ...(["cha-particle", "cha-affection"].includes(id)
        ? []
        : ["wiktionary-ipa-phase3"]),
    ],
    verification: "unreviewed",
    ...(note ? { note } : {}),
  };
}

/**
 * 教材用に読みを個別指定した1音節語。綴りの自動解析用辞書ではない。
 * 意味・IPA・分解は専門家監修前。モデルは標準的な発音を簡略表記する。
 * 声門閉鎖 /ʔ/ は短母音で終わる発音としてIPAに示し、coda字には補わない。
 * wiktionary-ipa-phase3 を付けた30語のIPAは、上記コーパスに照合・表記調整。
 * このIPAデータ部分は Thai Wiktionary contributors / PyThaiNLP, CC BY-SA 3.0。
 * https://creativecommons.org/licenses/by-sa/3.0/ （出典・変更内容は toneSources に記載）
 */
export const syllableEntries: SyllableEntry[] = [
  syllable(
    "ka-crow",
    "กา",
    "/kaː˧/",
    "カラス",
    "ก",
    "-า",
    "",
    "mid",
    analysis("mid", "long", "none"),
  ),
  syllable(
    "kha-leg",
    "ขา",
    "/kʰaː˩˩˦/",
    "脚・足",
    "ข",
    "-า",
    "",
    "rising",
    analysis("high", "long", "none"),
  ),
  syllable(
    "kha-stuck",
    "คา",
    "/kʰaː˧/",
    "引っかかる・途中で止まる",
    "ค",
    "-า",
    "",
    "mid",
    analysis("low", "long", "none"),
  ),
  syllable(
    "ka-estimate",
    "กะ",
    "/kaʔ˨˩/",
    "見積もる",
    "ก",
    "-ะ",
    "",
    "low",
    analysis("mid", "short", "none"),
    "末子音字がなくても、短母音の声門閉鎖で終わる死音節です。",
  ),
  syllable(
    "kin-eat",
    "กิน",
    "/kin˧/",
    "食べる",
    "ก",
    "-ิ",
    "น",
    "mid",
    analysis("mid", "short", "sonorant"),
  ),
  syllable(
    "khut-dig",
    "ขุด",
    "/kʰut̚˨˩/",
    "掘る",
    "ข",
    "-ุ",
    "ด",
    "low",
    analysis("high", "short", "stop"),
  ),
  syllable(
    "khit-think",
    "คิด",
    "/kʰit̚˦˥/",
    "考える",
    "ค",
    "-ิ",
    "ด",
    "high",
    analysis("low", "short", "stop"),
  ),
  syllable(
    "mak-many",
    "มาก",
    "/maːk̚˥˩/",
    "多い・とても",
    "ม",
    "-า",
    "ก",
    "falling",
    analysis("low", "long", "stop"),
  ),
  syllable(
    "rak-love",
    "รัก",
    "/rak̚˦˥/",
    "愛する",
    "ร",
    "-ั",
    "ก",
    "high",
    analysis("low", "short", "stop"),
  ),
  syllable(
    "phut-speak",
    "พูด",
    "/pʰuːt̚˥˩/",
    "話す",
    "พ",
    "-ู",
    "ด",
    "falling",
    analysis("low", "long", "stop"),
  ),
  syllable(
    "khao-rice",
    "ข้าว",
    "/kʰaːw˥˩/",
    "米・ご飯",
    "ข",
    "-า",
    "ว",
    "falling",
    analysis("high", "long", "sonorant", "mai-tho"),
    "参照コーパスには短母音の変種も収録されています。ここでは長母音形で分析します。",
  ),
  syllable(
    "khao-news",
    "ข่าว",
    "/kʰaːw˨˩/",
    "ニュース・知らせ",
    "ข",
    "-า",
    "ว",
    "low",
    analysis("high", "long", "sonorant", "mai-ek"),
  ),
  syllable(
    "kha-value",
    "ค่า",
    "/kʰaː˥˩/",
    "価値・代金",
    "ค",
    "-า",
    "",
    "falling",
    analysis("low", "long", "none", "mai-ek"),
  ),
  syllable(
    "kha-trade",
    "ค้า",
    "/kʰaː˦˥/",
    "商売する",
    "ค",
    "-า",
    "",
    "high",
    analysis("low", "long", "none", "mai-tho"),
  ),
  syllable(
    "di-good",
    "ดี",
    "/diː˧/",
    "良い",
    "ด",
    "-ี",
    "",
    "mid",
    analysis("mid", "long", "none"),
  ),
  syllable(
    "pa-forest",
    "ป่า",
    "/paː˨˩/",
    "森",
    "ป",
    "-า",
    "",
    "low",
    analysis("mid", "long", "none", "mai-ek"),
  ),
  syllable(
    "pa-aunt",
    "ป้า",
    "/paː˥˩/",
    "おば（親の姉）",
    "ป",
    "-า",
    "",
    "falling",
    analysis("mid", "long", "none", "mai-tho"),
  ),
  syllable(
    "to-table",
    "โต๊ะ",
    "/toʔ˦˥/",
    "机・テーブル",
    "ต",
    "โ-ะ",
    "",
    "high",
    analysis("mid", "short", "none", "mai-tri"),
    "โ-ะ の短母音。ไม้ตรี は死音節でも高調を表せます。",
  ),
  syllable(
    "cha-particle",
    "จ๊ะ",
    "/tɕaʔ˦˥/",
    "親しい相手への呼びかけ・返事の語尾",
    "จ",
    "-ะ",
    "",
    "high",
    analysis("mid", "short", "none", "mai-tri"),
  ),
  syllable(
    "cha-affection",
    "จ๋า",
    "/tɕaː˩˩˦/",
    "親しみを込めた呼びかけ・返事",
    "จ",
    "-า",
    "",
    "rising",
    analysis("mid", "long", "none", "mai-chattawa"),
  ),
  syllable(
    "nu-mouse",
    "หนู",
    "/nuː˩˩˦/",
    "ネズミ",
    "หน",
    "-ู",
    "",
    "rising",
    analysis("low", "long", "none", "none", "ho-nam"),
    "ห นำ。発音する น は低子音ですが、高子音の声調規則に従います。",
  ),
  syllable(
    "ma-dog",
    "หมา",
    "/maː˩˩˦/",
    "犬",
    "หม",
    "-า",
    "",
    "rising",
    analysis("low", "long", "none", "none", "ho-nam"),
  ),
  syllable(
    "ya-prohibit",
    "อย่า",
    "/jaː˨˩/",
    "〜しないで（禁止）",
    "อย",
    "-า",
    "",
    "low",
    analysis("low", "long", "none", "mai-ek", "o-nam"),
    "อ นำ は อย่า・อยู่・อย่าง・อยาก の語群などに限られます。任意の อ + ย に適用しません。",
  ),
  syllable(
    "pla-fish",
    "ปลา",
    "/plaː˧/",
    "魚",
    "ปล",
    "-า",
    "",
    "mid",
    analysis("mid", "long", "none", "none", "true-cluster"),
  ),
  syllable(
    "khwa-right",
    "ขวา",
    "/kʰwaː˩˩˦/",
    "右",
    "ขว",
    "-า",
    "",
    "rising",
    analysis("high", "long", "none", "none", "true-cluster"),
  ),
  syllable(
    "khwam-nominalizer",
    "ความ",
    "/kʰwaːm˧/",
    "〜さ・〜こと（抽象名詞を作る語）",
    "คว",
    "-า",
    "ม",
    "mid",
    analysis("low", "long", "sonorant", "none", "true-cluster"),
  ),
  syllable(
    "yut-stop",
    "หยุด",
    "/jut̚˨˩/",
    "止まる・止める",
    "หย",
    "-ุ",
    "ด",
    "low",
    analysis("low", "short", "stop", "none", "ho-nam"),
  ),
  syllable(
    "yai-big",
    "ใหญ่",
    "/jaj˨˩/",
    "大きい",
    "หญ",
    "ใ-",
    "",
    "low",
    analysis("low", "short", "sonorant", "mai-ek", "ho-nam"),
    "ใ- に含まれる末音 /j/ により生音節。独立した末子音字がなくても末音を確認します。",
  ),
  syllable(
    "yu-stay",
    "อยู่",
    "/juː˨˩/",
    "いる・ある・滞在する",
    "อย",
    "-ู",
    "",
    "low",
    analysis("low", "long", "none", "mai-ek", "o-nam"),
  ),
  syllable(
    "yak-want",
    "อยาก",
    "/jaːk̚˨˩/",
    "〜したい",
    "อย",
    "-า",
    "ก",
    "low",
    analysis("low", "long", "stop", "none", "o-nam"),
  ),
  syllable(
    "ma-come",
    "มา",
    "/maː˧/",
    "来る",
    "ม",
    "-า",
    "",
    "mid",
    analysis("low", "long", "none"),
  ),
  syllable(
    "ma-horse",
    "ม้า",
    "/maː˦˥/",
    "馬",
    "ม",
    "-า",
    "",
    "high",
    analysis("low", "long", "none", "mai-tho"),
  ),
];

/** 完全一致のみ。既知の語に似ているだけの綴りへ規則を転用しない。 */
export function lookupSyllable(thai: string): SyllableEntry | undefined {
  if (typeof thai !== "string") return undefined;
  const trimmed = thai.trim();
  return syllableEntries.find((entry) => entry.thai === trimmed);
}

function isTone(value: unknown): value is Tone {
  return (
    value === "mid" ||
    value === "low" ||
    value === "falling" ||
    value === "high" ||
    value === "rising"
  );
}

/** 例外は出典を伴う確認済み辞書指定だけで補完する。未確認なら判定しない。 */
export function analyzeEntry(entry: SyllableEntry): ToneResult {
  if (!entry || !isSyllableAnalysis(entry.analysis)) {
    return {
      status: "unknown",
      reason:
        "この語の音節分析がまだ登録されていません。綴りからは推測しません。",
      steps: [],
    };
  }
  if (!isTone(entry.expectedTone)) {
    return {
      status: "unknown",
      reason: "教材の声調情報が対応形式ではありません。",
      steps: [],
    };
  }

  const result = determineTone(entry.analysis);
  if (entry.dictionaryOverride !== undefined) {
    const override = entry.dictionaryOverride;
    if (
      !override ||
      entry.verification !== "source-checked" ||
      !isTone(override.tone) ||
      override.tone !== entry.expectedTone ||
      typeof override.reason !== "string" ||
      override.reason.trim().length === 0 ||
      !Array.isArray(override.sourceIds) ||
      override.sourceIds.length === 0 ||
      !Array.isArray(entry.sourceIds) ||
      override.sourceIds.some(
        (sourceId) =>
          typeof sourceId !== "string" ||
          sourceId.trim().length === 0 ||
          !entry.sourceIds.includes(sourceId),
      )
    ) {
      return {
        status: "unknown",
        reason:
          "例外の発音には、辞書との照合状態・出典・理由の確認が必要です。",
        steps: [],
      };
    }
    const classification = determineTone({
      ...entry.analysis,
      toneMark: "none",
    });
    if (classification.status === "unknown") return classification;
    return {
      status: "determined",
      tone: override.tone,
      syllableType: classification.syllableType,
      effectiveClass: classification.effectiveClass,
      steps: [
        ...classification.steps.slice(0, 2),
        `基本表の自動適用に代えて、出典で照合した辞書情報を使います。${override.reason}`,
        `辞書指定の声調は${toneLabels[override.tone]}です。`,
      ],
      method: "dictionary",
    };
  }
  if (result.status === "determined" && result.tone !== entry.expectedTone) {
    return {
      status: "unknown",
      reason:
        "教材の分析と登録声調が一致しません。確認が終わるまで判定を表示しません。",
      steps: [],
    };
  }
  return result;
}

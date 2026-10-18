import type { Tone } from "@/lib/tone-types";

/** Device synthesis is unreviewed; these optional questions never award XP. */
export interface SpeechQuestion {
  id: string;
  thai: string;
  ipa: string;
  meaning: string;
  tone: Tone;
  options: string[];
  explanation: string;
}
export const speechQuestions: SpeechQuestion[] = [
  {
    id: "speech-ka",
    thai: "กา",
    ipa: "/kaː˧/",
    meaning: "カラス",
    tone: "mid",
    options: ["ขา", "กา", "คา"],
    explanation:
      "กา は無気音 /k/ と長母音の中平調です。ขา は有気音 /kʰ/ の上昇調、คา は有気音の中平調です。息の違いと声調の両方を比べます。",
  },
  {
    id: "speech-ma",
    thai: "หมา",
    ipa: "/maː˩˩˦/",
    meaning: "犬",
    tone: "rising",
    options: ["มา", "ม้า", "หมา"],
    explanation:
      "หมา は ห นำ により高子音の規則を使い、記号なしの生音節なので上昇調です。มา は中平調、ม้า は高調です。",
  },
  {
    id: "speech-pa",
    thai: "ป้า",
    ipa: "/paː˥˩/",
    meaning: "おば（親の姉）",
    tone: "falling",
    options: ["ป้า", "ป่า", "กา"],
    explanation:
      "ป้า は中子音 ป とไม้โทの組み合わせで下降調です。ป่า はไม้เอกで低調です。語の頭の /p/ と /k/ の違いも確認します。",
  },
];

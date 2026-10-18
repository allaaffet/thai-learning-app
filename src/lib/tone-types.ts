import type { ConsonantClass, VerificationStatus } from "@/lib/content-types";

export type Tone = "mid" | "low" | "falling" | "high" | "rising";
export type ToneMark =
  | "none"
  | "mai-ek"
  | "mai-tho"
  | "mai-tri"
  | "mai-chattawa";
export type SyllableType = "live" | "dead";

/**
 * 読み方を既に確認した1音節の分析。綴りからの自動解析結果ではない。
 * ho-nam / o-nam の consonantClass は、発音する側の低子音を表す。
 */
export interface SyllableAnalysis {
  consonantClass: ConsonantClass;
  vowelLength: "short" | "long";
  codaType: "none" | "sonorant" | "stop";
  toneMark: ToneMark;
  onsetRule: "single" | "true-cluster" | "ho-nam" | "o-nam";
}

export type ToneResult =
  | {
      status: "determined";
      tone: Tone;
      syllableType: SyllableType;
      effectiveClass: ConsonantClass;
      steps: string[];
      method: "rule" | "dictionary";
    }
  | { status: "unknown"; reason: string; steps: string[] };

export interface SyllableEntry {
  id: string;
  thai: string;
  ipa: string;
  meaning: string;
  onset: string;
  vowel: string;
  coda: string;
  analysis?: SyllableAnalysis;
  expectedTone: Tone;
  sourceIds: string[];
  verification: VerificationStatus;
  note?: string;
  dictionaryOverride?: {
    tone: Tone;
    reason: string;
    sourceIds: string[];
  };
}

export const toneLabels: Record<Tone, string> = {
  mid: "中平調",
  low: "低調",
  falling: "下降調",
  high: "高調",
  rising: "上昇調",
};

export const toneMarkLabels: Record<ToneMark, string> = {
  none: "声調記号なし",
  "mai-ek": "ไม้เอก（่）",
  "mai-tho": "ไม้โท（้）",
  "mai-tri": "ไม้ตรี（๊）",
  "mai-chattawa": "ไม้จัตวา（๋）",
};

export const consonantClassLabels: Record<ConsonantClass, string> = {
  mid: "中子音",
  high: "高子音",
  low: "低子音",
};

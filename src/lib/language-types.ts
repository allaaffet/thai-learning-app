import type { ExampleSentence, VerificationStatus } from "@/lib/content-types";

/** 語彙・文法参照と復習に使う教材。学習画面や保存方式から独立させる。 */
export interface VocabularyEntry {
  id: string;
  thai: string;
  ipa: string;
  meaning: string;
  categoryId: string;
  level: "A1";
  /** 綴りを保った教材上の音節区切り。文字列の機械的分割には使わない。 */
  syllables: string[];
  example: ExampleSentence;
  relatedLessonIds: string[];
  sourceIds: string[];
  verification: VerificationStatus;
  note?: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  summary: string;
  explanation: string[];
  pattern: string;
  examples: (ExampleSentence & {
    segments: { thai: string; role: string }[];
  })[];
  relatedLessonIds: string[];
  vocabularyIds: string[];
  sourceIds: string[];
  verification: VerificationStatus;
}

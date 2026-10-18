import type {
  Character,
  ExampleSentence,
  VerificationStatus,
} from "@/lib/content-types";

/** 辞書の基本音と、現代語での使用状況を区別する。 */
export interface AlphabetCharacter extends Character {
  group: "consonant";
  usage: "common" | "obsolete";
  unicodeName: string;
  introducedInLessonIds: string[];
  note?: string;
  alternateInitialIpa?: string[];
}

/** `-` は子音の位置。母音自体のIPAに声調は含めない。 */
export interface VowelPattern {
  id: string;
  pattern: string;
  ipa: string;
  length: "short" | "long" | "special";
  position: "after" | "above" | "below" | "before" | "surround";
  pairId?: string;
  example: ExampleSentence;
  note: string;
  sourceIds: string[];
  verification: VerificationStatus;
}

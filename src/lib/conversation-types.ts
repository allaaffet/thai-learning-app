import type { VerificationStatus } from "@/lib/content-types";

/** 語のIPAだけを参照できるカタログ。意味・用法は監修完了としない。 */
export interface ConversationWord {
  id: string;
  thai: string;
  ipa: string;
  meaning: string;
  sourceIds: string[];
  verification: VerificationStatus;
}

/** 語のIDは教材作成時に明示した並び。全文IPAや自動解析結果ではない。 */
export interface ConversationPhrase {
  thai: string;
  meaning: string;
  wordIds: string[];
  note?: string;
}

export interface ConversationChoice {
  id: string;
  phrase: ConversationPhrase;
  explanation: string;
}

export interface ConversationStep {
  id: string;
  npc: ConversationPhrase;
  goal: string;
  choices: ConversationChoice[];
  answerIds: string[];
  explanation: string;
}

export interface ConversationScenario {
  id: string;
  title: string;
  setting: string;
  durationMinutes: number;
  objective: string;
  relatedLessonIds: string[];
  sourceIds: string[];
  verification: VerificationStatus;
  steps: ConversationStep[];
}

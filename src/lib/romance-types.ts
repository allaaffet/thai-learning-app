import type { VerificationStatus } from "@/lib/content-types";
import type { ConversationStep } from "@/lib/conversation-types";

/** 主人公と登場人物の物語上の設定。実在の人物の属性を推定しない。 */
export type RomanceGender = "male" | "female";
export type RomancePreference = "warm" | "calm" | "curious";
export type RomanceEpisodeId = "meet" | "cafe" | "likes" | "market" | "walk";

export interface RomanceCharacter {
  id: string;
  name: string;
  age: number;
  gender: RomanceGender;
  traits: RomancePreference[];
  description: string;
  portrait: { column: 0 | 1 | 2; row: 0 | 1 };
  episodeIntros: Record<RomanceEpisodeId, string>;
  episodeOutros: Record<RomanceEpisodeId, string>;
}

export interface RomanceEpisode {
  id: RomanceEpisodeId;
  number: number;
  title: string;
  setting: string;
  objective: string;
  sourceScenarioId: string | null;
  previousEpisodeId: RomanceEpisodeId | null;
  storyPrompt: string;
  sourceIds: string[];
  verification: VerificationStatus;
}

/** 正答は今回の会話目標に対してのみ判定し、好感度の物語選択と分ける。 */
export interface RomanceQuestion extends ConversationStep {
  sourceIds: string[];
  verification: VerificationStatus;
  sourceNote: string;
  sourceScenarioId?: string;
}

export interface RomanceStoryOption {
  id: string;
  label: string;
  reaction: string;
  affinityDelta: number;
}

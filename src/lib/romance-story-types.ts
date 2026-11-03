import type { RomanceEpisodeId } from "@/lib/romance-types";
import type { JourneyExpression } from "@/lib/romance-journey-types";

/** 日本語だけの物語。語学問題・好感度計算・実在の感情とは分離する。 */
export interface RomanceStoryRoute {
  title: string;
  teaser: string;
  scene: string;
  successBeat: string;
  memory: [title: string, detail: string];
  nextHook: string;
  closing: [
    {
      label: string;
      reaction: string;
      expression: JourneyExpression;
      nextHook: string;
    },
    {
      label: string;
      reaction: string;
      expression: JourneyExpression;
      nextHook: string;
    },
  ];
}

export interface RomanceStoryChapter {
  intro: string;
  listen: RomanceStoryRoute;
  lead: RomanceStoryRoute;
}

export type RomanceCharacterStory = Record<
  RomanceEpisodeId,
  RomanceStoryChapter
>;

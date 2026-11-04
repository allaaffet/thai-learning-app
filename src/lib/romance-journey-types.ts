import type { RomanceEpisodeId } from "@/lib/romance-types";
import type { RomanceExpression } from "@/lib/romance-expressions";

/** 表情は台本の演出。学習者の発音や実在の感情の推定ではない。 */
export type JourneyExpression = RomanceExpression;
export type JourneyRouteId = "listen" | "lead";
export type JourneySupport = "model" | "meaning" | "recall";

export interface JourneyWrapChoice {
  storyChoiceId: string;
  label: string;
  reaction: string;
  expression: JourneyExpression;
  nextHook?: string;
}

/** 会話の機能と、減らしていく学習支援。到達能力の認定ではない。 */
export interface JourneyChapter {
  episodeId: RomanceEpisodeId;
  level: number;
  skillTitle: string;
  canDo: string;
  bridge: string;
  buildQuestionIndex: 0 | 1 | 2;
  recallEpisodeIds: RomanceEpisodeId[];
  defaultSupport: JourneySupport;
}

/** どちらも妥当な物語の選択。Thaiの正答・好感度の正解を表さない。 */
export interface JourneyRoute {
  id: JourneyRouteId;
  title: string;
  teaser: string;
  scene: string;
  challenge: string;
  drillOrder: "build-first" | "recall-first";
  focusQuestionIndex: 0 | 1 | 2;
  successBeat: string;
  supportBeat: string;
  keepsake: { id: string; title: string; detail: string };
  nextHook: string;
  expression: JourneyExpression;
  wrapChoices: JourneyWrapChoice[];
}

export interface JourneyScene {
  characterId: string;
  episodeId: RomanceEpisodeId;
  intro: string;
  routes: [JourneyRoute, JourneyRoute];
}

import { getRomanceCharacter, getRomanceEpisode } from "@/data/romance";
import type {
  JourneyRoute,
  JourneyRouteId,
  JourneyScene,
} from "@/lib/romance-journey-types";
import type { RomanceEpisodeId } from "@/lib/romance-types";
import type {
  RomanceCharacterStory,
  RomanceStoryChapter,
  RomanceStoryRoute,
} from "@/lib/romance-story-types";
import { femaleCampusArcs } from "@/data/romance-campus-female";
import { maleCampusArcs } from "@/data/romance-campus-male";

/** 全員が27〜32歳の社会人。出来事・噂・人間関係は架空の物語。 */
export const campusSettingDescription =
  "バンコクの大学キャンパスで開かれる、社会人向け夜間文化・語学交流講座。27〜32歳の同級生たちの恋と噂、学園祭の夜の約束が交錯する物語です。";
export type CampusRouteDraft = RomanceStoryRoute;
export type CampusSceneDraft = RomanceStoryChapter;
export type CampusArc = RomanceCharacterStory;
const campusArcs: Record<string, CampusArc> = {
  ...femaleCampusArcs,
  ...maleCampusArcs,
};

const campusChallenges: Record<RomanceEpisodeId, string> = {
  meet: "交流講座のペア練習。挨拶・日本から来たこと・お礼への返答を、短いことばでつなごう。",
  cafe: "カフェテリアでの注文を、相手の店員役でリハーサル。水を頼み、コーヒーを断り、お礼を伝えよう。",
  likes:
    "講座の会話カードで、猫が好きなことと日本へ行きたい気持ちを伝える役の練習。実際の自分の好みを採点するものではありません。",
  market:
    "学園祭の買出しに向けて、20バーツの品を買う役を練習。値段を尋ね、買う意思とお礼を伝えよう。",
  walk: "講義棟を出る前の案内練習。トイレの場所を尋ね、右という方向を確認し、お礼で会話を結ぼう。",
};
const campusSupport: Record<string, string> = {
  mali: "マリはノートを二人の間へ戻した。『まだ余白があるから、一緒に確かめよう』。",
  rin: "リンがペンを置く。『分からないところは、そのまま聞いて。急いで次の頁へ行かなくていい』。",
  dao: "ダーオは隣の椅子を引いた。『言い直すのも、二人の会話のうち。もう一度、聞かせて』。",
  arun: "アルンはあなたの話す速さに合わせた。『ここでゆっくり試そう。待っているから』。",
  kiet: "キエットは会話カードを並べ直す。『練習は勝負じゃない。一緒に一手ずつ確かめよう』。",
  niran:
    "ニランは静かにうなずいた。『途切れても大丈夫。次のことばから、また始めよう』。",
};

/** 言語活動の参照IDは街編と共通。物語と記念品は学園編のものを返す。 */
export function getCampusJourneyScene(
  characterId: string,
  episodeId: string,
): JourneyScene | undefined {
  const character = getRomanceCharacter(characterId);
  const episode = getRomanceEpisode(episodeId);
  if (!character || !episode) return undefined;
  const arc = campusArcs[characterId];
  if (!arc) return undefined;
  const draft = arc[episode.id];
  if (!draft) return undefined;
  const routes = (["listen", "lead"] as const).map((routeId): JourneyRoute => {
    const branch = draft[routeId];
    return {
      id: routeId,
      title: branch.title,
      teaser: branch.teaser,
      scene: branch.scene,
      challenge: campusChallenges[episode.id],
      drillOrder: routeId === "listen" ? "recall-first" : "build-first",
      focusQuestionIndex: routeId === "listen" ? 1 : 0,
      successBeat: branch.successBeat,
      supportBeat: campusSupport[character.id],
      keepsake: {
        id: `campus-${character.id}-${episode.id}-${routeId}`,
        title: branch.memory[0],
        detail: branch.memory[1],
      },
      nextHook: branch.nextHook,
      expression: "thoughtful",
      wrapChoices: [
        {
          storyChoiceId: `${episode.id}-thoughtful`,
          label: branch.closing[0].label,
          reaction: branch.closing[0].reaction,
          expression: branch.closing[0].expression ?? "happy",
          nextHook: branch.closing[0].nextHook ?? branch.nextHook,
        },
        {
          storyChoiceId: `${episode.id}-gentle`,
          label: branch.closing[1].label,
          reaction: branch.closing[1].reaction,
          expression: branch.closing[1].expression ?? "thoughtful",
          nextHook: branch.closing[1].nextHook ?? branch.nextHook,
        },
      ],
    };
  });
  return {
    characterId: character.id,
    episodeId: episode.id,
    intro: draft.intro,
    routes: [routes[0], routes[1]],
  };
}

export function getCampusJourneyRoute(
  characterId: string,
  episodeId: string,
  routeId: string,
): JourneyRoute | undefined {
  return getCampusJourneyScene(characterId, episodeId)?.routes.find(
    (route) => route.id === routeId,
  );
}

export const campusRouteIds: readonly JourneyRouteId[] = ["listen", "lead"];

import { getRomanceCharacter, getRomanceEpisode } from "@/data/romance";
import type {
  JourneyChapter,
  JourneyRoute,
  JourneyRouteId,
  JourneyScene,
} from "@/lib/romance-journey-types";
import type { RomanceEpisodeId } from "@/lib/romance-types";
import type { RomanceCharacterStory } from "@/lib/romance-story-types";
import { femaleRomanceStories } from "@/data/romance-stories-female";
import { maleRomanceStories } from "@/data/romance-stories-male";

/** 恋愛場面の短い会話を段階化。物語の達成を会話能力の認定にしない。 */
export const journeyChapters: JourneyChapter[] = [
  {
    episodeId: "meet",
    level: 1,
    skillTitle: "会話の扉をひらく",
    canDo: "挨拶を返し、話す誘いに応じ、会えてうれしい気持ちを伝える練習。",
    bridge:
      "まずは音と意味を一緒に。お手本を見てから、短い返答を組み立てます。",
    buildQuestionIndex: 0,
    recallEpisodeIds: [],
    defaultSupport: "model",
  },
  {
    episodeId: "cafe",
    level: 2,
    skillTitle: "隣で、もう少し話したい",
    canDo: "隣に座る誘いに応じ、あなたと話したい、一緒に行こうと返す練習。",
    bridge:
      "以前の話の表現も確認します。初めての表現なら、お手本を開いてから進めましょう。",
    buildQuestionIndex: 0,
    recallEpisodeIds: ["meet"],
    defaultSupport: "model",
  },
  {
    episodeId: "likes",
    level: 3,
    skillTitle: "自分の気持ちを伝える",
    canDo: "褒め言葉にお礼を返し、あなたが好き、恋しかったと好意を伝える練習。",
    bridge:
      "選択肢の訳を最初は隠します。以前の話の表現も、初めてなら意味とお手本を確認できます。",
    buildQuestionIndex: 1,
    recallEpisodeIds: ["meet", "cafe"],
    defaultSupport: "meaning",
  },
  {
    episodeId: "market",
    level: 4,
    skillTitle: "ふたりのデートを約束する",
    canDo: "明日は空いている、あなたと行きたいと返し、また明日と約束する練習。",
    bridge:
      "空いている日→一緒に行く気持ち→待ち合わせの順でつなぎます。以前の話の表現も、初めてならお手本から確認できます。",
    buildQuestionIndex: 0,
    recallEpisodeIds: ["cafe", "likes"],
    defaultSupport: "recall",
  },
  {
    episodeId: "walk",
    level: 5,
    skillTitle: "今夜を、次の約束へ",
    canDo: "また会いたいと返し、明日の再会を約束して、おやすみを交わす練習。",
    bridge:
      "別れ際の気持ちと次に会う約束をつなぎます。以前の話の表現が初めてでも、お手本とヒントで確認できます。",
    buildQuestionIndex: 1,
    recallEpisodeIds: ["meet", "cafe", "likes", "market"],
    defaultSupport: "recall",
  },
];

/** 人物別の恋愛物語と、語学の目標・判定を分けて管理する。 */
const arcs: Record<string, RomanceCharacterStory> = {
  ...femaleRomanceStories,
  ...maleRomanceStories,
};

const supportBeats: Record<string, string> = {
  mali: "マリはスケッチ帳の余白を指した。『一つずつ確かめよう』。言い直す時間も、二人で過ごす時間に変わっていく。",
  rin: "リンは答えを急がず、伝えたいことと選んだ表現の違いを一緒に確認した。途中で確かめたから、次の一言を選べる。",
  dao: "ダーオは『もう一度試してみよう』と明るくうなずいた。分からないところを確かめてからでも、寄り道は続けられる。",
  arun: "アルンは急かさず、伝えたいことをもう一度一緒に確かめた。立ち止まったことで、次に使う短い言葉が見えてきた。",
  kiet: "キエットは一手戻すように、返答の意味を一緒に見直した。確かめながら進めるのも、二人で試す面白さだ。",
  niran:
    "ニランは別の色を試すように、返答を一緒に見直した。うまく伝わらなかったところからも、次の言葉を選び直せる。",
};

const challenges: Record<RomanceEpisodeId, string> = {
  meet: "目の前の相手へ挨拶を返す。話す誘いを受け、最後は『会えてうれしい』を言葉にしよう。",
  cafe: "隣へ座る誘いに応じ、『あなたと話したい』『一緒に行こう』で二人の時間を続けよう。",
  likes:
    "褒め言葉にはお礼を。好意を返す役で『あなたが好き』『恋しかった』を相手本人へ伝えよう。",
  market:
    "明日は空いていると返し、『あなたと行きたい』『また明日』で次のデートを約束しよう。",
  walk: "『また会いたい』を本人に返す。明日会う約束を交わし、『おやすみ』まで二人の会話をつなごう。",
};

export function getJourneyChapter(
  episodeId: string,
): JourneyChapter | undefined {
  return journeyChapters.find((chapter) => chapter.episodeId === episodeId);
}

export function getJourneyScene(
  characterId: string,
  episodeId: string,
): JourneyScene | undefined {
  if (!getRomanceCharacter(characterId) || !getRomanceEpisode(episodeId))
    return undefined;
  const chapter = getJourneyChapter(episodeId);
  const arc = arcs[characterId];
  if (!chapter || !arc) return undefined;
  const id = chapter.episodeId;
  const draft = arc[id];
  const routes = (["listen", "lead"] as const).map((routeId): JourneyRoute => {
    const branch = draft[routeId];
    return {
      id: routeId,
      title: branch.title,
      teaser: branch.teaser,
      scene: branch.scene,
      challenge: challenges[id],
      drillOrder: routeId === "listen" ? "recall-first" : "build-first",
      focusQuestionIndex: routeId === "listen" ? 1 : 0,
      successBeat: branch.successBeat,
      supportBeat: supportBeats[characterId],
      keepsake: {
        id: `${characterId}-${id}-${routeId}`,
        title: branch.memory[0],
        detail: branch.memory[1],
      },
      nextHook: branch.nextHook,
      expression: id === "walk" || id === "likes" ? "romantic" : "thoughtful",
      wrapChoices: [
        {
          storyChoiceId: `${id}-thoughtful`,
          label: branch.closing[0].label,
          reaction: branch.closing[0].reaction,
          expression: branch.closing[0].expression ?? "happy",
          nextHook: branch.closing[0].nextHook ?? branch.nextHook,
        },
        {
          storyChoiceId: `${id}-gentle`,
          label: branch.closing[1].label,
          reaction: branch.closing[1].reaction,
          expression: branch.closing[1].expression ?? "thoughtful",
          nextHook: branch.closing[1].nextHook ?? branch.nextHook,
        },
      ],
    };
  });
  return {
    characterId,
    episodeId: id,
    intro: draft.intro,
    routes: [routes[0], routes[1]],
  };
}

export function getJourneyRoute(
  characterId: string,
  episodeId: string,
  routeId: string,
): JourneyRoute | undefined {
  return getJourneyScene(characterId, episodeId)?.routes.find(
    (route) => route.id === routeId,
  );
}

/** 使えるルートIDの検証は保存側でも行う。未知の物語を推測しない。 */
export function isJourneyRouteId(value: unknown): value is JourneyRouteId {
  return value === "listen" || value === "lead";
}

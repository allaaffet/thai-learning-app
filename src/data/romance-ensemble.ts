import {
  getRomanceCharacter,
  getRomanceEpisode,
  romanceEpisodes,
} from "@/data/romance";
import {
  getRomanceCharacterProgress,
  isRomanceEpisodeUnlocked,
  type RomanceState,
} from "@/lib/romance";
import { isRomanceSetting, type RomanceSetting } from "@/lib/romance-setting";
import type { JourneyExpression } from "@/lib/romance-journey-types";
import type { RomanceEpisodeId, RomanceGender } from "@/lib/romance-types";

export interface EnsembleLine {
  characterId: string;
  text: string;
  expression: JourneyExpression;
}

export interface RomanceEnsembleScene {
  title: string;
  intro: string;
  groupLines: EnsembleLine[];
}

const cast = {
  male: ["mali", "rin", "dao"],
  female: ["arun", "kiet", "niran"],
} as const;

const invitations: Record<
  RomanceSetting,
  Record<string, Record<RomanceEpisodeId, string>>
> = {
  city: {
    mali: {
      meet: "隣、あなたのために空けてたの。まずは私から、名前を聞いてもいい？",
      cafe: "今夜の休憩、私が先に予約したって言ってもいい？ 二人で抜け出そうよ。",
      likes:
        "好きなものの話、私にはもう少し詳しく聞かせて。ほかの二人には、まだ内緒で。",
      market:
        "その週末、私と出かけるって返事を待ってた。今日こそデートって呼んでいい？",
      walk: "帰り道を私にちょうだい。今夜は、友だちの顔だけで帰したくない。",
    },
    rin: {
      meet: "その席、私の向かいも空いてるわ。三人に囲まれて困ってるなら、まず私と話す？",
      cafe: "静かな店を取ってあるの。あなたが来るなら、読書は今夜お休みにする。",
      likes:
        "私の好きなもの、もう気づいてる？ 答え合わせは、二人きりでしたいわ。",
      market:
        "今日の買い物は、あなたと行く口実。本を選んだあとも時間を空けてあるの。",
      walk: "次の約束を、曖昧なままにしたくないの。あなたの返事は私が最初に聞きたい。",
    },
    dao: {
      meet: "見つけた！ 今日、最初に声をかけるの私って決めてたの。ね、こっち来て。",
      cafe: "その休憩、私も誘ってよ。二人きりにするかどうかは、あなたの返事次第！",
      likes:
        "誰がいちばん気になるか、今すぐ聞いたら困る？ じゃあ私から質問していい？",
      market:
        "週末、空いてる？ 私とデートしてから帰る予定でいてよ。地図はもう作ったから。",
      walk: "今夜、私を選んだってはっきり言ってみて。言ってくれたら、続きは二人で決めよう。",
    },
    arun: {
      meet: "君が来ると思って、隣を空けておいた。名前より先に、ここへ座ってくれる？",
      cafe: "二人で話せる席、見つけてきたよ。ほかの二人には、少しだけ待ってもらおう。",
      likes: "君がどんな人に惹かれるか、気になってた。今日は僕が聞いてもいい？",
      market:
        "週末を僕にくれない？ カメラは置いていく。今日は君とのデートにしたい。",
      walk: "帰りは僕が送る。送るだけで終わらせたくないってことも、ちゃんと伝えておくね。",
    },
    kiet: {
      meet: "隣の席を取っておくのは、少し露骨でしたか。……でも、あなたに来てほしかったので。",
      cafe: "今夜は盤面を持ってきていません。あなたと二人で話す時間だけ、用意してきました。",
      likes:
        "好きなものの質問なら、僕も立候補します。答えによっては、次の一手を変えるので。",
      market:
        "休日の予定、まだ誰にも返事していませんか。僕の誘いも、先に聞いてください。",
      walk: "曖昧なまま帰すつもりで呼んだわけではありません。今度は、あなたの本音を聞かせて。",
    },
    niran: {
      meet: "来てくれてうれしい。ほかの二人も待ってたけど、最初の一言は僕にくれない？",
      cafe: "今夜の席、二人分だけ取ったんだ。もう一席増やす前に、君の返事を聞きたい。",
      likes:
        "君の好きなものを聞いてたら、僕の好きなものの話までしたくなった。二人で話そう。",
      market:
        "次の週末を僕にくれる？ 音楽の話だけで終わらない一日にしたいんだ。",
      walk: "帰る前に、僕をもう一度選んで。今夜の続きは、ほかの二人には聞かせたくない。",
    },
  },
  campus: {
    mali: {
      meet: "今日も私の隣、空いてるよ。ほかの二人が呼ぶ前に、座っちゃわない？",
      cafe: "休み時間、二人で中庭へ行こう。ちゃんとあなたの分も席を取ってきたから。",
      likes:
        "授業より気になってることがあるの。あなたが好きな人のこと、私から聞いてもいい？",
      market:
        "学園祭の買出し、私と同じ班にしようよ。そのあと、二人で回る約束もしたい。",
      walk: "祭りが終わったら、私と帰って。今夜くらいは、隣の席だけじゃ足りないから。",
    },
    rin: {
      meet: "配られた席表より、あなたの希望を聞きたいわ。図書室側の隣席はどう？",
      cafe: "放課後、図書室へ来ない？ 相談という名目は、そろそろ要らないと思うけれど。",
      likes:
        "同じ班の中で、いちばん気になる人は？ ……答えは廊下で、私だけに聞かせて。",
      market:
        "学園祭の準備、あなたと組みたいの。ほかの二人には私から言うから、返事をくれる？",
      walk: "門が閉まるまでに、あなたと話したいことがあるの。今夜の帰り道を予約させて。",
    },
    dao: {
      meet: "その席、私の隣！ って先に言った方が勝ち？ ねえ、あなたはどこに座りたい？",
      cafe: "みんなで休憩もいいけど、私とこっそり抜け出すのはどう？ 帰ってきたら、きっとばれるけど。",
      likes:
        "放課後、誰と話す予定？ 私はあなたに聞きたいことがあるから、先に立候補しとくね。",
      market:
        "学園祭デート、私の名前も予定表に入れて。準備の班も、隣を狙ってるから！",
      walk: "今日は私と正門まで帰ろう。ほかの二人が来る前に、ちゃんと誘いに来たんだから。",
    },
    arun: {
      meet: "同じ班になれたらと思ってた。よかったら僕の隣へ。ほかの二人も、もう席を空けてるけど。",
      cafe: "放課後、テラスへ来て。課題を口実にしたけど、君と二人で話したいんだ。",
      likes:
        "君の気になる人、僕も候補に入ってる？ 答えは授業のあと、二人で聞かせて。",
      market:
        "学園祭で一緒に回る役、僕に任せて。準備だけの約束で終わらせるつもりはないよ。",
      walk: "帰りは僕が隣を歩きたい。学園祭の夜を、三人と一緒のまま終わらせたくなくて。",
    },
    kiet: {
      meet: "席を三つも勧められたら困りますよね。僕の隣なら、まず名前から、ゆっくりどうぞ。",
      cafe: "休憩の順番待ちに並ぶのは、今日はやめます。あなたと二人で過ごしたい、と先に言います。",
      likes:
        "今夜、誰の誘いが気になっていますか。……僕の質問にだけ、少し本気で答えてほしいです。",
      market:
        "学園祭のペア、あなたを指名したいです。抽選に任せるつもりは、もうありません。",
      walk: "次の講座でも、その先でも隣にいたい。その返事を、帰る前に僕へください。",
    },
    niran: {
      meet: "君の隣、まだ間に合う？ さっき二人にも誘われてたから、僕も黙って待てなくなった。",
      cafe: "放課後、音楽室の前で待ってる。今夜は三人に向けた曲じゃなくて、君と話す時間がほしい。",
      likes:
        "好きな人の話をするなら、僕の前でしてよ。ほかの二人だけに聞かせるのは、ちょっと妬ける。",
      market:
        "学園祭のあと、二人で歩かない？ みんなに見つかっても、今日はごまかしたくないんだ。",
      walk: "祭りの最後の曲が終わったら、僕を迎えに来て。次の約束は、君と二人でしたい。",
    },
  },
};

const scenes: Record<
  RomanceSetting,
  Record<RomanceGender, RomanceEnsembleScene>
> = {
  city: {
    male: {
      title: "今夜のお誘い、ひとつじゃない。",
      intro:
        "カフェに着くと、マリは隣の椅子に鞄を置き、リンは向かいの席から手を振った。遅れてきたダーオは『え、二人とも、もう誘ってるの？』とあなたの袖を軽く引く。三人の視線が、同じ返事を待っている。",
      groupLines: [
        {
          characterId: "dao",
          text: "じゃあ今日は、三人ともデートに誘ってるってことでいい？",
          expression: "happy",
        },
        {
          characterId: "mali",
          text: "私は、最初からそのつもりだったけど。……あなたはどう思ってた？",
          expression: "happy",
        },
        {
          characterId: "rin",
          text: "みんなで話すのは賛成。でも、帰りの約束まで同じにするとは言っていないわ。",
          expression: "thoughtful",
        },
        {
          characterId: "dao",
          text: "それなら、次の二人きりの時間は早い者勝ちね。私も遠慮しないから！",
          expression: "happy",
        },
      ],
    },
    female: {
      title: "三人とも、あなたを待っていた。",
      intro:
        "夜の待ち合わせ場所で、アルンがあなたの鞄を気遣った。その隣からキエットが『今夜の予定は、僕の誘いも聞いてから』と口を挟む。ニランまで『二人きりだと思ってたの、僕だけ？』と笑って、あなたの顔をのぞき込んだ。",
      groupLines: [
        {
          characterId: "arun",
          text: "三人で待ってたけど、君と二人になるつもりで来たんだ。これは先に言っておく。",
          expression: "happy",
        },
        {
          characterId: "kiet",
          text: "そこは同じです。今日のために空けた時間、人数で割るつもりはありません。",
          expression: "thoughtful",
        },
        {
          characterId: "niran",
          text: "じゃあ、誰と帰るかはまだ決めないで。話してる間に、僕を選びたくなるかもしれないし。",
          expression: "happy",
        },
        {
          characterId: "arun",
          text: "みんなで過ごすのもいいね。でも、次に会う約束だけは譲りたくないな。",
          expression: "happy",
        },
      ],
    },
  },
  campus: {
    male: {
      title: "放課後の予定、三人から立候補。",
      intro:
        "夜間講座が終わると、マリがあなたのノートへ休憩のメモを挟んだ。リンは『図書室で待つと言ったわよね』と立ち止まり、ダーオは二人を見て『私との学園祭デートも、忘れないでよ』と笑う。同級生三人の誘いが、同じ放課後に重なった。",
      groupLines: [
        {
          characterId: "mali",
          text: "じゃあ、まずはみんなで休憩しよう？ そのあと、少しだけ私に時間をちょうだい。",
          expression: "happy",
        },
        {
          characterId: "dao",
          text: "『少しだけ』って、二人きりで抜け出すやつでしょ。私も同じこと考えてた！",
          expression: "happy",
        },
        {
          characterId: "rin",
          text: "だったら本人に決めてもらいましょう。次の授業の隣席も、まだ空けてあるもの。",
          expression: "thoughtful",
        },
        {
          characterId: "mali",
          text: "三人と仲良くするのはいいけど、私が誘ってる意味まで友だち扱いはしないでね。",
          expression: "happy",
        },
      ],
    },
    female: {
      title: "同じ班の三人が、あなたの隣を狙う。",
      intro:
        "社会人講座の教室を出ると、アルンが『帰り、一緒にどう？』と声をかけた。キエットがその横へ来て『学園祭の相談も、あなたと二人でしたいです』。さらにニランが『僕の約束は音楽室の前だったよね』と加わり、三人とも帰る気配がない。",
      groupLines: [
        {
          characterId: "niran",
          text: "三人とも、君に会う口実ばかり上手くなってるよね。僕もだけど。",
          expression: "happy",
        },
        {
          characterId: "arun",
          text: "だったら口実はやめよう。僕は、君とデートがしたい。",
          expression: "happy",
        },
        {
          characterId: "kiet",
          text: "僕も同じです。次の班分けがどうなっても、あなたを誘います。",
          expression: "thoughtful",
        },
        {
          characterId: "niran",
          text: "今夜はみんなで話してもいいよ。だけど、二人きりの続きまで諦めたわけじゃないから。",
          expression: "happy",
        },
      ],
    },
  },
};

const rivalLines: Record<string, [EnsembleLine, EnsembleLine, EnsembleLine]> = {
  mali: [
    {
      characterId: "mali",
      text: "私を選んでくれたんだ。じゃあ、今からは二人きりって期待してもいい？",
      expression: "happy",
    },
    {
      characterId: "rin",
      text: "今夜は譲るわ。でも、次の誘いまで遠慮するつもりはないから。",
      expression: "thoughtful",
    },
    {
      characterId: "dao",
      text: "マリ、うれしそう！ 次は私も本気で誘うから、予定を全部埋めないでね。",
      expression: "happy",
    },
  ],
  rin: [
    {
      characterId: "rin",
      text: "返事を待っていたの。今夜、私の誘いがどういう意味か、もう分かっているでしょう？",
      expression: "happy",
    },
    {
      characterId: "mali",
      text: "リンばっかりずるい、とは言わないけど。私との約束も、ちゃんと残しておいてね。",
      expression: "thoughtful",
    },
    {
      characterId: "dao",
      text: "次は私から迎えに行く。二人きりを邪魔しないのは、今夜だけってことで！",
      expression: "happy",
    },
  ],
  dao: [
    {
      characterId: "dao",
      text: "よし、今夜は私の番！ 二人とも見てるけど、デートって呼んじゃうからね。",
      expression: "happy",
    },
    {
      characterId: "mali",
      text: "そんなふうにはっきり誘うの、少し妬けるな。私も次は、ちゃんと言おうかな。",
      expression: "thoughtful",
    },
    {
      characterId: "rin",
      text: "楽しんできて。そのあとの予定が決まったら、私にも聞かせてくれる？",
      expression: "happy",
    },
  ],
  arun: [
    {
      characterId: "arun",
      text: "選んでくれてうれしい。二人の前でも、君との時間がほしいって言ってよかった。",
      expression: "happy",
    },
    {
      characterId: "kiet",
      text: "今日は先を越されましたね。次に誘うときは、もっとはっきり気持ちを伝えます。",
      expression: "thoughtful",
    },
    {
      characterId: "niran",
      text: "そんな顔されたら、こっちも本気になるよ。僕の次の誘いも、忘れないで。",
      expression: "happy",
    },
  ],
  kiet: [
    {
      characterId: "kiet",
      text: "返事をもらえて、今やっと安心しました。では、ここから先は二人の予定にしませんか。",
      expression: "happy",
    },
    {
      characterId: "arun",
      text: "今日は譲るよ。でも、君を誘うのをやめたわけじゃない。次は僕の返事も聞いて。",
      expression: "thoughtful",
    },
    {
      characterId: "niran",
      text: "キエット、ずいぶんうれしそう。僕もその顔を君の前でしてみたいな。",
      expression: "happy",
    },
  ],
  niran: [
    {
      characterId: "niran",
      text: "迎えに来た甲斐があった。今夜は、友だち同士の約束ってごまかさないから。",
      expression: "happy",
    },
    {
      characterId: "arun",
      text: "君が選んだなら、楽しんできて。帰ってきたら、次のデートは僕から誘わせて。",
      expression: "thoughtful",
    },
    {
      characterId: "kiet",
      text: "今回は見送ります。でも、次も同じ結果になるとは思わないでください。",
      expression: "happy",
    },
  ],
};

/** Only the next eligible personal scene is offered; all-complete routes replay the finale. */
export function getEnsembleNextEpisode(
  state: RomanceState,
  characterId: string,
): RomanceEpisodeId | undefined {
  const character = getRomanceCharacter(characterId);
  if (!character || !state.profile || character.gender === state.profile.gender)
    return undefined;
  const progress = getRomanceCharacterProgress(state, characterId);
  const next = romanceEpisodes.find(
    (episode) =>
      !progress.episodes[episode.id] &&
      isRomanceEpisodeUnlocked(state, characterId, episode.id),
  );
  if (next) return next.id;
  return romanceEpisodes.every((episode) => progress.episodes[episode.id]) &&
    isRomanceEpisodeUnlocked(state, characterId, "walk")
    ? "walk"
    : undefined;
}

export function getEnsembleScene(
  setting: RomanceSetting,
  gender: RomanceGender,
): RomanceEnsembleScene | undefined {
  if (!isRomanceSetting(setting) || (gender !== "male" && gender !== "female"))
    return undefined;
  return scenes[setting][gender];
}

export function getEnsembleInvitation(
  setting: RomanceSetting,
  characterId: string,
  episodeId: string,
): string | undefined {
  if (
    !isRomanceSetting(setting) ||
    !getRomanceCharacter(characterId) ||
    !getRomanceEpisode(episodeId)
  )
    return undefined;
  return invitations[setting][characterId]?.[getRomanceEpisode(episodeId)!.id];
}

export function getEnsembleReaction(
  characterId: string,
): readonly EnsembleLine[] | undefined {
  if (!getRomanceCharacter(characterId)) return undefined;
  return rivalLines[characterId];
}

export function getEnsembleCast(gender: RomanceGender): readonly string[] {
  return gender === "male" || gender === "female" ? cast[gender] : [];
}

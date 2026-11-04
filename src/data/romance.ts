import {
  getRomanceDialogueQuestions,
  romanceDialogueSources,
  romanceDialogueWords,
} from "@/data/romance-dialogue";
import { conversationSources } from "@/data/conversations";
import { languageSources } from "@/data/language";
import type { ContentSource } from "@/lib/content-types";
import type { ConversationWord } from "@/lib/conversation-types";
import type {
  RomanceCharacter,
  RomanceEpisode,
  RomanceEpisodeId,
  RomancePreference,
  RomanceQuestion,
  RomanceStoryOption,
} from "@/lib/romance-types";

export type {
  RomanceCharacter,
  RomanceEpisode,
  RomanceEpisodeId,
  RomanceGender,
  RomancePreference,
  RomanceQuestion,
  RomanceStoryOption,
} from "@/lib/romance-types";

/** 本編の語彙を増減せず、恋愛会話だけのカタログを使う。 */
export const romanceWords: ConversationWord[] = romanceDialogueWords;
export const romanceSources: ContentSource[] = [
  ...conversationSources,
  ...languageSources.filter(
    (source) =>
      source.id === "wiktionary-ipa-phase4" ||
      source.id === "ud-thai-grammar-phase4",
  ),
  ...romanceDialogueSources,
];
export const romanceSourceNotes =
  "新しい恋愛会話の16語句の辞書形IPAを固定資料と照合し、一部の語義も辞書と照合しています。組み合わせた例文・日本語訳・丁寧詞の用法・自然さは専門家監修前です。全文IPAやネイティブ録音の教材ではありません。";

function story(intros: string[], outros: string[]) {
  const ids: RomanceEpisodeId[] = ["meet", "cafe", "likes", "market", "walk"];
  if (intros.length !== ids.length || outros.length !== ids.length)
    throw new Error("物語の場面数が一致しません。");
  return {
    episodeIntros: {
      meet: intros[0],
      cafe: intros[1],
      likes: intros[2],
      market: intros[3],
      walk: intros[4],
    },
    episodeOutros: {
      meet: outros[0],
      cafe: outros[1],
      likes: outros[2],
      market: outros[3],
      walk: outros[4],
    },
  };
}

/** 全員が架空の成人。物語と好みは性別から自動生成せず個別に設定する。 */
export const romanceCharacters: RomanceCharacter[] = [
  {
    id: "mali",
    name: "マリ",
    age: 28,
    gender: "female",
    traits: ["warm", "calm"],
    description:
      "植物を描くイラストレーター。ふんわり笑って隣席を確保。二人にからかわれても、あなたを誘う番は譲らない。",
    portrait: { column: 0, row: 0 },
    ...story(
      [
        "バンコクのブックカフェ。窓際で植物を描いていたマリが、あなたへやわらかく挨拶した。今日は短いタイ語で話してみよう。",
        "カフェでマリが隣の椅子を引く。「ここ、いい？」。近くに座り、あなたも話したいと思っていたことを伝えよう。",
        "マリのスケッチ帳の中に、あなたの姿がある。からかわれて照れる彼女へ、好意と会えなかったときの気持ちを返してみよう。",
        "週末マーケットで、マリが明日の予定を尋ねてきた。次は二人で出かけたい気持ちを伝え、デートを約束しよう。",
        "夜の散歩が終わるころ、マリが少し名残惜しそうに立ち止まる。また会いたいと伝え、明日の約束とおやすみの言葉を交わそう。",
      ],
      [
        "「また、ここで会えたらうれしいね」とマリ。短い挨拶が、次に話す小さなきっかけになった。",
        "話したかった気持ちが伝わると、マリは椅子を少し近づけた。次の場所へも、一緒に歩いて行くことになった。",
        "マリはあなたの返事を聞いて、閉じかけたスケッチ帳をもう一度開いた。「好きな人のページ、増えそう」",
        "明日会う約束を、マリが手帳に書き込む。「買い物のついでじゃなくて、あなたに会う日ね」",
        "マリは「また明日」と笑い、帰宅後にも短いおやすみの言葉を送ってきた。二人の約束が、次の日へつながる。",
      ],
    ),
  },
  {
    id: "rin",
    name: "リン",
    age: 30,
    gender: "female",
    traits: ["calm", "curious"],
    description:
      "翻訳の仕事をする読書家。落ち着いた顔で『今夜の予定は私が先』。静かな口説き方ほど、二人を焦らせる。",
    portrait: { column: 1, row: 0 },
    ...story(
      [
        "ブックカフェの読書会で、リンと隣の席になった。彼女は本を閉じて、あなたへ挨拶する。まずは短い自己紹介から。",
        "読書の合間、リンがカフェであなたの隣席を指す。座っていいと返し、あなたと話したいと自分から伝えてみよう。",
        "リンが本を閉じ、「気になっている人は？」と尋ねる。好きなのはあなただと、短いタイ語で返してみよう。",
        "古本マーケットの帰り、リンが明日の予定を尋ねた。あなたと一緒に行きたいと、次のデートへつなげよう。",
        "夜の読書会の帰り道、リンが歩く速さを落とす。また会いたい気持ちを返し、明日の約束とおやすみを伝えよう。",
      ],
      [
        "リンは「知らない言葉があっても、一緒に確かめればいい」と微笑んだ。次の読書会にも顔を出してみたくなる。",
        "「私も、あなたと話したかった」とリン。隣り合う席から、次の寄り道の相談が始まった。",
        "リンは本へ視線を戻しかけ、やめた。「その返事、もう少しだけ覚えていたい」。静かな声に、好意が隠れなくなった。",
        "リンは明日の予定に二人の待ち合わせを入れた。「楽しみにしてる。今度は、本よりあなたの話を聞きたい」",
        "「また明日。よい夢を」とリン。別れ際の短い会話が、次に会う日を待つ楽しみに変わった。",
      ],
    ),
  },
  {
    id: "dao",
    name: "ダーオ",
    age: 27,
    gender: "female",
    traits: ["warm", "curious"],
    description:
      "街歩きが好きな編集者。『そのデート、私も行く！』と大胆に参戦。冗談の顔で、いちばん直球の好意を向ける。",
    portrait: { column: 2, row: 0 },
    ...story(
      [
        "カフェのイベントで、ダーオが話しかけてきた。明るい挨拶につられて、あなたもタイ語で返してみる。",
        "カフェでダーオがあなたの隣へ。「ここ、空いてる？」。話したい気持ちを返し、次の寄り道へ二人で行こう。",
        "「誰が好きか、今聞いてもいい？」とダーオがからかう。好きなのはあなただと、照れずに返してみよう。",
        "マーケットの途中で、ダーオが明日も出かけないかと誘う。あなたと行きたい気持ちを伝え、二人の予定を決めよう。",
        "街歩きの夜、ダーオが「まだ帰りたくない顔してる？」と笑う。また会いたいと返し、明日の約束とおやすみを交わそう。",
      ],
      [
        "「その挨拶、覚えてくれたんだね」とダーオ。次はもう一言、話してみたくなった。",
        "ダーオは話したいという返事を聞いて笑った。「じゃあ次の店も一緒ね」。隣を歩く距離が、少し近くなった。",
        "「そういうの、急に言うんだ！」とダーオ。からかっていたはずの彼女が、今度はあなたの返事に照れている。",
        "ダーオは明日の待ち合わせをすぐに決めた。「もうデートって呼んでいいよね？」次のお誘いも、遠慮がない。",
        "「また明日ね。よい夢を」とダーオ。帰ってからも、次のデートの話が短いメッセージで続いた。",
      ],
    ),
  },
  {
    id: "arun",
    name: "アルン",
    age: 29,
    gender: "male",
    traits: ["warm", "calm"],
    description:
      "写真とコーヒーが好きな建築スタッフ。気さくな笑顔でエスコート。ほかの二人の前でも、あなたとのデートに立候補する。",
    portrait: { column: 0, row: 1 },
    ...story(
      [
        "ブックカフェの写真展示で、アルンと目が合った。彼は写真から少し離れ、あなたに丁寧に挨拶した。",
        "カフェのアルンが、隣に座っていいか尋ねる。話したかった気持ちを返し、二人で次の場所へ向かおう。",
        "アルンがカメラを置き、誰が気になっているかを尋ねた。好きなのはあなただと返し、会えない間の気持ちも伝えよう。",
        "マーケットの帰り、アルンが明日の予定を聞いてきた。あなたと行きたいと返して、二人のデートを約束しよう。",
        "夜の散歩の終わり、アルンが名残惜しそうにこちらを見る。また会いたいと伝え、明日の約束とおやすみを交わそう。",
      ],
      [
        "アルンはあなたの話を急かさず聞いていた。「また、写真の話をしよう」。次の楽しみが一つ増えた。",
        "アルンは「話したかった」と返すあなたへ笑った。「僕も。じゃあ、次も一緒に行こう」二人の寄り道が始まる。",
        "アルンはカメラへ手を戻さなかった。「今のは、写真より覚えておきたい」。あなたの好意を、真っすぐ受け止めている。",
        "アルンは明日の待ち合わせを決め、写真の予定を空けた。「君と出かける日だから。ほかの用事は入れないよ」",
        "「また明日。よい夢を」とアルン。夜の別れが、もう次に会う約束になっていた。",
      ],
    ),
  },
  {
    id: "kiet",
    name: "キエット",
    age: 32,
    gender: "male",
    traits: ["calm", "curious"],
    description:
      "本とボードゲームが好きな研究職。恋も考えすぎるけれど、今日は待つ気なし。丁寧な口調で二人きりの時間を取りにくる。",
    portrait: { column: 1, row: 1 },
    ...story(
      [
        "ブックカフェのゲーム会で、キエットと同じテーブルになった。始まる前に、タイ語で挨拶を交わしてみよう。",
        "ゲームの休憩、キエットがカフェで隣席を空ける。話したい気持ちを伝え、次の場所にも一緒に行こう。",
        "キエットが盤面を片付け、「好きな人はいますか」と聞いてくる。あなたが好きだと返し、会えなかった日の気持ちも話そう。",
        "マーケットでキエットが手に取った予定帳。明日は空いていると答え、二人で出かけたい気持ちを伝えよう。",
        "夜の帰り道、キエットがもう一度会いたいと言う。自分も会いたい気持ちを返し、明日の約束とおやすみを伝えよう。",
      ],
      [
        "キエットは「分からない言葉を一緒に考えるのも楽しい」と言った。挨拶から、少しずつ話が広がる。",
        "キエットは隣で話す約束を受け取り、片付けを早めた。「では、ここからは二人の時間ですね」",
        "キエットは一瞬だけ言葉を探した。「率直に言われると、予想よりずっと嬉しいですね」。考えるより先に、笑顔がこぼれた。",
        "キエットは明日の予定へ、あなたとの待ち合わせを書いた。「今度はゲームの人数に数えず、二人で会いたいです」",
        "キエットは「また明日。よい夢を」と丁寧に返した。次に会う約束が、今夜の最後の一手になった。",
      ],
    ),
  },
  {
    id: "niran",
    name: "ニラン",
    age: 31,
    gender: "male",
    traits: ["warm", "curious"],
    description:
      "音楽が好きなデザイナー。柔らかな声で、さらりと距離を詰める。三人でいても、あなたにだけ伝わる誘いを忍ばせる。",
    portrait: { column: 2, row: 1 },
    ...story(
      [
        "カフェの小さな展示で、ニランがあなたに挨拶した。作品の話を始める前に、タイ語で短く返してみよう。",
        "ニランがカフェであなたの隣を指す。「ここ、いい？」。あなたと話したい気持ちを返し、二人で次の場所へ歩こう。",
        "ニランが音楽を止め、「誰のことを考えていた？」と聞く。好きなのはあなただと、会えない間の気持ちも伝えてみよう。",
        "マーケットの終わり、ニランから明日の誘いが届く。空いていると返し、あなたと行きたい気持ちでデートを約束しよう。",
        "夜の散歩が終わり、ニランが次に会う話を始める。また会いたいと伝え、明日の約束とおやすみで今夜を結ぼう。",
      ],
      [
        "ニランはあなたの挨拶に、嬉しそうに応じた。「次は、作品の感想も聞かせて」。また話すきっかけができた。",
        "ニランはあなたの返事にうなずき、椅子を少し近づけた。「じゃあ、今日はもう少し、二人で話していよう」",
        "ニランは「それ、聞きたかった」と笑う。言葉で返した好意が、二人の会話をもう一段近づけた。",
        "明日の約束が決まると、ニランは待ち合わせの場所を確かめた。「君と行けるなら、きっと楽しいと思う」",
        "ニランから「また明日。よい夢を」というメッセージ。今夜の続きを、次に会う日まで少し楽しみに待てる。",
      ],
    ),
  },
];

const sourceIds = romanceSources.map((source) => source.id);
export const romanceEpisodes: RomanceEpisode[] = [
  {
    id: "meet",
    number: 1,
    title: "はじめまして、から",
    setting:
      "目が合った相手に挨拶を返し、話すことを受け入れ、会えてうれしい気持ちを伝えます。",
    objective: "挨拶・会話への承諾・会えてうれしい気持ちを伝える。",
    sourceScenarioId: null,
    previousEpisodeId: null,
    storyPrompt: "最初の会話のあと、どんなふうに過ごす？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "cafe",
    number: 2,
    title: "隣に座っても、いい？",
    setting:
      "カフェで近くに座り、相手と話したいことや、一緒に過ごしたい気持ちを伝えます。",
    objective: "隣席を受け入れ、あなたと話したい・一緒に行くと伝える。",
    sourceScenarioId: null,
    previousEpisodeId: "meet",
    storyPrompt: "隣にいる相手と、どんな時間を過ごそう？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "likes",
    number: 3,
    title: "好きなのは、あなた",
    setting:
      "褒め言葉にお礼を返し、誰が好きなのか、会えないときに思い出していた気持ちを伝えます。",
    objective: "褒め言葉へのお礼・あなたが好き・あなたが恋しいを伝える。",
    sourceScenarioId: null,
    previousEpisodeId: "cafe",
    storyPrompt: "好意を向けてくる相手に、どこまで気持ちを伝えよう？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "market",
    number: 4,
    title: "ふたりのデートの約束",
    setting:
      "街歩きや学園祭の準備の合間に、明日の予定を話し、一緒に出かける約束をします。",
    objective: "明日の予定・あなたと行きたい・また明日を伝える。",
    sourceScenarioId: null,
    previousEpisodeId: "likes",
    storyPrompt: "二人で出かける約束。どんなふうに誘いに応えよう？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "walk",
    number: 5,
    title: "また会いたい、おやすみ",
    setting:
      "帰り道や夜のメッセージで、また会いたいと伝え、明日の約束とおやすみの言葉を交わします。",
    objective: "また会いたい・明日会おう・おやすみを伝える。",
    sourceScenarioId: null,
    previousEpisodeId: "market",
    storyPrompt: "帰り道。次に会うことについて、どう話そう？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
];

export function getRomanceCharacter(id: string): RomanceCharacter | undefined {
  return romanceCharacters.find((character) => character.id === id);
}
export function getRomanceEpisode(id: string): RomanceEpisode | undefined {
  return romanceEpisodes.find((episode) => episode.id === id);
}

export function getRomanceQuestions(
  characterId: string,
  episodeId: string,
): RomanceQuestion[] {
  const character = getRomanceCharacter(characterId);
  const episode = getRomanceEpisode(episodeId);
  return character && episode
    ? getRomanceDialogueQuestions(character.gender, episode.id)
    : [];
}

const thoughtful: Record<RomancePreference, [string, string]> = {
  warm: [
    "相手の話にうなずき、もう少し聞いてみる",
    "話を楽しそうに聞いてくれたことが、相手にはうれしかったようです。",
  ],
  calm: [
    "急がず、相手のペースで過ごそうと伝える",
    "ゆっくり過ごせると分かって、相手の表情がほっとやわらぎました。",
  ],
  curious: [
    "好きなものや選んだ理由を、丁寧に聞いてみる",
    "興味を持ってくれたあなたに、相手も楽しそうに話を続けます。",
  ],
};
const neutral: Record<RomanceEpisodeId, string> = {
  meet: "今日は短く挨拶し、また会えたら話そうと伝える",
  cafe: "無理せず、今日はそれぞれの時間も大切にする",
  likes: "違う好みもあることを、自然に受け止める",
  market: "互いに気になったものを、自由に見てみる",
  walk: "次の予定は急がず、また相談しようと伝える",
};
const dismissive: Record<RomanceEpisodeId, string> = {
  meet: "相手の話を遮って、自分の話だけを続ける",
  cafe: "相手の希望を聞かず、自分の予定を押しつける",
  likes: "相手の好きなものを、一方的にけなす",
  market: "相手が選んだものを、理由も聞かずに否定する",
  walk: "相手の都合を聞かず、次の予定を勝手に決める",
};

/** 物語の選択。Thaiの正誤・実在の人の性格や好意を判定する規則ではない。 */
export function getRomanceStoryOptions(
  characterId: string,
  episodeId: string,
): RomanceStoryOption[] {
  const character = getRomanceCharacter(characterId),
    episode = getRomanceEpisode(episodeId);
  if (!character || !episode) return [];
  const trait =
    character.traits[(episode.number - 1) % character.traits.length];
  const [label, reaction] = thoughtful[trait];
  return [
    { id: `${episode.id}-thoughtful`, label, reaction, affinityDelta: 3 },
    {
      id: `${episode.id}-gentle`,
      label: neutral[episode.id],
      reaction:
        "互いのペースを大切にする返事に、相手は穏やかにうなずきました。",
      affinityDelta: 1,
    },
    {
      id: `${episode.id}-dismiss`,
      label: dismissive[episode.id],
      reaction:
        "相手は少し話しづらそうです。次は相手の気持ちや希望も聞いてみましょう。",
      affinityDelta: -2,
    },
  ];
}

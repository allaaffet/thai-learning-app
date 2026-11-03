import {
  conversationScenarios,
  conversationSources,
  conversationWords,
} from "@/data/conversations";
import { getVocabularyEntry, languageSources } from "@/data/language";
import type { ContentSource } from "@/lib/content-types";
import type {
  ConversationChoice,
  ConversationPhrase,
  ConversationStep,
  ConversationWord,
} from "@/lib/conversation-types";
import type {
  RomanceCharacter,
  RomanceEpisode,
  RomanceEpisodeId,
  RomanceGender,
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

/** 既存のカタログを増減せず、このコースだけで「好き」「猫」を参照する。 */
export const romanceWords: ConversationWord[] = [
  ...conversationWords.map((word) => ({
    ...word,
    sourceIds: [...word.sourceIds],
  })),
  ...["like", "cat"].map((id) => {
    const word = getVocabularyEntry(id);
    if (!word) throw new Error("恋愛コースの参照語がありません: " + id);
    return {
      id: word.id,
      thai: word.thai,
      ipa: word.ipa,
      meaning: word.meaning,
      sourceIds: [...word.sourceIds],
      verification: "unreviewed" as const,
    };
  }),
];
const words = new Map(romanceWords.map((word) => [word.id, word]));
export const romanceSources: ContentSource[] = [
  ...conversationSources,
  ...languageSources,
].filter(
  (source) =>
    source.id === "wiktionary-ipa-phase4" ||
    source.id === "wiktionary-ipa-phase5" ||
    source.id === "ud-thai-grammar-phase4",
);
export const romanceSourceNotes =
  "既存教材の語句IPAと基本の質問の説明を再利用しています。物語・日本語訳・組み合わせた会話・丁寧詞の使い方は専門家監修前です。新たな辞書の取得・照合や、文全体のIPA生成は行っていません。";

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
        "マリが顔を覚えていてくれた。カフェの注文を練習してみようと、笑顔で店員役を引き受けてくれる。",
        "机の上にはマリが描いた猫のスケッチ。好きなものや、行ってみたい場所を、タイ語で話してみることになった。",
        "小さな週末マーケットで、マリと紙雑貨を見て歩く。買い物の会話は、マリが店員役になって練習してくれる。",
        "夕方の街を、マリの歩幅に合わせて散歩する。案内の練習を一緒にしてから、公園のベンチで少し休もう。",
      ],
      [
        "「また、ここで会えたらうれしいね」とマリ。短い挨拶が、次に話す小さなきっかけになった。",
        "お礼を聞いたマリは、スケッチ帳の端に小さな花を描いた。言葉の練習にも、少しずつ二人の時間が増えていく。",
        "マリはあなたの好きなものを、丁寧に聞いていた。すべて同じでなくても、話を聞く時間が心地よい。",
        "マリが選んだカードと、あなたが気になったしおり。違う好みを見つけるたび、新しい話題が生まれた。",
        "並んで座るマリが、次に見たい景色を話し始めた。二人の関係は、急がず少しずつ育っている。",
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
        "読書の合間に、リンとカフェへ。注文をタイ語で練習したいと伝えると、彼女は店員役として手伝ってくれた。",
        "リンの栞には猫の絵。好きなものや行きたい場所を尋ね合い、互いの新しい一面を探してみる。",
        "古本と雑貨のマーケット。リンと値札を眺めながら、値段を尋ねる会話をロールプレイしてみよう。",
        "読書会のあと、リンと街の散歩へ。今日は道を尋ねる練習。正解を急ぐより、相手の説明をよく聞いてみる。",
      ],
      [
        "リンは「知らない言葉があっても、一緒に確かめればいい」と微笑んだ。次の読書会にも顔を出してみたくなる。",
        "リンは気になった言い回しをメモした。二人で一つの表現を確かめる時間が、思った以上に楽しい。",
        "「どうして好きなの？」という話題から、本の好みへ。違う答えを知るのも、距離が近づくきっかけになる。",
        "気になった本を互いに見せる二人。買うものだけでなく、選んだ理由も少しずつ分かってきた。",
        "リンが静かな通りを指さした。「次は、あちらの本屋にも行ってみたいね」。続きを感じさせる帰り道になった。",
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
        "新しいメニューを見つけたダーオと、カフェでひと休み。注文のロールプレイに付き合ってくれることになった。",
        "ダーオのスマホケースには猫の模様。好きなものや、いつか行ってみたい場所の話で盛り上がりそうだ。",
        "週末マーケットを探検するダーオとあなた。彼女が店員役になり、買い物で使うタイ語を一緒に試してみる。",
        "ダーオがおすすめの街歩きコースへ誘ってくれた。道案内の言葉を練習してから、気になった路地へ向かう。",
      ],
      [
        "「その挨拶、覚えてくれたんだね」とダーオ。次はもう一言、話してみたくなった。",
        "ダーオが注文の練習を楽しそうに振り返る。小さな言葉のやり取りにも、二人だけの思い出ができた。",
        "好きなものが重なるところも、違うところも面白い。ダーオは、あなたの返事から次の話題を見つけていた。",
        "ダーオは見つけた雑貨を嬉しそうに見せてくれた。あなたも気になったものを指さし、会話が続いていく。",
        "街角で立ち止まり、次に行きたい場所を相談する二人。ダーオの笑顔が、少し身近に感じられた。",
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
        "アルンとコーヒー休憩。注文の練習をしたいあなたに、彼が店員役を申し出てくれた。",
        "アルンが見せてくれたのは、街の猫の写真。好きなものや旅の話を、短いタイ語で話してみる。",
        "アルンと、紙の小物が並ぶマーケットへ。気になる商品の値段を聞くロールプレイをしてみよう。",
        "夕方の散歩に出かける二人。アルンは景色を見ながら、道を尋ねる表現の練習にも付き合ってくれる。",
      ],
      [
        "アルンはあなたの話を急かさず聞いていた。「また、写真の話をしよう」。次の楽しみが一つ増えた。",
        "会話を確かめたあと、アルンは温かい飲み物を手に笑った。言葉を探す時間も、気まずくはなかった。",
        "アルンはあなたが選んだ話題を、楽しそうに広げてくれた。少しずつ、自然に話せる時間が増えていく。",
        "アルンと見つけた小さなカード。互いの好みを尋ねながら、寄り道する時間が心地よく過ぎた。",
        "「また、この続きを歩こうか」とアルン。二人の物語は、それぞれのペースで続いていく。",
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
        "ゲームの休憩に、キエットとカフェへ。彼が店員役となって、注文の言い方を一緒に確かめてくれる。",
        "キエットが読んでいる本には猫のイラストがある。好きなものや、行ってみたい国を尋ね合ってみる。",
        "マーケットで、キエットが小さなパズルを見つけた。値段を聞く会話を練習してから、品物を見てみよう。",
        "キエットと街をゆっくり歩く。道案内のロールプレイでは、分からないところを落ち着いて聞き返してみる。",
      ],
      [
        "キエットは「分からない言葉を一緒に考えるのも楽しい」と言った。挨拶から、少しずつ話が広がる。",
        "短い会話のあと、キエットは新しいゲームを紹介してくれた。自分の好きなものを話す表情が、印象に残った。",
        "答えが同じでなくても、キエットは理由を面白そうに聞いていた。あなたも彼の考えを、もう少し知りたくなる。",
        "パズルの話から、子どもの頃の遊びへ。タイ語を練習する時間に、互いを知る会話が重なった。",
        "キエットが次のゲーム会の予定を話した。また会いたいという気持ちを、二人とも少しずつ言葉にしていく。",
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
        "ニランが気になっていたカフェへ。彼が店員役になり、飲み物を頼む会話を練習してみる。",
        "ニランが描いた猫のロゴから、好きなものの話へ。行ってみたい場所についても、少し話してみよう。",
        "ニランと、手作りの作品が集まるマーケットへ。買い物のやり取りを試しながら、お気に入りを探す。",
        "街の音を聞きながら、ニランと散歩する。道案内の表現を確かめてから、新しい店へ寄り道してみよう。",
      ],
      [
        "ニランはあなたの挨拶に、嬉しそうに応じた。「次は、作品の感想も聞かせて」。また話すきっかけができた。",
        "言葉を間違えても、ニランは一緒に確かめてくれた。小さな成功を二人で喜ぶ時間になった。",
        "ニランは思いがけない共通点を見つけて笑った。違う好みの話にも、次の寄り道のヒントがある。",
        "互いに気になった作品を見せ合う二人。ニランの好きな色や形が、少しずつ分かってきた。",
        "ニランは次に行きたい店の名前をメモした。まだ知らない話題が、二人の前にたくさん残っている。",
      ],
    ),
  },
];

const sourceIds = ["wiktionary-ipa-phase4", "wiktionary-ipa-phase5"];
export const romanceEpisodes: RomanceEpisode[] = [
  {
    id: "meet",
    number: 1,
    title: "はじめまして、から",
    setting: "ブックカフェの交流イベント。挨拶と出身を話し、お礼に返します。",
    objective: "挨拶・日本から来たこと・お礼への返答を使う。",
    sourceScenarioId: "greeting-origin",
    previousEpisodeId: null,
    storyPrompt: "最初の会話のあと、どんなふうに過ごす？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "cafe",
    number: 2,
    title: "カフェでひと休み",
    setting:
      "相手が店員役になって行う注文の練習。水を頼み、コーヒーを断り、お礼を伝えます。",
    objective: "依頼・丁寧な断り・お礼の表現を使う。",
    sourceScenarioId: "cafe-water",
    previousEpisodeId: "meet",
    storyPrompt: "会話の練習が終わった。休憩をどう楽しもう？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "likes",
    number: 3,
    title: "好きなものを話そう",
    setting:
      "猫の写真や絵を見ながら、好きなものと行ってみたい国を話す場面です。",
    objective: "猫が好きなこと、日本へ行きたいことを伝える役の練習。",
    sourceScenarioId: null,
    previousEpisodeId: "cafe",
    storyPrompt: "相手の好きなものを聞いて、あなたはどう返す？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "market",
    number: 4,
    title: "小さなマーケットへ",
    setting:
      "二人で買い物へ。相手が店員役となり、20バーツの商品を指す文脈で練習します。",
    objective: "値段を尋ね、買う意思とお礼を伝える。",
    sourceScenarioId: "shopping-price",
    previousEpisodeId: "likes",
    storyPrompt: "気になる品物を見つけた相手。どんな時間にする？",
    sourceIds: [...sourceIds],
    verification: "unreviewed",
  },
  {
    id: "walk",
    number: 5,
    title: "もう少し、一緒に",
    setting:
      "街歩きの途中に案内の人役で練習。トイレの場所と右方向を確認し、お礼を言います。",
    objective: "場所と方向を尋ね、確認してお礼を伝える。",
    sourceScenarioId: "restroom-directions",
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

function phrase(
  wordIds: string[],
  meaning: string,
  note?: string,
): ConversationPhrase {
  return {
    thai: wordIds
      .map((id) => {
        const word = words.get(id);
        if (!word) throw new Error("恋愛コースの語句参照がありません: " + id);
        return word.thai;
      })
      .join(""),
    meaning,
    wordIds: [...wordIds],
    ...(note ? { note } : {}),
  };
}

/** 丁寧詞の登録IDだけを変更する。Thaiの文字列や結合記号を分解しない。 */
function npcForGender(
  source: ConversationPhrase,
  gender: RomanceGender,
): ConversationPhrase {
  const ids = [...source.wordIds];
  const ending = ids.at(-1);
  if (
    gender === "male" &&
    (ending === "polite-female-statement" ||
      ending === "polite-female-question")
  )
    ids[ids.length - 1] = "polite-male";
  const note = source.note?.includes("性別の登録")
    ? "文末詞は、この登場人物の話し方のモデルです。主人公の設定にかかわらず、登録した丁寧な返答例を受け付けます。"
    : source.note;
  return phrase(ids, source.meaning, note);
}

function copyStep(
  step: ConversationStep,
  gender: RomanceGender,
  scenarioId?: string,
): RomanceQuestion {
  return {
    ...step,
    npc: npcForGender(step.npc, gender),
    choices: step.choices.map((choice) => ({
      ...choice,
      phrase: { ...choice.phrase, wordIds: [...choice.phrase.wordIds] },
    })),
    answerIds: [...step.answerIds],
    sourceIds: [...sourceIds],
    verification: "unreviewed",
    sourceNote:
      "既存会話の語句・目標・返答例を参照。登場人物の文末詞だけ、登録済みのIDで話し方のモデルに合わせています。会話・訳・用法は専門家監修前です。",
    ...(scenarioId ? { sourceScenarioId: scenarioId } : {}),
  };
}

function reply(
  id: string,
  wordIds: string[],
  meaning: string,
  explanation: string,
): ConversationChoice {
  return { id, phrase: phrase(wordIds, meaning), explanation };
}

/** 既存の「คุณชอบแมวไหม」と登録語句に基づく小さな教材案。新しい照合済み例文ではない。 */
function likesQuestions(gender: RomanceGender): RomanceQuestion[] {
  const original = conversationScenarios.find(
    (scenario) => scenario.id === "greeting-origin",
  );
  const originalWish = original?.steps[1]?.choices.find(
    (choice) => choice.id === "greeting-from-wish",
  );
  const closing = original?.steps.find(
    (step) => step.id === "greeting-origin-close",
  );
  if (!originalWish || !closing)
    throw new Error("好みの会話で参照する元の表現がありません。");
  const note =
    "既存の『基本の質問』のคุณชอบแมวไหมと登録語句から組み合わせた教材案です。語句IPAの再利用は、会話・訳・自然さの監修完了を意味しません。";
  const first: ConversationStep = {
    id: "romance-likes-cat",
    npc: phrase(
      ["you", "like", "cat", "question-particle", "polite-female-question"],
      "猫は好きですか。",
    ),
    goal: "この役では『猫が好きです』と答えましょう。",
    choices: [
      reply(
        "romance-cat-like-male",
        ["like", "polite-male"],
        "好きです。",
        "ชอบ は好きであるという意味です。猫について聞かれた文脈で対象を省いた返答例です。",
      ),
      reply(
        "romance-cat-like-female",
        ["like", "polite-female-statement"],
        "好きです。",
        "ชอบ に応答の丁寧詞 ค่ะ を添えた返答例です。",
      ),
      reply(
        "romance-cat-not",
        ["not", "like", "polite-male"],
        "好きではありません。",
        "ไม่ชอบ は好きではないという意味です。今回は好きだと答える役の練習です。実際の好みの優劣は判定しません。",
      ),
    ],
    answerIds: ["romance-cat-like-male", "romance-cat-like-female"],
    explanation:
      "ไหม で聞かれた好みには、この文脈で ชอบ と答えられます。猫が好きという役を練習しており、利用者自身の好みを採点するものではありません。",
  };
  const second: ConversationStep = {
    id: "romance-likes-japan",
    npc: phrase(
      [
        "you",
        "want",
        "go",
        "japan",
        "question-particle",
        "polite-female-question",
      ],
      "日本へ行きたいですか。",
    ),
    goal: "この役では『日本へ行きたいです』と伝えましょう。",
    choices: [
      {
        ...originalWish,
        id: "romance-japan-want-male",
        phrase: {
          ...originalWish.phrase,
          wordIds: [...originalWish.phrase.wordIds],
        },
        explanation:
          "อยากไปญี่ปุ่น は日本へ行きたいという希望です。元の会話で使う表現を、この目標に合わせて練習します。",
      },
      reply(
        "romance-japan-want-female",
        ["want", "go", "japan", "polite-female-statement"],
        "日本へ行きたいです。",
        "誰の希望か分かる返答で主語を省き、อยากไปญี่ปุ่น と伝えるモデルです。",
      ),
      reply(
        "romance-japan-from",
        ["come", "from", "japan", "polite-female-statement"],
        "日本から来ました。",
        "มาจากญี่ปุ่น は日本から来たという意味です。行きたいという希望とは内容が違います。",
      ),
    ],
    answerIds: ["romance-japan-want-male", "romance-japan-want-female"],
    explanation:
      "อยาก のあとに ไป を置き、行きたいという希望を伝えています。出身の『日本から来た』と、行きたい場所を区別します。",
  };
  return [first, second]
    .map((step) => ({ ...copyStep(step, gender), sourceNote: note }))
    .concat(copyStep(closing, gender, "greeting-origin"));
}

export function getRomanceQuestions(
  characterId: string,
  episodeId: string,
): RomanceQuestion[] {
  const character = getRomanceCharacter(characterId),
    episode = getRomanceEpisode(episodeId);
  if (!character || !episode) return [];
  if (episode.id === "likes") return likesQuestions(character.gender);
  const source = conversationScenarios.find(
    (scenario) => scenario.id === episode.sourceScenarioId,
  );
  return (
    source?.steps.map((step) => copyStep(step, character.gender, source.id)) ??
    []
  );
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

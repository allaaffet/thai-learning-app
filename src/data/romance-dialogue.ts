import { conversationWords } from "@/data/conversations";
import { getVocabularyEntry } from "@/data/language";
import type { ContentSource } from "@/lib/content-types";
import type {
  ConversationChoice,
  ConversationPhrase,
  ConversationWord,
} from "@/lib/conversation-types";
import type {
  RomanceEpisodeId,
  RomanceGender,
  RomanceQuestion,
} from "@/lib/romance-types";

export const ROMANCE_DIALOGUE_CURRICULUM_ID =
  "romance-dialogue-2026-11" as const;
const ipaSourceId = "wiktionary-ipa-romance-dialogue";
const dictionarySourceId = "wiktionary-meaning-romance-dialogue";

/** 単語の照合と、会話全文・日本語訳・用法の監修を区別する。 */
export const romanceDialogueSources: ContentSource[] = [
  {
    id: ipaSourceId,
    title: "Thai Wiktionary IPA corpus — 恋愛会話の追加16語句",
    publisher: "Thai Wiktionary contributors / PyThaiNLP",
    url: "https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv",
    checkedAt: "2026-11-04",
    access: "accessible",
    scope:
      "固定コミットのTSVと同じディレクトリのREADMEを取得・実読。追加16語句の各1行の辞書形IPAを照合し、音素間の空白を除き、t͡ɕを既存のtɕ表記へ統一。音節境界は保持。Thai Wiktionary由来CC BY-SA 3.0。文全体のIPA・日本語訳・自然な会話・丁寧詞の用法を照合したものではなく、教材は専門家監修前。",
  },
  {
    id: dictionarySourceId,
    title: "Thai Wiktionary dictionary — 恋愛会話の語義参考資料",
    publisher: "Thai Wiktionary contributors / PyThaiNLP",
    url: "https://github.com/PyThaiNLP/pythainlp-corpus/releases/download/thai_dict-v1.0/thai_dictionary.csv",
    checkedAt: "2026-11-04",
    access: "accessible",
    scope:
      "実取得したCSVでคุย・ดีใจ・ด้วย・นั่ง・เจอ・น่ารัก・ใคร・คิดถึง・พรุ่งนี้・ว่าง・อีกの語義の一部を実読。日本語説明は独立作成。ที่・กับ・กันの今回の文法義、ด้วยกัน・ฝันดีはこの辞書による照合対象外。全文・訳・文法・自然さは未監修。ライセンスCC BY-SA 4.0は同リポジトリ固定コミットe1d2ff7bea713a451b6959af6cad59ccf49ed563のdb.jsonで確認。",
  },
];

/** 全16件のIPAは実取得TSVの1行から採用し、綴りから生成しない。 */
const addedWords = [
  ["romance-chat", "คุย", "/kʰuj˧/", "話す・おしゃべりする", true],
  [
    "romance-with-company",
    "ด้วย",
    "/dua̯j˥˩/",
    "一緒に・〜も（相手と行動する）",
    true,
  ],
  ["romance-happy", "ดีใจ", "/diː˧.tɕaj˧/", "うれしく思う", true],
  [
    "romance-that",
    "ที่",
    "/tʰiː˥˩/",
    "ここでは、うれしい理由を後ろにつなぐ",
    false,
  ],
  ["romance-meet", "เจอ", "/tɕɤː˧/", "会う・出会う", true],
  ["romance-sit", "นั่ง", "/naŋ˥˩/", "座る", true],
  ["romance-with", "กับ", "/kap̚˨˩/", "〜と（ここでは一緒に話す相手）", false],
  ["romance-together", "ด้วยกัน", "/dua̯j˥˩.kan˧/", "一緒に", false],
  ["romance-cute", "น่ารัก", "/naː˥˩.rak̚˦˥/", "かわいい・愛らしい", true],
  ["romance-who", "ใคร", "/kʰraj˧/", "誰", true],
  [
    "romance-miss",
    "คิดถึง",
    "/kʰit̚˦˥.tʰɯŋ˩˩˦/",
    "恋しく思う・親しい相手を思う",
    true,
  ],
  ["romance-tomorrow", "พรุ่งนี้", "/pʰruŋ˥˩.niː˦˥/", "明日", true],
  ["romance-free", "ว่าง", "/waːŋ˥˩/", "空いている・用事がない", true],
  [
    "romance-each-other",
    "กัน",
    "/kan˧/",
    "ここでは、互いに会うことを表す",
    false,
  ],
  ["romance-again", "อีก", "/ʔiːk̚˨˩/", "また・もう一度・さらに", true],
  [
    "romance-sweet-dreams",
    "ฝันดี",
    "/fan˩˩˦.diː˧/",
    "よい夢を（おやすみの挨拶）",
    false,
  ],
] as const;

/** 本編・独立会話・SRSへ追加しない、恋愛コース専用の語句カタログ。 */
export const romanceDialogueWords: ConversationWord[] = [
  ...conversationWords.map((word) => ({
    ...word,
    ...(word.id === "can"
      ? { meaning: "できる・よい。ここでは承諾や「会えた」という経験を表す。" }
      : {}),
    sourceIds: [...word.sourceIds],
  })),
  ...["like", "cat"].map((id) => {
    const word = getVocabularyEntry(id);
    if (!word) throw new Error("恋愛会話の参照語がありません: " + id);
    return {
      id: word.id,
      thai: word.thai,
      ipa: word.ipa,
      meaning: word.meaning,
      sourceIds: [...word.sourceIds],
      verification: "unreviewed" as const,
    };
  }),
  ...addedWords.map(([id, thai, ipa, meaning, meaningLookedUp]) => ({
    id,
    thai,
    ipa,
    meaning,
    sourceIds: meaningLookedUp
      ? [ipaSourceId, dictionarySourceId]
      : [ipaSourceId],
    verification: "unreviewed" as const,
  })),
];
const words = new Map(romanceDialogueWords.map((word) => [word.id, word]));

interface DialogueDraft {
  id: string;
  npc: string[];
  npcMeaning: string;
  npcQuestion?: boolean;
  goal: string;
  reply: string[];
  replyMeaning: string;
  explanation: string;
  differentReply: string[];
  differentMeaning: string;
  differentExplanation: string;
  note?: string;
}

/** 各3ターンの因果順は固定。主人公自身の好みの正しさを評価しない。 */
const dialogue: Record<
  RomanceEpisodeId,
  [DialogueDraft, DialogueDraft, DialogueDraft]
> = {
  meet: [
    {
      id: "romance-dialogue-meet-hello",
      npc: ["hello"],
      npcMeaning: "こんにちは。",
      goal: "初めて会った相手に、挨拶を返しましょう。",
      reply: ["hello"],
      replyMeaning: "こんにちは。",
      explanation:
        "สวัสดี は会ったときの挨拶です。自分も挨拶を返して、二人の会話を始めます。ครับ と ค่ะ のどちらも、この練習では受け付けます。",
      differentReply: ["romance-sweet-dreams"],
      differentMeaning: "おやすみなさい。",
      differentExplanation:
        "ฝันดี はよい夢を願う、寝る前の挨拶です。今は初めて会ったところなので、สวัสดี を返します。",
    },
    {
      id: "romance-dialogue-meet-chat",
      npc: ["romance-chat", "romance-with-company", "can", "question-particle"],
      npcMeaning: "お話ししてもいいですか。",
      npcQuestion: true,
      goal: "声をかけてきた相手に、『いいですよ』と応じる役です。",
      reply: ["can"],
      replyMeaning: "いいですよ。",
      explanation:
        "คุยด้วยได้ไหม は、一緒に話してよいかを尋ねる表現です。この場面では ได้ と承諾し、会話を始めます。",
      differentReply: ["not", "can"],
      differentMeaning: "できません。",
      differentExplanation:
        "ไม่ได้ はできないという否定です。断ることも妥当な行動ですが、ここでは『いいですよ』と返す表現を練習します。",
      note: "ด้วย の相手は、この場面の『あなた』です。主語や相手を省いた短いやり取りの教材案です。",
    },
    {
      id: "romance-dialogue-meet-happy",
      npc: ["romance-happy", "romance-that", "can", "romance-meet", "you"],
      npcMeaning: "あなたに会えてうれしいです。",
      goal: "『あなたに会えてうれしい』と、自分の気持ちも返す役です。",
      reply: ["romance-happy", "romance-that", "can", "romance-meet", "you"],
      replyMeaning: "あなたに会えてうれしいです。",
      explanation:
        "ดีใจ はうれしく思うこと。ดีใจที่ได้เจอคุณ で、あなたに会えたことがうれしいと伝えます。ここでの ได้ は『いいですよ』という単独の返答とは働きが異なります。",
      differentReply: ["romance-miss", "you"],
      differentMeaning: "あなたが恋しいです。",
      differentExplanation:
        "คิดถึงคุณ は親しい相手を恋しく思う表現です。今回は『会えてうれしい』という気持ちを、ดีใจที่ได้เจอคุณ で返します。",
    },
  ],
  cafe: [
    {
      id: "romance-dialogue-cafe-seat",
      npc: ["romance-sit", "romance-with-company", "can", "question-particle"],
      npcMeaning: "ご一緒に座ってもいいですか。",
      npcQuestion: true,
      goal: "隣に来たい相手に、『いいですよ』と席を勧める役です。",
      reply: ["can"],
      replyMeaning: "いいですよ。",
      explanation:
        "นั่ง は座ること。นั่งด้วยได้ไหม と聞かれたので、ได้ と応じて一緒に座ることを受け入れます。",
      differentReply: ["not", "can"],
      differentMeaning: "できません。",
      differentExplanation:
        "ไม่ได้ はできないという返答です。距離を置きたいときの意思も尊重されますが、この場面の目標は『いいですよ』と答えることです。",
    },
    {
      id: "romance-dialogue-cafe-talk-with-you",
      npc: ["want", "romance-chat", "romance-with", "you"],
      npcMeaning: "あなたと話したいです。",
      goal: "『あなたと話したい』と、自分からも伝える役です。",
      reply: ["want", "romance-chat", "romance-with", "you"],
      replyMeaning: "あなたと話したいです。",
      explanation:
        "อยาก の後ろにしたい行動を置きます。คุยกับคุณ はあなたと話すこと。อยากคุยกับคุณ と、自分も話したい気持ちを返します。",
      differentReply: ["not", "want", "romance-chat", "romance-with", "you"],
      differentMeaning: "あなたと話したくありません。",
      differentExplanation:
        "ไม่อยาก はしたくないという意味です。実際に断る意思を採点するのではなく、今回は『話したい』という役の表現を確かめます。",
    },
    {
      id: "romance-dialogue-cafe-go-together",
      npc: ["go", "romance-together", "question-particle"],
      npcMeaning: "一緒に行きませんか。",
      npcQuestion: true,
      goal: "誘いに乗って、『一緒に行きます』と返す役です。",
      reply: ["go", "romance-together"],
      replyMeaning: "一緒に行きます。",
      explanation:
        "ไปด้วยกัน は一緒に行くこと。相手の誘いを受けて、同じ行動を選ぶと伝えています。",
      differentReply: ["not", "go"],
      differentMeaning: "行きません。",
      differentExplanation:
        "ไม่ไป は行かないという意味です。断りも有効な意思表示ですが、この練習では誘いに乗る返答を選びます。",
    },
  ],
  likes: [
    {
      id: "romance-dialogue-likes-compliment",
      npc: ["you", "romance-cute"],
      npcMeaning: "あなた、かわいいですね。",
      goal: "相手の褒め言葉に、『ありがとう』と応じましょう。",
      reply: ["thank-you"],
      replyMeaning: "ありがとうございます。",
      explanation:
        "น่ารัก はかわいい・愛らしいという褒め言葉です。この場面では ขอบคุณ と受け止めます。",
      differentReply: ["hello"],
      differentMeaning: "こんにちは。",
      differentExplanation:
        "สวัสดี は挨拶です。今は褒められたことへのお礼を、ขอบคุณ で伝えます。",
      note: "น่ารัก の受け取り方は関係や場面によります。この物語では、好意を持つ相手からの親しみのある褒め言葉として扱います。",
    },
    {
      id: "romance-dialogue-likes-you",
      npc: ["you", "like", "romance-who"],
      npcMeaning: "誰が好きですか。",
      npcQuestion: true,
      goal: "『好きなのはあなた』と、好意を返す役です。",
      reply: ["like", "you"],
      replyMeaning: "あなたが好きです。",
      explanation:
        "ใคร は誰を尋ねる語です。ชอบคุณ なら、好きな相手が『あなた』だと伝わります。この物語では恋愛の好意として使います。",
      differentReply: ["want", "romance-chat", "romance-with", "you"],
      differentMeaning: "あなたと話したいです。",
      differentExplanation:
        "อยากคุยกับคุณ は話したいという希望です。会話を望むことと、誰が好きかを答えることを区別しましょう。",
    },
    {
      id: "romance-dialogue-likes-miss",
      npc: ["romance-miss", "you"],
      npcMeaning: "あなたが恋しいです。",
      goal: "自分も『あなたが恋しい』と、気持ちを返す役です。",
      reply: ["romance-miss", "you"],
      replyMeaning: "あなたが恋しいです。",
      explanation:
        "คิดถึง は親しい相手を思い、恋しく思うこと。この恋愛場面では คิดถึงคุณ と自分の気持ちも返します。",
      differentReply: ["not", "romance-miss", "you"],
      differentMeaning: "あなたを恋しく思っていません。",
      differentExplanation:
        "ไม่คิดถึง は恋しく思っていないという否定です。利用者自身の気持ちではなく、今回は好意を返す役の表現を練習します。",
    },
  ],
  market: [
    {
      id: "romance-dialogue-market-free-tomorrow",
      npc: ["romance-tomorrow", "romance-free", "question-particle"],
      npcMeaning: "明日は空いていますか。",
      npcQuestion: true,
      goal: "次のデートの相談で、『空いています』と答える役です。",
      reply: ["romance-free"],
      replyMeaning: "空いています。",
      explanation:
        "พรุ่งนี้ は明日、ว่าง は予定が空いていることです。明日のことを聞かれているので、ว่าง と短く答えられます。",
      differentReply: ["not", "romance-free"],
      differentMeaning: "空いていません。",
      differentExplanation:
        "ไม่ว่าง は用事があって空いていないという返答です。今回は空いていると伝える役なので、ว่าง を使います。",
    },
    {
      id: "romance-dialogue-market-date-with-you",
      npc: ["go", "romance-together", "question-particle"],
      npcMeaning: "一緒に行きませんか。",
      npcQuestion: true,
      goal: "『あなたと行きたい』と、誘いへの気持ちも伝える役です。",
      reply: ["want", "go", "romance-with", "you"],
      replyMeaning: "あなたと行きたいです。",
      explanation:
        "อยากไป は行きたい、กับคุณ はあなたと、という意味です。短い承諾から一歩進め、相手と行きたい気持ちを伝えます。",
      differentReply: ["not", "want", "go", "romance-with", "you"],
      differentMeaning: "あなたと行きたくありません。",
      differentExplanation:
        "ไม่อยากไป は行きたくないという意味です。断る意思を否定する問題ではなく、『行きたい』という役の言い方を選ぶ練習です。",
    },
    {
      id: "romance-dialogue-market-see-tomorrow",
      npc: ["romance-meet", "romance-each-other", "romance-tomorrow"],
      npcMeaning: "明日会いましょう。",
      goal: "デートの約束に、『明日会いましょう』と返す役です。",
      reply: ["romance-meet", "romance-each-other", "romance-tomorrow"],
      replyMeaning: "明日会いましょう。",
      explanation:
        "เจอกันพรุ่งนี้ は明日会う約束を交わす表現です。กัน を含めた登録語句の順に並べ、同じ約束を返します。",
      differentReply: ["not", "romance-free"],
      differentMeaning: "空いていません。",
      differentExplanation:
        "ไม่ว่าง は予定が空いていないという返答です。今回は約束を受け入れ、明日会うと言葉にする役です。",
    },
  ],
  walk: [
    {
      id: "romance-dialogue-walk-again",
      npc: ["want", "romance-meet", "you", "romance-again"],
      npcMeaning: "またあなたに会いたいです。",
      goal: "帰り際に、『またあなたに会いたい』と返す役です。",
      reply: ["want", "romance-meet", "you", "romance-again"],
      replyMeaning: "またあなたに会いたいです。",
      explanation:
        "อยากเจอคุณ はあなたに会いたいという気持ちです。อีก を添えて、今回だけでなくまた会いたいと伝えます。",
      differentReply: ["want", "romance-chat", "romance-with", "you"],
      differentMeaning: "あなたと話したいです。",
      differentExplanation:
        "อยากคุยกับคุณ は話したいという意味です。今回は再会したい気持ちを、อยากเจอคุณอีก で伝えましょう。",
    },
    {
      id: "romance-dialogue-walk-tomorrow",
      npc: [
        "romance-tomorrow",
        "romance-meet",
        "romance-each-other",
        "question-particle",
      ],
      npcMeaning: "明日、会いませんか。",
      npcQuestion: true,
      goal: "次に会う誘いを受け、『明日会いましょう』と返す役です。",
      reply: ["romance-meet", "romance-each-other", "romance-tomorrow"],
      replyMeaning: "明日会いましょう。",
      explanation:
        "พรุ่งนี้เจอกันไหม は明日会うことへの誘いです。前のデートで使った表現を思い出し、เจอกันพรุ่งนี้ と予定を確かめます。",
      differentReply: ["not", "romance-free"],
      differentMeaning: "空いていません。",
      differentExplanation:
        "ไม่ว่าง は都合がつかないという意味です。この練習では誘いを受け、明日会う約束を返します。",
    },
    {
      id: "romance-dialogue-walk-goodnight",
      npc: ["romance-sweet-dreams"],
      npcMeaning: "おやすみなさい。",
      goal: "帰宅後のひと言に、『おやすみ』を返しましょう。",
      reply: ["romance-sweet-dreams"],
      replyMeaning: "おやすみなさい。",
      explanation:
        "ฝันดี はよい夢を願う挨拶です。次の約束をしたあと、寝る前の言葉として相手へ返します。",
      differentReply: ["hello"],
      differentMeaning: "こんにちは。",
      differentExplanation:
        "สวัสดี は出会いなどの挨拶です。今は寝る前の場面なので、相手へよい夢を願う ฝันดี を返します。",
    },
  ],
};

function phrase(
  wordIds: string[],
  meaning: string,
  note?: string,
): ConversationPhrase {
  return {
    thai: wordIds
      .map((id) => {
        const word = words.get(id);
        if (!word) throw new Error("恋愛会話の語句参照がありません: " + id);
        return word.thai;
      })
      .join(""),
    meaning,
    wordIds: [...wordIds],
    ...(note ? { note } : {}),
  };
}

function answer(
  draft: DialogueDraft,
  ending: "polite-male" | "polite-female-statement",
): ConversationChoice {
  return {
    id: draft.id + (ending === "polite-male" ? "-male" : "-female"),
    phrase: phrase([...draft.reply, ending], draft.replyMeaning),
    explanation: draft.explanation,
  };
}

/** 登録した語句と文末詞のIDから構成し、Thai文字列を置換しない。 */
export function getRomanceDialogueQuestions(
  npcGender: RomanceGender,
  episodeId: RomanceEpisodeId,
): RomanceQuestion[] {
  return dialogue[episodeId].map((draft) => {
    const npcEnding =
      npcGender === "male"
        ? "polite-male"
        : draft.npcQuestion
          ? "polite-female-question"
          : "polite-female-statement";
    const npc = phrase([...draft.npc, npcEnding], draft.npcMeaning, draft.note);
    const accepted = [
      answer(draft, "polite-male"),
      answer(draft, "polite-female-statement"),
    ];
    const choices: ConversationChoice[] = [
      ...accepted,
      {
        id: draft.id + "-different-intent",
        phrase: phrase(
          [...draft.differentReply, "polite-male"],
          draft.differentMeaning,
        ),
        explanation: draft.differentExplanation,
      },
    ];
    const referenced = [
      ...npc.wordIds,
      ...choices.flatMap((entry) => entry.phrase.wordIds),
    ];
    const sourceIds = [
      ...new Set(referenced.flatMap((id) => words.get(id)?.sourceIds ?? [])),
    ];
    return {
      id: draft.id,
      npc,
      goal: draft.goal,
      choices,
      answerIds: accepted.map((entry) => entry.id),
      explanation: draft.explanation,
      sourceIds,
      verification: "unreviewed",
      sourceNote:
        "恋愛場面に合わせた教材案です。既存の語句IPAと、固定資料から実読した追加16語句の辞書形IPAを使います。一部の語義を辞書で参照していますが、会話全文・日本語訳・文法・丁寧詞の自然さは専門家監修前です。全文IPAやネイティブ録音を生成したものではありません。",
    };
  });
}

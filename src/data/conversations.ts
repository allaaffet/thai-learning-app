import { getVocabularyEntry } from "@/data/language";
import type { ContentSource } from "@/lib/content-types";
import type {
  ConversationChoice,
  ConversationPhrase,
  ConversationScenario,
  ConversationWord,
} from "@/lib/conversation-types";

const ipaSourceId = "wiktionary-ipa-phase5";

export const conversationSources: ContentSource[] = [
  {
    id: ipaSourceId,
    title: "Thai Wiktionary IPA corpus — 会話入門の20語句",
    publisher: "Thai Wiktionary contributors / PyThaiNLP",
    url: "https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv",
    checkedAt: "2026-10-27",
    access: "accessible",
    scope:
      "固定コミットのTSVと同ディレクトリのREADMEを取得・実読し、新規20語句の辞書形IPAだけを照合。音素間の空白を除き、破擦音の結合線を既存のtɕ表記へ統一し、音節境界を保持。スクリプト会話全文のIPA・日本語訳・自然さ・丁寧詞の用法は未照合。Thai Wiktionary由来CC BY-SA 3.0。教材全体は専門家監修前。",
  },
];

/** 固定TSVの実際の行から採用。全文の連続発話へは組み立てない。 */
const dictionaryWords = [
  ["hello", "สวัสดี", "/sa˨˩.wat̚˨˩.diː˧/", "こんにちは・さようならなどの挨拶"],
  ["from", "จาก", "/tɕaːk̚˨˩/", "〜から"],
  ["japan", "ญี่ปุ่น", "/jiː˥˩.pun˨˩/", "日本"],
  ["which-place", "ไหน", "/naj˩˩˦/", "どこ・どの（この会話では出身を尋ねる）"],
  ["thank-you", "ขอบคุณ", "/kʰɔːp̚˨˩.kʰun˧/", "ありがとう"],
  [
    "never-mind",
    "ไม่เป็นไร",
    "/maj˥˩.pen˧.raj˧/",
    "大丈夫・気にしないで・どういたしまして（文脈による）",
  ],
  ["receive", "รับ", "/rap̚˦˥/", "受け取る（この会話では飲み物を受ける）"],
  ["coffee", "กาแฟ", "/kaː˧.fɛː˧/", "コーヒー"],
  ["can", "ได้", "/daːj˥˩/", "できる・よい（この会話では承諾の返答）"],
  ["price", "ราคา", "/raː˧.kʰaː˧/", "値段・価格"],
  ["how-much", "เท่าไร", "/tʰaw˥˩.raj˧/", "いくら・どれくらい"],
  ["twenty", "ยี่สิบ", "/jiː˥˩.sip̚˨˩/", "20"],
  ["baht", "บาท", "/baːt̚˨˩/", "バーツ（タイの通貨単位）"],
  ["take", "เอา", "/ʔaw˧/", "取る・欲しい（この会話では買う物を選ぶ）"],
  [
    "restroom",
    "ห้องน้ำ",
    "/hɔŋ˥˩.naːm˦˥/",
    "トイレ・浴室（この会話ではトイレ）",
  ],
  ["where", "ที่ไหน", "/tʰiː˥˩.naj˩˩˦/", "どこ"],
  ["way", "ทาง", "/tʰaːŋ˧/", "道・方向"],
  ["right", "ขวา", "/kʰwaː˩˩˦/", "右"],
  ["left", "ซ้าย", "/saːj˦˥/", "左"],
  ["yes", "ใช่", "/tɕʰaj˥˩/", "そうです・そのとおり"],
] as const;

const reusedWordIds = [
  "i-male",
  "i-informal",
  "you",
  "come",
  "go",
  "want",
  "request",
  "water",
  "not",
  "question-particle",
  "polite-male",
  "polite-female-statement",
  "polite-female-question",
  "stay",
];

/** 既存の40語やSRSを増減せず、会話画面で参照する別カタログ。 */
export const conversationWords: ConversationWord[] = [
  ...reusedWordIds.map((id) => {
    const existing = getVocabularyEntry(id);
    if (!existing) throw new Error("会話で使う既存語がありません: " + id);
    return {
      id: existing.id,
      thai: existing.thai,
      ipa: existing.ipa,
      meaning: existing.meaning,
      sourceIds: [...existing.sourceIds],
      verification: "unreviewed" as const,
    };
  }),
  ...dictionaryWords.map(([id, thai, ipa, meaning]) => ({
    id,
    thai,
    ipa,
    meaning,
    sourceIds: [ipaSourceId],
    verification: "unreviewed" as const,
  })),
];

const wordMap = new Map(conversationWords.map((word) => [word.id, word]));

/** 作成者が指定した語句を綴りのまま並べる。読み・音節を推測しない。 */
function phrase(
  wordIds: string[],
  meaning: string,
  note?: string,
): ConversationPhrase {
  const words = wordIds.map((id) => {
    const word = wordMap.get(id);
    if (!word) throw new Error("会話の参照語句がありません: " + id);
    return word;
  });
  return {
    thai: words.map((word) => word.thai).join(""),
    meaning,
    wordIds: [...wordIds],
    ...(note ? { note } : {}),
  };
}

function choice(
  id: string,
  wordIds: string[],
  meaning: string,
  explanation: string,
): ConversationChoice {
  return { id, phrase: phrase(wordIds, meaning), explanation };
}

function scenario(
  input: Omit<
    ConversationScenario,
    "durationMinutes" | "sourceIds" | "verification"
  >,
): ConversationScenario {
  return {
    ...input,
    durationMinutes: 3,
    sourceIds: [ipaSourceId, "wiktionary-ipa-phase4"],
    verification: "unreviewed",
  };
}

const politeNote =
  "ครับ・ค่ะ・คะの使い分けには話者や場面による違いがあります。この練習では示した丁寧な言い方の例を扱い、性別の登録や話し方の強制はしません。";

/**
 * 日本語で指定した「伝えたいこと」に合う返答を選ぶ、台本付きの練習。
 * それ以外の自然な返答を網羅したり、自由会話を自動採点したりしない。
 * 各会話・日本語訳・場面への適合性は未監修。全文IPAは持たせない。
 */
export const conversationScenarios: ConversationScenario[] = [
  scenario({
    id: "greeting-origin",
    title: "あいさつと出身",
    setting: "宿の受付で挨拶し、日本から来たことを伝える場面です。",
    objective: "挨拶を返し、出身を伝えて、やり取りを結ぶ。",
    relatedLessonIds: [
      "pronouns-politeness",
      "basic-questions",
      "basic-word-order",
    ],
    steps: [
      {
        id: "greeting-origin-hello",
        npc: phrase(
          ["hello", "polite-female-statement"],
          "こんにちは。",
          politeNote,
        ),
        goal: "相手に挨拶を返しましょう。",
        choices: [
          choice(
            "greeting-hello-male",
            ["hello", "polite-male"],
            "こんにちは。",
            "สวัสดี で挨拶を返しています。ครับ を添える話し方の例です。",
          ),
          choice(
            "greeting-hello-female",
            ["hello", "polite-female-statement"],
            "こんにちは。",
            "สวัสดี で挨拶を返しています。ค่ะ を添える話し方の例です。",
          ),
          choice(
            "greeting-hello-water",
            ["request", "water", "polite-male"],
            "水をください。",
            "ขอน้ำ は水を頼む表現です。今回は先に挨拶を返す目標です。",
          ),
        ],
        answerIds: ["greeting-hello-male", "greeting-hello-female"],
        explanation:
          "สวัสดี は挨拶に使う語です。ここでは挨拶を返す2つのモデルをどちらも選べます。",
      },
      {
        id: "greeting-origin-from",
        npc: phrase(
          ["you", "come", "from", "which-place", "polite-female-question"],
          "どこから来ましたか。",
          "มา は来る、จาก は〜から、ไหน はこの文で出身の場所を尋ねます。",
        ),
        goal: "『日本から来ました』と伝えましょう。",
        choices: [
          choice(
            "greeting-from-male",
            ["i-male", "come", "from", "japan", "polite-male"],
            "私は日本から来ました。",
            "มาจากญี่ปุ่น は日本から来たという内容です。ผม・ครับ を使うモデルです。",
          ),
          choice(
            "greeting-from-female",
            ["come", "from", "japan", "polite-female-statement"],
            "私は日本から来ました。",
            "มาจากญี่ปุ่น は日本から来たという内容です。自分が答えていることが明らかな場面で主語を省き、ค่ะ を添えるモデルです。",
          ),
          choice(
            "greeting-from-wish",
            ["i-male", "want", "go", "japan", "polite-male"],
            "私は日本へ行きたいです。",
            "อยากไป は行きたいという希望で、日本から来たという返答とは内容が異なります。",
          ),
        ],
        answerIds: ["greeting-from-male", "greeting-from-female"],
        explanation:
          "出身を尋ねられたこの場面では มาจากญี่ปุ่น で日本から来たことを伝えます。国籍やすべての自己紹介の言い方を表す万能な型ではありません。",
      },
      {
        id: "greeting-origin-close",
        npc: phrase(
          ["thank-you", "polite-female-statement"],
          "ありがとうございます。",
        ),
        goal: "お礼に対して『どういたしまして』と返しましょう。",
        choices: [
          choice(
            "greeting-close-male",
            ["never-mind", "polite-male"],
            "どういたしまして。",
            "ไม่เป็นไร を、お礼への返答として使う場面です。",
          ),
          choice(
            "greeting-close-female",
            ["never-mind", "polite-female-statement"],
            "どういたしまして。",
            "ไม่เป็นไร を、お礼への返答として使う場面です。",
          ),
          choice(
            "greeting-close-decline",
            ["not", "take", "polite-male"],
            "要りません。",
            "ไม่เอา は要らないという内容です。今回はお礼に応じる目標なので別の表現を選びます。",
          ),
        ],
        answerIds: ["greeting-close-male", "greeting-close-female"],
        explanation:
          "ไม่เป็นไร は、この場面ではお礼に対する『どういたしまして』に当たる返答例です。ほかに『大丈夫』『気にしないで』など文脈による使い方があります。",
      },
    ],
  }),
  scenario({
    id: "cafe-water",
    title: "カフェで水をお願い",
    setting:
      "カフェで水を頼み、追加のコーヒーを断って、お礼を伝えます。料金や量を指定する会話はここでは扱いません。",
    objective: "欲しい飲み物を頼み、不要な提案を丁寧に断る。",
    relatedLessonIds: [
      "requests-modals",
      "predicates-negation",
      "basic-questions",
    ],
    steps: [
      {
        id: "cafe-water-order",
        npc: phrase(
          ["hello", "polite-female-statement"],
          "こんにちは。",
          politeNote,
        ),
        goal: "水を丁寧に頼みましょう。",
        choices: [
          choice(
            "cafe-order-male",
            ["request", "water", "polite-male"],
            "水をください。",
            "ขอ の後に欲しいもの น้ำ を置き、水を求めています。",
          ),
          choice(
            "cafe-order-female",
            ["request", "water", "polite-female-statement"],
            "水をください。",
            "ขอ の後に欲しいもの น้ำ を置き、水を求めています。",
          ),
          choice(
            "cafe-order-leave",
            ["request", "go", "polite-female-statement"],
            "行かせてください。",
            "ขอไป は行くことの許可を求める内容です。水を頼む目標には น้ำ を使います。",
          ),
        ],
        answerIds: ["cafe-order-male", "cafe-order-female"],
        explanation:
          "ขอน้ำ は水を求める依頼です。ขอ＋名詞の基本を、文末の丁寧詞と組み合わせています。",
      },
      {
        id: "cafe-water-decline",
        npc: phrase(
          ["receive", "coffee", "question-particle", "polite-female-question"],
          "コーヒーはいかがですか。",
          "รับ は受け取ることを表し、この場面では店員が飲み物を勧めています。",
        ),
        goal: "コーヒーは要らないと丁寧に断りましょう。",
        choices: [
          choice(
            "cafe-decline-male",
            ["not", "receive", "polite-male"],
            "結構です。",
            "ไม่รับ と否定して、ここでは勧められたコーヒーを受けないと伝えています。",
          ),
          choice(
            "cafe-decline-female",
            ["not", "receive", "polite-female-statement"],
            "結構です。",
            "ไม่รับ と否定して、ここでは勧められたコーヒーを受けないと伝えています。",
          ),
          choice(
            "cafe-decline-accept",
            ["receive", "polite-male"],
            "いただきます。",
            "รับ はこの質問ではコーヒーを受ける返答です。今回は断る目標なので ไม่ を付けます。",
          ),
        ],
        answerIds: ["cafe-decline-male", "cafe-decline-female"],
        explanation:
          "相手が使った รับ を、ไม่รับ と否定する返答例です。日本語の『結構です』だけでは承諾にも拒否にも取れるため、この場面では拒否の意味です。",
      },
      {
        id: "cafe-water-thanks",
        npc: phrase(
          ["can", "polite-female-statement"],
          "はい、承知しました。",
          "ได้ はこの場面では依頼を受ける返答です。",
        ),
        goal: "店員に『ありがとう』と伝えましょう。",
        choices: [
          choice(
            "cafe-thanks-male",
            ["thank-you", "polite-male"],
            "ありがとうございます。",
            "ขอบคุณ はお礼を伝える語です。",
          ),
          choice(
            "cafe-thanks-female",
            ["thank-you", "polite-female-statement"],
            "ありがとうございます。",
            "ขอบคุณ はお礼を伝える語です。",
          ),
          choice(
            "cafe-thanks-decline",
            ["not", "receive", "polite-male"],
            "結構です。",
            "この返答は受けないと伝える内容です。今回は依頼を受けてもらったお礼を伝えます。",
          ),
        ],
        answerIds: ["cafe-thanks-male", "cafe-thanks-female"],
        explanation:
          "ขอบคุณ に丁寧詞を添えてお礼を伝えます。ここでは2つの話し方をどちらも返答例として扱います。",
      },
    ],
  }),
  scenario({
    id: "shopping-price",
    title: "買い物で値段を聞く",
    setting: "店で商品を指さし、20バーツという返事を聞く場面です。",
    objective: "商品の値段を尋ね、買う意思を伝えてお礼を言う。",
    relatedLessonIds: [
      "numbers-classifiers",
      "basic-questions",
      "pronouns-politeness",
    ],
    steps: [
      {
        id: "shopping-price-ask",
        npc: phrase(
          ["hello", "polite-female-statement"],
          "こんにちは。",
          politeNote,
        ),
        goal: "指さした商品の値段を丁寧に尋ねましょう。",
        choices: [
          choice(
            "shopping-ask-male",
            ["price", "how-much", "polite-male"],
            "値段はいくらですか。",
            "ราคา は価格、เท่าไร はいくらかを尋ねる語です。",
          ),
          choice(
            "shopping-ask-female",
            ["price", "how-much", "polite-female-question"],
            "値段はいくらですか。",
            "価格を尋ねる疑問文なので、このモデルの丁寧詞は คะ です。",
          ),
          choice(
            "shopping-ask-water",
            ["request", "water", "polite-male"],
            "水をください。",
            "これは水を求める内容です。指さした商品の値段を尋ねる目標には ราคาเท่าไร を選びます。",
          ),
        ],
        answerIds: ["shopping-ask-male", "shopping-ask-female"],
        explanation:
          "指さした商品が文脈から分かるので、ราคาเท่าไร と価格を尋ねる練習です。ครับ を使う形と、疑問の คะ を使う形の両方を示しています。",
      },
      {
        id: "shopping-price-buy",
        npc: phrase(
          ["twenty", "baht", "polite-female-statement"],
          "20バーツです。",
        ),
        goal: "その商品を買うと丁寧に伝えましょう。",
        choices: [
          choice(
            "shopping-buy-male",
            ["take", "polite-male"],
            "これをください。",
            "指さした商品が分かるこの場面では、เอา でそれを選ぶ意思を伝えています。",
          ),
          choice(
            "shopping-buy-female",
            ["take", "polite-female-statement"],
            "これをください。",
            "指さした商品が分かるこの場面では、เอา でそれを選ぶ意思を伝えています。",
          ),
          choice(
            "shopping-buy-no",
            ["not", "take", "polite-male"],
            "要りません。",
            "ไม่เอา は要らないという返答です。今回は買う意思を伝える目標です。",
          ),
        ],
        answerIds: ["shopping-buy-male", "shopping-buy-female"],
        explanation:
          "เอา はここでは相手にも分かる商品を選ぶ返答です。商品が特定されていない場面へ、この短い返答だけを機械的に当てはめないようにします。",
      },
      {
        id: "shopping-price-thanks",
        npc: phrase(
          ["thank-you", "polite-female-statement"],
          "ありがとうございます。",
          "このモデルでは会計を済ませた場面です。",
        ),
        goal: "店員に、こちらからもお礼を伝えましょう。",
        choices: [
          choice(
            "shopping-thanks-male",
            ["thank-you", "polite-male"],
            "ありがとうございます。",
            "店員へこちらからもお礼を伝えています。",
          ),
          choice(
            "shopping-thanks-female",
            ["thank-you", "polite-female-statement"],
            "ありがとうございます。",
            "店員へこちらからもお礼を伝えています。",
          ),
          choice(
            "shopping-thanks-price",
            ["price", "how-much", "polite-male"],
            "値段はいくらですか。",
            "これは価格を尋ね直す内容です。今回は会計後にお礼を伝えます。",
          ),
        ],
        answerIds: ["shopping-thanks-male", "shopping-thanks-female"],
        explanation:
          "相手がお礼を言ったあと、こちらからも ขอบคุณ と感謝を伝えるモデルです。実際の自然な終わり方をこの返答だけに限定するものではありません。",
      },
    ],
  }),
  scenario({
    id: "restroom-directions",
    title: "トイレへの道を聞く",
    setting:
      "案内の人にトイレの場所を尋ね、右という案内を確認します。距離や細かな経路は扱いません。",
    objective: "場所を尋ね、方向を聞き返して、お礼を伝える。",
    relatedLessonIds: [
      "predicates-negation",
      "basic-questions",
      "pronouns-politeness",
    ],
    steps: [
      {
        id: "restroom-directions-ask",
        npc: phrase(
          ["hello", "polite-female-statement"],
          "こんにちは。",
          politeNote,
        ),
        goal: "トイレがどこにあるか、丁寧に尋ねましょう。",
        choices: [
          choice(
            "restroom-ask-male",
            ["restroom", "stay", "where", "polite-male"],
            "トイレはどこですか。",
            "ห้องน้ำ が尋ねたい場所、อยู่ที่ไหน がどこにあるかを尋ねる内容です。",
          ),
          choice(
            "restroom-ask-female",
            ["restroom", "stay", "where", "polite-female-question"],
            "トイレはどこですか。",
            "場所を尋ねる疑問文なので、このモデルの丁寧詞は คะ です。",
          ),
          choice(
            "restroom-ask-tell",
            ["restroom", "stay", "way", "right", "polite-male"],
            "トイレは右です。",
            "これは場所を相手に教える内容です。今回は自分が場所を尋ねる目標です。",
          ),
        ],
        answerIds: ["restroom-ask-male", "restroom-ask-female"],
        explanation:
          "この場面では ห้องน้ำ でトイレを指し、อยู่ที่ไหน と所在を尋ねます。ห้องน้ำ はほかの文脈では浴室も指す語です。",
      },
      {
        id: "restroom-directions-confirm",
        npc: phrase(
          ["stay", "way", "right", "polite-female-statement"],
          "右にあります。",
          "この会話では、尋ねたトイレを主語として繰り返さずに答えています。",
        ),
        goal: "『右ですね？』と、聞いた方向を確認しましょう。",
        choices: [
          choice(
            "restroom-confirm-male",
            ["way", "right", "yes", "question-particle", "polite-male"],
            "右ですね。",
            "ทางขวา で右の方向を示し、ใช่ไหม で確認を求めています。",
          ),
          choice(
            "restroom-confirm-female",
            [
              "way",
              "right",
              "yes",
              "question-particle",
              "polite-female-question",
            ],
            "右ですね。",
            "ทางขวา で右の方向を示し、ใช่ไหม で確認を求めています。",
          ),
          choice(
            "restroom-confirm-left",
            ["way", "left", "yes", "question-particle", "polite-male"],
            "左ですね。",
            "ซ้าย は左です。相手が伝えた ขวา（右）を確かめる目標には方向が合いません。",
          ),
        ],
        answerIds: ["restroom-confirm-male", "restroom-confirm-female"],
        explanation:
          "ขวา は右、ซ้าย は左。ใช่ไหม を添えて相手に確認するモデルです。この場面で指定された方向を確かめる練習で、聞き返しの全表現を網羅してはいません。",
      },
      {
        id: "restroom-directions-thanks",
        npc: phrase(
          ["yes", "polite-female-statement"],
          "はい、そのとおりです。",
        ),
        goal: "案内してくれた相手に、お礼を伝えましょう。",
        choices: [
          choice(
            "restroom-thanks-male",
            ["thank-you", "polite-male"],
            "ありがとうございます。",
            "教えてもらったお礼を ขอบคุณ で伝えています。",
          ),
          choice(
            "restroom-thanks-female",
            ["thank-you", "polite-female-statement"],
            "ありがとうございます。",
            "教えてもらったお礼を ขอบคุณ で伝えています。",
          ),
          choice(
            "restroom-thanks-decline",
            ["not", "receive", "polite-male"],
            "結構です。",
            "これは勧められたものを受けない返答の例です。今回は道案内への感謝を伝えます。",
          ),
        ],
        answerIds: ["restroom-thanks-male", "restroom-thanks-female"],
        explanation:
          "ここでは ขอบคุณ に丁寧詞を添えて、案内へのお礼を伝えます。文字の選択で目標の意味を確かめるもので、発音や実際の会話能力を採点しているわけではありません。",
      },
    ],
  }),
];

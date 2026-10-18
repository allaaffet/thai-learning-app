import type { ContentSource, ExampleSentence } from "@/lib/content-types";
import type { GrammarPoint, VocabularyEntry } from "@/lib/language-types";

export const vocabularyCategories: { id: string; label: string }[] = [
  { id: "pronouns", label: "人・代名詞" },
  { id: "verbs", label: "動作・状態" },
  { id: "nouns", label: "身の回りのもの" },
  { id: "qualities", label: "性質・大きさ" },
  { id: "particles", label: "否定・疑問・丁寧さ" },
  { id: "quantity", label: "数・類別詞" },
  { id: "connections", label: "時間・比較・つながり" },
];

export const languageSources: ContentSource[] = [
  {
    id: "wiktionary-ipa-phase4",
    title: "Thai Wiktionary IPA corpus — Phase 4の40語",
    publisher: "Thai Wiktionary contributors / PyThaiNLP",
    url: "https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv",
    checkedAt: "2026-10-18",
    access: "accessible",
    scope:
      "固定コミットのTSVで40語のIPAだけを照合。語内の区切り空白を除去し、/ /を付与、破擦音の結合線を既存教材のtɕ表記へ統一。หนังสือ・กำลัง・อะไรの音節境界は点で保持。ค่ะは下降調、ข้าว・น้ำは長母音形を採用。日本語訳・例文全体のIPA・文法説明は未照合。Thai Wiktionary由来CC BY-SA 3.0、専門家監修前。",
  },
  {
    id: "ud-thai-grammar-phase4",
    title: "Universal Dependencies — UD for Thai",
    publisher: "Universal Dependencies contributors",
    url: "https://github.com/UniversalDependencies/docs/blob/c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8/_th/index.md",
    checkedAt: "2026-10-18",
    access: "accessible",
    scope:
      "固定コミットのMorphology/Syntaxを実読し、เป็นのcopula、กำลังのprogressive、จะのfuture、แล้วのperfect、および主語・直接目的語が裸の名詞句であるという記述だけを限定照合。統語注釈の資料であり、全例文・日本語訳・SVOの網羅的説明・語用論や助詞の使い分けを確認したものではない。本文や例文は転載せず独立記述。",
  },
  {
    id: "ud-thai-classifiers-phase4",
    title: "Universal Dependencies — Thai clf / NounType",
    publisher: "Universal Dependencies contributors",
    url: "https://github.com/UniversalDependencies/docs/blob/c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8/_th/dep/clf.md",
    checkedAt: "2026-10-18",
    access: "accessible",
    scope:
      "同コミットのclf.md冒頭・説明、および_th/feat/NounType.mdの基本構文を実読。名詞＋数詞＋類別詞、数える名詞による類別詞の選択、動物のตัว・本のเล่ม、名詞の後ろに置く修飾の基本だけを限定照合。1の別語順や教材例文全体・訳は未照合。本文や例文は転載せず独立作成。",
  },
];

const ipaSource = "wiktionary-ipa-phase4";

/**
 * 個々の語のIPAだけを辞書資料と照合した学習用モデル。
 * IPA部分: Thai Wiktionary contributors / PyThaiNLP, CC BY-SA 3.0。
 * 整形と選択した変種は languageSources と docs/PHASE4_SOURCES.md を参照。
 * 例文は独立作成・未監修。単語を区切った発音モデルで連続発話を保証しない。
 */
const words = [
  ["person", "คน", "/kʰon˧/", "人", "pronouns"],
  [
    "i-male",
    "ผม",
    "/pʰom˩˩˦/",
    "私（男性話者がよく使う丁寧な一人称）",
    "pronouns",
  ],
  ["i-informal", "ฉัน", "/tɕʰan˩˩˦/", "私（親しい間柄など）", "pronouns"],
  ["you", "คุณ", "/kʰun˧/", "あなた（丁寧な呼びかけにも使う）", "pronouns"],
  ["he-she", "เขา", "/kʰaw˩˩˦/", "彼・彼女", "pronouns"],
  ["we", "เรา", "/raw˧/", "私たち", "pronouns"],
  ["eat", "กิน", "/kin˧/", "食べる", "verbs"],
  ["drink", "ดื่ม", "/dɯːm˨˩/", "飲む", "verbs"],
  ["go", "ไป", "/paj˧/", "行く", "verbs"],
  ["come", "มา", "/maː˧/", "来る", "verbs"],
  ["have", "มี", "/miː˧/", "ある・いる・持っている", "verbs"],
  ["be", "เป็น", "/pen˧/", "〜である（身分・種類など）", "verbs"],
  ["stay", "อยู่", "/juː˨˩/", "いる・住む・とどまる", "verbs"],
  ["like", "ชอบ", "/tɕʰɔːp̚˥˩/", "好む・好きである", "verbs"],
  ["read", "อ่าน", "/ʔaːn˨˩/", "読む", "verbs"],
  ["rice", "ข้าว", "/kʰaːw˥˩/", "米・ご飯", "nouns"],
  ["water", "น้ำ", "/naːm˦˥/", "水", "nouns"],
  ["home", "บ้าน", "/baːn˥˩/", "家", "nouns"],
  ["cat", "แมว", "/mɛːw˧/", "猫", "nouns"],
  ["book", "หนังสือ", "/naŋ˩˩˦.sɯː˩˩˦/", "本", "nouns"],
  ["good", "ดี", "/diː˧/", "よい", "qualities"],
  ["big", "ใหญ่", "/jaj˨˩/", "大きい", "qualities"],
  ["not", "ไม่", "/maj˥˩/", "〜しない・〜ではない", "particles"],
  [
    "question-particle",
    "ไหม",
    "/maj˩˩˦/",
    "〜ですか（はい・いいえを尋ねる）",
    "particles",
  ],
  [
    "polite-male",
    "ครับ",
    "/kʰrap̚˦˥/",
    "丁寧さを添える文末詞（主に男性話者）",
    "particles",
  ],
  [
    "polite-female-statement",
    "ค่ะ",
    "/kʰaʔ˥˩/",
    "丁寧さを添える文末詞（主に女性話者・平叙や応答）",
    "particles",
  ],
  [
    "polite-female-question",
    "คะ",
    "/kʰaʔ˦˥/",
    "丁寧さを添える文末詞（主に女性話者・疑問など）",
    "particles",
  ],
  ["one", "หนึ่ง", "/nɯŋ˨˩/", "1・一つ", "quantity"],
  ["two", "สอง", "/sɔːŋ˩˩˦/", "2・二つ", "quantity"],
  ["animal-classifier", "ตัว", "/tua̯˧/", "動物などを数える類別詞", "quantity"],
  ["book-classifier", "เล่ม", "/lem˥˩/", "本などを数える類別詞", "quantity"],
  [
    "already",
    "แล้ว",
    "/lɛːw˦˥/",
    "もう〜した・〜になった（完了や変化）",
    "connections",
  ],
  ["ongoing", "กำลัง", "/kam˧.laŋ˧/", "〜しているところだ", "connections"],
  ["future", "จะ", "/tɕaʔ˨˩/", "〜するつもりだ・〜だろう", "connections"],
  ["want", "อยาก", "/jaːk̚˨˩/", "〜したい", "verbs"],
  ["request", "ขอ", "/kʰɔː˩˩˦/", "求める・〜させてください", "verbs"],
  ["than", "กว่า", "/kwaː˨˩/", "〜より（比較）", "connections"],
  ["and", "และ", "/lɛʔ˦˥/", "〜と・そして", "connections"],
  ["because", "เพราะ", "/pʰrɔʔ˦˥/", "なぜなら〜だから", "connections"],
  ["what", "อะไร", "/ʔa˨˩.raj˧/", "何", "particles"],
] as const;

type WordId = (typeof words)[number][0];
type SentenceWord = { id: WordId; role: string };

function sentence(
  meaning: string,
  items: SentenceWord[],
  note?: string,
): GrammarPoint["examples"][number] {
  const selected = items.map((item) => {
    const word = words.find(([id]) => id === item.id);
    if (!word) throw new Error(`例文の語彙が見つかりません: ${item.id}`);
    return { word, role: item.role };
  });
  return {
    thai: selected.map(({ word }) => word[1]).join(""),
    ipa: `/${selected.map(({ word }) => word[2].slice(1, -1)).join(" ")}/`,
    meaning,
    note:
      note ??
      "IPAは語ごとの学習用表記です。例文と連続発話の読み方は専門家監修前です。",
    segments: selected.map(({ word, role }) => ({ thai: word[1], role })),
  };
}

const ex = {
  eatRice: sentence("私はご飯を食べます。", [
    { id: "i-male", role: "主語：私" },
    { id: "eat", role: "動詞：食べる" },
    { id: "rice", role: "目的語：ご飯" },
  ]),
  drinkWater: sentence("あなたは水を飲みます。", [
    { id: "you", role: "主語：あなた" },
    { id: "drink", role: "動詞：飲む" },
    { id: "water", role: "目的語：水" },
  ]),
  likeCat: sentence("私は猫が好きです。", [
    { id: "i-informal", role: "主語：私" },
    { id: "like", role: "動詞：好む" },
    { id: "cat", role: "目的語：猫" },
  ]),
  sheCome: sentence("彼・彼女は来ます。", [
    { id: "he-she", role: "主語：彼・彼女" },
    { id: "come", role: "動詞：来る" },
  ]),
  weGo: sentence("私たちは行きます。", [
    { id: "we", role: "主語：私たち" },
    { id: "go", role: "動詞：行く" },
  ]),
  maleRead: sentence("私は本を読みます。", [
    { id: "i-male", role: "主語：私" },
    { id: "read", role: "動詞：読む" },
    { id: "book", role: "目的語：本" },
    { id: "polite-male", role: "丁寧な文末詞" },
  ]),
  femaleRead: sentence("私は本を読みます。", [
    { id: "i-informal", role: "主語：私" },
    { id: "read", role: "動詞：読む" },
    { id: "book", role: "目的語：本" },
    { id: "polite-female-statement", role: "平叙・応答の丁寧な文末詞" },
  ]),
  haveCat: sentence("私は猫を飼っています。", [
    { id: "i-male", role: "主語：私" },
    { id: "have", role: "動詞：持っている" },
    { id: "cat", role: "目的語：猫" },
  ]),
  stayHome: sentence("彼・彼女は家にいます。", [
    { id: "he-she", role: "主語：彼・彼女" },
    { id: "stay", role: "動詞：いる" },
    { id: "home", role: "場所：家" },
  ]),
  goodPerson: sentence("彼・彼女はよい人です。", [
    { id: "he-she", role: "主語：彼・彼女" },
    { id: "be", role: "名詞につなぐ述語：〜である" },
    { id: "person", role: "名詞：人" },
    { id: "good", role: "名詞の後ろの修飾語：よい" },
  ]),
  homeBig: sentence("家は大きいです。", [
    { id: "home", role: "主語：家" },
    { id: "big", role: "性質を表す述語：大きい" },
  ]),
  notEat: sentence("私はご飯を食べません。", [
    { id: "i-male", role: "主語：私" },
    { id: "not", role: "否定：〜しない" },
    { id: "eat", role: "動詞：食べる" },
    { id: "rice", role: "目的語：ご飯" },
  ]),
  notBig: sentence("家は大きくありません。", [
    { id: "home", role: "主語：家" },
    { id: "not", role: "否定：〜ではない" },
    { id: "big", role: "性質を表す述語：大きい" },
  ]),
  likeQuestion: sentence("あなたは猫が好きですか。", [
    { id: "you", role: "主語：あなた" },
    { id: "like", role: "動詞：好む" },
    { id: "cat", role: "目的語：猫" },
    { id: "question-particle", role: "はい・いいえを尋ねる疑問の文末詞" },
    { id: "polite-female-question", role: "疑問の丁寧な文末詞" },
  ]),
  eatWhat: sentence("あなたは何を食べますか。", [
    { id: "you", role: "主語：あなた" },
    { id: "eat", role: "動詞：食べる" },
    { id: "what", role: "目的語の位置の疑問詞：何" },
  ]),
  twoCats: sentence("猫2匹", [
    { id: "cat", role: "数える名詞：猫" },
    { id: "two", role: "数：2" },
    { id: "animal-classifier", role: "類別詞：動物を数える" },
  ]),
  oneBook: sentence("本1冊", [
    { id: "book", role: "数える名詞：本" },
    { id: "one", role: "数：1" },
    { id: "book-classifier", role: "類別詞：本を数える" },
  ]),
  reading: sentence("彼・彼女は本を読んでいるところです。", [
    { id: "he-she", role: "主語：彼・彼女" },
    { id: "ongoing", role: "進行中を表す語" },
    { id: "read", role: "動詞：読む" },
    { id: "book", role: "目的語：本" },
  ]),
  willGo: sentence("私は行くつもりです。", [
    { id: "i-male", role: "主語：私" },
    { id: "future", role: "予定・見込みを表す語" },
    { id: "go", role: "動詞：行く" },
  ]),
  ateRice: sentence("私はもうご飯を食べました。", [
    { id: "i-male", role: "主語：私" },
    { id: "eat", role: "動詞：食べる" },
    { id: "rice", role: "目的語：ご飯" },
    { id: "already", role: "完了・状況の変化を示す語" },
  ]),
  wantWater: sentence("私は水を飲みたいです。", [
    { id: "i-informal", role: "主語：私" },
    { id: "want", role: "希望：〜したい" },
    { id: "drink", role: "動詞：飲む" },
    { id: "water", role: "目的語：水" },
  ]),
  requestWater: sentence("水をください。", [
    { id: "request", role: "依頼：〜をお願いします" },
    { id: "water", role: "求めるもの：水" },
    { id: "polite-male", role: "丁寧な文末詞" },
  ]),
  requestRead: sentence("本を読ませてください。", [
    { id: "request", role: "許可を求める依頼：〜させてください" },
    { id: "read", role: "自分が行う動作：読む" },
    { id: "book", role: "目的語：本" },
    { id: "polite-male", role: "丁寧な文末詞" },
  ]),
  compare: sentence("私はあなたより大きいです。", [
    { id: "i-male", role: "比較の対象：私" },
    { id: "big", role: "比較する性質：大きい" },
    { id: "than", role: "比較：〜より" },
    { id: "you", role: "比較の基準：あなた" },
  ]),
  eatAndDrink: sentence("私はご飯を食べて、水を飲みます。", [
    { id: "i-male", role: "共通の主語：私" },
    { id: "eat", role: "1つ目の動詞：食べる" },
    { id: "rice", role: "1つ目の目的語：ご飯" },
    { id: "and", role: "並列：そして" },
    { id: "drink", role: "2つ目の動詞：飲む" },
    { id: "water", role: "2つ目の目的語：水" },
  ]),
  likeBecause: sentence("私はその家が好きです。家が大きいからです。", [
    { id: "i-male", role: "主語：私" },
    { id: "like", role: "動詞：好む" },
    { id: "home", role: "目的語：家（文脈上のその家）" },
    { id: "because", role: "理由をつなぐ語：なぜなら〜だから" },
    { id: "home", role: "理由の節の主語：家" },
    { id: "big", role: "理由の節の述語：大きい" },
  ]),
};

const examples: Record<WordId, ExampleSentence> = {
  person: ex.goodPerson,
  "i-male": ex.eatRice,
  "i-informal": ex.likeCat,
  you: ex.drinkWater,
  "he-she": ex.sheCome,
  we: ex.weGo,
  eat: ex.eatRice,
  drink: ex.drinkWater,
  go: ex.weGo,
  come: ex.sheCome,
  have: ex.haveCat,
  be: ex.goodPerson,
  stay: ex.stayHome,
  like: ex.likeCat,
  read: ex.maleRead,
  rice: ex.eatRice,
  water: ex.drinkWater,
  home: ex.stayHome,
  cat: ex.likeCat,
  book: ex.maleRead,
  good: ex.goodPerson,
  big: ex.homeBig,
  not: ex.notEat,
  "question-particle": ex.likeQuestion,
  "polite-male": ex.maleRead,
  "polite-female-statement": ex.femaleRead,
  "polite-female-question": ex.likeQuestion,
  one: ex.oneBook,
  two: ex.twoCats,
  "animal-classifier": ex.twoCats,
  "book-classifier": ex.oneBook,
  already: ex.ateRice,
  ongoing: ex.reading,
  future: ex.willGo,
  want: ex.wantWater,
  request: ex.requestWater,
  than: ex.compare,
  and: ex.eatAndDrink,
  because: ex.likeBecause,
  what: ex.eatWhat,
};

const introduced: Record<WordId, string[]> = {
  person: ["pronouns-politeness", "predicates-negation"],
  "i-male": ["basic-word-order", "pronouns-politeness"],
  "i-informal": ["pronouns-politeness"],
  you: ["pronouns-politeness", "basic-questions"],
  "he-she": ["pronouns-politeness"],
  we: ["pronouns-politeness"],
  eat: ["basic-word-order", "time-aspect"],
  drink: ["basic-word-order", "requests-modals"],
  go: ["basic-word-order", "time-aspect"],
  come: ["basic-word-order"],
  have: ["predicates-negation"],
  be: ["predicates-negation"],
  stay: ["predicates-negation"],
  like: ["basic-questions", "comparisons-connectors"],
  read: ["basic-word-order", "time-aspect"],
  rice: ["basic-word-order", "time-aspect"],
  water: ["basic-word-order", "requests-modals"],
  home: ["predicates-negation"],
  cat: ["numbers-classifiers", "basic-questions"],
  book: ["numbers-classifiers", "time-aspect"],
  good: ["predicates-negation", "comparisons-connectors"],
  big: ["predicates-negation", "comparisons-connectors"],
  not: ["predicates-negation"],
  "question-particle": ["basic-questions"],
  "polite-male": ["pronouns-politeness"],
  "polite-female-statement": ["pronouns-politeness"],
  "polite-female-question": ["pronouns-politeness", "basic-questions"],
  one: ["numbers-classifiers"],
  two: ["numbers-classifiers"],
  "animal-classifier": ["numbers-classifiers"],
  "book-classifier": ["numbers-classifiers"],
  already: ["time-aspect"],
  ongoing: ["time-aspect"],
  future: ["time-aspect"],
  want: ["requests-modals"],
  request: ["requests-modals"],
  than: ["comparisons-connectors"],
  and: ["comparisons-connectors"],
  because: ["comparisons-connectors"],
  what: ["basic-questions"],
};

const notes: Partial<Record<WordId, string>> = {
  "i-informal":
    "親しさや立場によって使い分ける一人称です。女性だけの語・いつでも丁寧な語とは扱いません。くだけた発話には高調の変種もありますが、ここは辞書の上昇調形です。",
  "he-she":
    "性別を区別しない三人称です。ここは辞書の上昇調形。くだけた発話の高調形も参照資料にあります。",
  we: "ここでは複数の『私たち』。会話では単数の自称にも使われるため、文脈で判断します。",
  be: "身分・種類を表す名詞をつなぐ基本用法です。『大きい』『よい』という性質の述語の前へ機械的に足しません。『〜である』に対応する表現を全てこの語にまとめないことが大切です。",
  stay: "ここでは人の所在・居住を表す動詞として学びます。進行や継続を示す文末用法は別の用法です。",
  rice: "資料には長母音形と短母音形が収録されています。既存教材と同じ長母音形を用います。กินข้าวは『ご飯を食べる・食事する』です。",
  water:
    "資料には長母音形・短母音形があります。この独立語は長母音形を用います。複合語や発話によって長さが変わる場合があります。",
  "question-particle":
    "中立的な、はい・いいえの質問に用いる基本形です。อะไรを使った『何』の質問には機械的に重ねません。口語の高調形もありますが、ここは辞書の上昇調形です。",
  "polite-male":
    "ここでは男性話者がよく用いる丁寧な文末詞。辞書の完全な/kʰr/の発音モデルです。実際の口語では子音連続が弱まることがあります。話者の性別だけで使用を強制する表現ではありません。",
  "polite-female-statement":
    "声調記号のあるค่ะ。ここでは平叙・応答の下降調形を学び、疑問に用いるคะの高調と区別します。資料には低調の変種もあり、すべての発話の高さを固定する説明ではありません。",
  "polite-female-question":
    "声調記号のないคะ。ここでは疑問文の丁寧な文末詞として学びます。ค่ะと綴り・声調を区別します。呼びかけ等の用法もあり、疑問文だけの語という意味ではありません。",
  one: "今回は基本の『名詞＋数＋類別詞』で学びます。1は『名詞＋類別詞＋หนึ่ง』の順も使われるため、例の語順だけが可能とはしません。",
  "animal-classifier":
    "猫などの動物を数える基本用法です。ตัวには『体』『自分』や衣類などを数える別用法もあります。すべての名詞に使える類別詞ではありません。",
  "book-classifier":
    "本・ノートなど、冊子状のものを数える基本用法です。日本語の助数詞と常に一対一になるわけではありません。",
  already:
    "動作の完了・新しい状況への変化などを表します。日本語の過去形をすべてแล้วへ置き換えることはできません。",
  ongoing:
    "動詞の前に置いて進行中を明示する基本用法です。時刻が過去なら『そのとき〜していた』にもなり、現在時制そのものの語ではありません。",
  future:
    "予定・意志・見込みなどを示す基本用法です。動詞自体を未来形に変えるわけではありません。",
  request:
    "ขอ＋名詞は物を求める依頼、ขอ＋動詞は自分が行うことの許可を求める用法です。『相手に〜してもらう』すべての依頼へ置き換えません。",
  because:
    "理由を表す語。例文は『家が大きいから、その家が好き』という文脈です。理由の節にも主語บ้าน『家』を示しています。",
};

const divided: Partial<Record<WordId, string[]>> = {
  book: ["หนัง", "สือ"],
  ongoing: ["กำ", "ลัง"],
  what: ["อะ", "ไร"],
};

export const vocabularyEntries: VocabularyEntry[] = words.map(
  ([id, thai, ipa, meaning, categoryId]) => ({
    id,
    thai,
    ipa,
    meaning,
    categoryId,
    level: "A1",
    syllables: divided[id] ?? [thai],
    example: examples[id],
    relatedLessonIds: introduced[id],
    sourceIds: [ipaSource],
    verification: "unreviewed",
    ...(notes[id] ? { note: notes[id] } : {}),
  }),
);

function grammar(
  input: Omit<GrammarPoint, "sourceIds" | "verification" | "relatedLessonIds">,
): GrammarPoint {
  return {
    ...input,
    relatedLessonIds: [input.id],
    sourceIds: [
      ipaSource,
      ...(["basic-word-order", "predicates-negation", "time-aspect"].includes(
        input.id,
      )
        ? ["ud-thai-grammar-phase4"]
        : []),
      ...(input.id === "numbers-classifiers"
        ? ["ud-thai-classifiers-phase4"]
        : []),
    ],
    verification: "unreviewed",
  };
}

export const grammarPoints: GrammarPoint[] = [
  grammar({
    id: "basic-word-order",
    title: "主語・動詞・目的語の順番",
    summary:
      "日本語の『私は ご飯を 食べる』に対し、タイ語は基本的に『私 食べる ご飯』です。",
    explanation: [
      "基本の語順は主語＋動詞＋目的語（SVO）。กิน『食べる』の後ろに、その対象のข้าว『ご飯』を置きます。日本語の『を』に当たる助詞を各名詞へ付けて作る文ではありません。",
      "動詞は主語の人称や数だけでは形を変えません。ผมกินข้าวは文脈によって習慣・現在・過去の出来事を表せるので、語順だけから時刻は確定しません。",
      "目的語のない『私たちは行く』なら主語＋動詞で文になります。会話で明らかな主語を省くこともありますが、最初は主語を示して役割を確認します。",
    ],
    pattern: "主語 ＋ 動詞 ＋ 目的語",
    examples: [ex.eatRice, ex.drinkWater, ex.weGo],
    vocabularyIds: [
      "i-male",
      "you",
      "we",
      "eat",
      "drink",
      "go",
      "rice",
      "water",
    ],
  }),
  grammar({
    id: "pronouns-politeness",
    title: "人称代名詞と、丁寧さの添え方",
    summary: "誰を指すかと、どのように丁寧さを示すかを別々に考えます。",
    explanation: [
      "ผมは男性話者がよく用いる丁寧な一人称、ฉันは親しい間柄などで使う一人称です。ฉันを『女性ならいつでも丁寧に使える私』と覚えず、相手との関係や場面も考えます。คุณ『あなた』、เขา『彼・彼女』、เรา『私たち』も基本語です。",
      "文の終わりにครับ、ค่ะ、คะなどを添えて丁寧さを示します。ここではครับは主に男性話者、ค่ะ・คะは主に女性話者がよく用いる形として紹介します。使用は話者の選択や場面にも関わり、性別だけで一律に強制されるものではありません。",
      "基本の平叙・応答はค่ะ、質問はคะです。คะには声調記号がなく、IPAは高調。ค่ะにはマイエークがあり、ここでは下降調形を採用します。綴りの違いは単なる飾りではありません。",
    ],
    pattern: "主語 ＋ 述語 ＋ 丁寧な文末詞",
    examples: [ex.maleRead, ex.femaleRead, ex.likeQuestion],
    vocabularyIds: [
      "i-male",
      "i-informal",
      "you",
      "he-she",
      "we",
      "polite-male",
      "polite-female-statement",
      "polite-female-question",
    ],
  }),
  grammar({
    id: "predicates-negation",
    title: "名詞・性質の述語と、否定",
    summary: "『〜である』を一つの語で機械的に訳さず、述語の種類を見分けます。",
    explanation: [
      "เป็นは身分・分類などの名詞をつなぐ基本の述語です。เขาเป็นคนดี『彼・彼女はよい人だ』では、คนดี『よい人』が名詞のまとまりです。ดี『よい』は名詞คน『人』の後ろに置かれます。",
      "性質はบ้านใหญ่『家は大きい』のように、性質を表す語だけで述語になれます。この用法でเป็นを足して『บ้านเป็นใหญ่』とはしません。同じบ้านใหญ่は、使われる位置によって『大きい家』という名詞のまとまりにもなり、文脈で区別します。",
      "今回の基本否定は、動詞・性質の述語の前にไม่を置きます。ไม่กิน『食べない』、ไม่ใหญ่『大きくない』です。ただし『まだ〜していない』『存在しない』『〜ではない（同一性）』などには別の表現もあり、否定を一つの型ですべて処理するわけではありません。",
      "มีは存在や所有、อยู่は所在・居住を表します。『持っている』『いる』『〜である』を日本語訳だけで一つにまとめないことが大切です。",
    ],
    pattern: "主語 ＋ 性質 ／ 主語 ＋ ไม่ ＋ 動詞・性質",
    examples: [
      ex.goodPerson,
      ex.homeBig,
      ex.notEat,
      ex.notBig,
      ex.haveCat,
      ex.stayHome,
    ],
    vocabularyIds: [
      "person",
      "be",
      "have",
      "stay",
      "home",
      "good",
      "big",
      "not",
    ],
  }),
  grammar({
    id: "basic-questions",
    title: "はい・いいえの質問と、『何』の質問",
    summary:
      "ไหมを付ける質問と、知りたい語をอะไรへ置き換える質問を区別します。",
    explanation: [
      "はい・いいえで答えられる中立的な質問は、基本の文の後ろにไหมを付けます。คุณชอบแมวไหมは『あなたは猫が好きですか』。丁寧な文末詞は、その後ろに添えます。",
      "อะไร『何』は、答えとなる語と同じ位置へ置きます。คุณกินอะไรは『あなたは何を食べますか』で、อะไรは動詞กินの目的語の位置です。英語のように必ず文頭へ移動させるわけではありません。",
      "『何』の質問へไหมを機械的に重ねません。ไหมがあるから全ての疑問文になるのではなく、どの情報を尋ねたいかで型を選びます。",
    ],
    pattern: "基本文 ＋ ไหม ／ 主語 ＋ 動詞 ＋ อะไร",
    examples: [ex.likeQuestion, ex.eatWhat],
    vocabularyIds: [
      "you",
      "like",
      "cat",
      "eat",
      "question-particle",
      "what",
      "polite-female-question",
    ],
  }),
  grammar({
    id: "numbers-classifiers",
    title: "数と類別詞",
    summary: "『猫2匹』『本1冊』を、名詞・数・類別詞の組み合わせで表します。",
    explanation: [
      "基本の順序は名詞＋数＋類別詞です。แมวสองตัว『猫2匹』では、แมวが猫、สองが2、ตัวが猫などの動物を数える類別詞です。日本語の『2匹の猫』の順をそのまま移しません。",
      "本にはเล่มを使い、หนังสือหนึ่งเล่ม『本1冊』と表せます。類別詞は名詞の性質に応じて選ぶので、すべてをตัวで数えることはできません。",
      "1は類別詞の後ろに置く『หนังสือเล่มหนึ่ง』という語順も使われます。今回は比較しやすい名詞＋数＋類別詞を基本として練習しますが、それだけが正しい語順という意味ではありません。",
    ],
    pattern: "名詞 ＋ 数 ＋ 類別詞",
    examples: [ex.twoCats, ex.oneBook],
    vocabularyIds: [
      "cat",
      "book",
      "one",
      "two",
      "animal-classifier",
      "book-classifier",
    ],
  }),
  grammar({
    id: "time-aspect",
    title: "進行・予定・完了を添える",
    summary:
      "動詞を活用させる代わりに、文脈と補助的な語で出来事の見方を表します。",
    explanation: [
      "กำลังは動詞の前に置いて『〜しているところ』を明示します。เขากำลังอ่านหนังสือは『彼・彼女は本を読んでいるところ』。過去の時点を話題にしていれば『読んでいた』にもなり、กำลังそのものが現在時制を意味するわけではありません。",
      "จะは動詞の前に置き、予定・意志・見込みなどを表します。ผมจะไป『私は行くつもり』のように使います。動詞ไปそのものが未来形になるわけではありません。",
      "แล้วは今回の用法では動詞句の後ろに置き、完了や新しい状況への変化を表します。ผมกินข้าวแล้ว『私はもうご飯を食べた』。日本語の過去形を全てแล้วに置き換えることはできません。",
      "語尾の形だけで『現在・過去・未来』を決めず、何が進行中か、何を予定しているか、何がもう変わったかを考えます。時刻を示す語との組み合わせは後続教材で扱います。",
    ],
    pattern: "กำลัง ＋ 動詞 ／ จะ ＋ 動詞 ／ 動詞句 ＋ แล้ว",
    examples: [ex.reading, ex.willGo, ex.ateRice],
    vocabularyIds: [
      "ongoing",
      "future",
      "already",
      "he-she",
      "read",
      "book",
      "go",
      "eat",
      "rice",
    ],
  }),
  grammar({
    id: "requests-modals",
    title: "希望を伝える・許可を求める",
    summary:
      "『〜したい』と『〜をください・〜させてください』の違いを確かめます。",
    explanation: [
      "อยากは動詞の前に置き、『〜したい』という希望を表します。ฉันอยากดื่มน้ำ『私は水を飲みたい』。この意味では、名詞น้ำを直接続けるのではなく、何をしたいかを表す動詞ดื่ม『飲む』を置きます。",
      "ขอ＋名詞は、物などを求める基本の依頼です。ขอน้ำครับは『水をください』。丁寧な文末詞を添え、短い依頼として練習します。",
      "ขอ＋動詞は『自分に〜させてください』と許可を求める用法です。ขออ่านหนังสือครับは『本を読ませてください』で、相手に本を読んでもらう依頼とは区別します。相手にしてもらう依頼の別の型は今回の範囲外です。",
    ],
    pattern: "อยาก ＋ 動詞 ／ ขอ ＋ 名詞・動詞句 ＋ 丁寧な文末詞",
    examples: [ex.wantWater, ex.requestWater, ex.requestRead],
    vocabularyIds: [
      "want",
      "request",
      "drink",
      "water",
      "read",
      "book",
      "polite-male",
    ],
  }),
  grammar({
    id: "comparisons-connectors",
    title: "比べる・並べる・理由をつなぐ",
    summary: "กว่า・และ・เพราะの役割を区別して、短い考えをつなぎます。",
    explanation: [
      "比較の基本は、対象＋性質＋กว่า＋基準です。ผมใหญ่กว่าคุณは『私はあなたより大きい』。日本語の『あなたより』に相当する部分が、性質を表すใหญ่の後ろに続きます。",
      "และは名詞や動詞句などを並べて『〜と・そして』を表します。ผมกินข้าวและดื่มน้ำは『私はご飯を食べて、水を飲む』。主語ผมを共通にして、食べることと飲むことをつなぎます。",
      "เพราะは理由を導きます。ผมชอบบ้านเพราะบ้านใหญ่は『私はその家が好きだ、家が大きいからだ』という文脈の例です。理由の節にもบ้าน『家』を主語として示しています。เพราะは単なる並列の『と』ではありません。",
      "短い文でも、誰が・何を・何と比べるのか、どの部分が理由なのかを区切って理解します。より長い複文や接続の細かな制約は後続教材で扱います。",
    ],
    pattern:
      "対象 ＋ 性質 ＋ กว่า ＋ 基準 ／ A ＋ และ ＋ B ／ 文 ＋ เพราะ ＋ 理由",
    examples: [ex.compare, ex.eatAndDrink, ex.likeBecause],
    vocabularyIds: [
      "big",
      "than",
      "you",
      "and",
      "because",
      "home",
      "eat",
      "rice",
      "drink",
      "water",
      "like",
    ],
  }),
];

export function getVocabularyEntry(id: string): VocabularyEntry | undefined {
  return vocabularyEntries.find((entry) => entry.id === id);
}

export function getGrammarPoint(id: string): GrammarPoint | undefined {
  return grammarPoints.find((point) => point.id === id);
}

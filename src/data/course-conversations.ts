import { conversationScenarios } from "@/data/conversations";
import type {
  ConversationScenario,
  ConversationStep,
} from "@/lib/conversation-types";

/**
 * 本編の各課で使う会話の目標。Thai・訳・返答・解説は既存の台本を参照する。
 * 文法の前提を先取りして説明した扱いにはせず、最初は表現のまとまりで出会う。
 */
export interface CourseConversationUnit {
  lessonId: string;
  title: string;
  objective: string;
  context: string;
  scenarioId: string;
  stepIds: string[];
  focusWordIds: string[];
}

const greetingSteps = [
  "greeting-origin-hello",
  "greeting-origin-from",
  "greeting-origin-close",
];
const cafeSteps = [
  "cafe-water-order",
  "cafe-water-decline",
  "cafe-water-thanks",
];
const shoppingSteps = [
  "shopping-price-ask",
  "shopping-price-buy",
  "shopping-price-thanks",
];
const directionsSteps = [
  "restroom-directions-ask",
  "restroom-directions-confirm",
  "restroom-directions-thanks",
];

/** 全30課への明示的な対応。後半にも既習会話を戻し、未知の文法例を生成しない。 */
export const courseConversationUnits: CourseConversationUnit[] = [
  {
    lessonId: "sounds-and-letters",
    title: "「こんにちは」から始めよう",
    objective: "相手の挨拶に、短い挨拶を返す。",
    context:
      "宿の受付で、相手が挨拶してくれました。まずは表現のまとまりと意味にふれましょう。",
    scenarioId: "greeting-origin",
    stepIds: ["greeting-origin-hello"],
    focusWordIds: ["hello", "polite-male", "polite-female-statement"],
  },
  {
    lessonId: "first-consonants",
    title: "「ありがとう」を伝えよう",
    objective: "お願いを受けてもらった相手へ、お礼を伝える。",
    context:
      "カフェで水をお願いすると、店員が受けてくれました。その返事を聞いて、お礼を伝える場面です。",
    scenarioId: "cafe-water",
    stepIds: ["cafe-water-thanks"],
    focusWordIds: ["thank-you", "can", "polite-male"],
  },
  {
    lessonId: "breath-and-sounds",
    title: "水をお願いしてみよう",
    objective: "カフェで、水が欲しいと丁寧に伝える。",
    context:
      "カフェの店員に挨拶されました。飲みたい水をお願いしてみましょう。料金や量を指定する場面ではありません。",
    scenarioId: "cafe-water",
    stepIds: ["cafe-water-order"],
    focusWordIds: ["request", "water", "polite-female-statement"],
  },
  {
    lessonId: "vowel-length",
    title: "「どういたしまして」と返そう",
    objective: "お礼を言われた場面で、短く応じる。",
    context:
      "宿の受付でのやり取りを終え、相手がお礼を言ってくれました。ここではお礼への返答として練習します。",
    scenarioId: "greeting-origin",
    stepIds: ["greeting-origin-close"],
    focusWordIds: ["thank-you", "never-mind", "polite-female-statement"],
  },
  {
    lessonId: "syllable-endings",
    title: "「日本から来ました」と伝えよう",
    objective: "どこから来たか尋ねられ、日本から来たと答える。",
    context:
      "宿の受付で、どこから来たのか尋ねられました。この台本では日本から来た旅行者として答えます。",
    scenarioId: "greeting-origin",
    stepIds: ["greeting-origin-from"],
    focusWordIds: ["come", "from", "japan", "which-place"],
  },
  {
    lessonId: "five-tones",
    title: "はじめの挨拶をつなげよう",
    objective: "挨拶、来た場所、お礼への返答を続けて使う。",
    context:
      "宿の受付で、これまで出会った表現をつなげます。氏名やチェックイン手続全体の練習ではありません。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["hello", "come", "japan", "never-mind"],
  },
  {
    lessonId: "mid-consonants",
    title: "お願いから、お礼まで",
    objective: "水をお願いし、受けてもらったらお礼を言う。",
    context: "カフェで、水のお願いとその返事、お礼を続けて練習します。",
    scenarioId: "cafe-water",
    stepIds: ["cafe-water-order", "cafe-water-thanks"],
    focusWordIds: ["request", "water", "thank-you", "can"],
  },
  {
    lessonId: "high-consonants",
    title: "コーヒーを丁寧に断ろう",
    objective: "勧められたコーヒーを、丁寧に断る。",
    context:
      "水をお願いしたあと、店員がコーヒーを勧めています。ここでは追加の飲み物を受けない目標です。",
    scenarioId: "cafe-water",
    stepIds: ["cafe-water-decline"],
    focusWordIds: ["coffee", "receive", "not", "question-particle"],
  },
  {
    lessonId: "low-pairs-one",
    title: "カフェのやり取りをつなげよう",
    objective: "水を頼み、コーヒーを断り、お礼を伝える。",
    context: "カフェで出会った短い返答を、ひと続きの台本で使ってみましょう。",
    scenarioId: "cafe-water",
    stepIds: [...cafeSteps],
    focusWordIds: ["request", "water", "not", "thank-you"],
  },
  {
    lessonId: "low-pairs-two",
    title: "「値段はいくら？」と聞こう",
    objective: "指さした商品の値段を尋ねる。",
    context:
      "店で商品を指さしています。何の商品かは相手にも伝わっている場面で、値段を聞きます。",
    scenarioId: "shopping-price",
    stepIds: ["shopping-price-ask"],
    focusWordIds: ["price", "how-much", "polite-female-question"],
  },
  {
    lessonId: "low-sonorants",
    title: "「これをください」と選ぼう",
    objective: "値段を聞いた商品を買うと伝える。",
    context:
      "指さした商品の値段を聞くと、店員が20バーツと答えてくれました。その商品を選ぶ場面です。20バーツは台本上の例です。",
    scenarioId: "shopping-price",
    stepIds: ["shopping-price-buy"],
    focusWordIds: ["twenty", "baht", "take", "not"],
  },
  {
    lessonId: "vowels-central",
    title: "買い物の会話をつなげよう",
    objective: "値段を聞き、商品を選び、会計後にお礼を言う。",
    context:
      "指さした商品を買う、店での台本を練習します。最後のやり取りは会計を済ませた場面です。",
    scenarioId: "shopping-price",
    stepIds: [...shoppingSteps],
    focusWordIds: ["price", "how-much", "take", "thank-you"],
  },
  {
    lessonId: "vowels-surround",
    title: "「トイレはどこ？」と尋ねよう",
    objective: "案内の人に、トイレの場所を尋ねる。",
    context:
      "建物の中で、案内の人にトイレの場所を尋ねます。まずは質問を表現のまとまりで使ってみましょう。",
    scenarioId: "restroom-directions",
    stepIds: ["restroom-directions-ask"],
    focusWordIds: ["restroom", "stay", "where", "polite-female-question"],
  },
  {
    lessonId: "vowel-compounds",
    title: "「右ですね」と確かめよう",
    objective: "案内された方向を聞き返し、お礼を伝える。",
    context:
      "トイレの場所を尋ねたあと、案内の人が右だと教えてくれました。方向を確かめ、お礼を言う場面です。",
    scenarioId: "restroom-directions",
    stepIds: ["restroom-directions-confirm", "restroom-directions-thanks"],
    focusWordIds: ["way", "right", "yes", "thank-you"],
  },
  {
    lessonId: "syllable-parts",
    title: "場所を聞いて、お礼まで",
    objective: "トイレの場所を尋ね、右と確認してお礼を言う。",
    context:
      "案内の人との会話を、これまでの表現でひと続きに練習します。実際の地図や細かな経路を示すものではありません。",
    scenarioId: "restroom-directions",
    stepIds: [...directionsSteps],
    focusWordIds: ["restroom", "where", "right", "thank-you"],
  },
  {
    lessonId: "live-dead-syllables",
    title: "カフェでもう一度、伝えよう",
    objective: "既習のお願い・断り・お礼を思い出して使う。",
    context:
      "カフェでもう一度、水をお願いしてみましょう。追加の飲み物を断り、最後にお礼を伝えます。",
    scenarioId: "cafe-water",
    stepIds: [...cafeSteps],
    focusWordIds: ["water", "coffee", "not", "thank-you"],
  },
  {
    lessonId: "unmarked-tone-rules",
    title: "挨拶と出身をもう一度",
    objective: "既習の挨拶と、日本から来たという返答を復習する。",
    context:
      "宿の受付での短い会話を、もう一度練習します。ここでは返答の意味を確認します。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["hello", "from", "japan", "never-mind"],
  },
  {
    lessonId: "low-dead-length",
    title: "値段を聞いて選ぶ会話を復習",
    objective: "既習の買い物の表現を、台本の中で使い直す。",
    context:
      "商品を指さして値段を聞き、20バーツという返事を受けて買う場面を復習します。",
    scenarioId: "shopping-price",
    stepIds: [...shoppingSteps],
    focusWordIds: ["price", "twenty", "baht", "take"],
  },
  {
    lessonId: "tone-marks",
    title: "お願いとお礼を思い出そう",
    objective: "カフェの既習表現を復習し、場面に合う返答を選ぶ。",
    context:
      "水を頼むカフェの台本です。声調記号の知識だけで選ばず、伝えたい内容も確かめましょう。",
    scenarioId: "cafe-water",
    stepIds: [...cafeSteps],
    focusWordIds: ["request", "water", "receive", "thank-you"],
  },
  {
    lessonId: "onset-and-exceptions",
    title: "場所と方向を、もう一度",
    objective: "既習の場所の質問・方向の確認・お礼を復習する。",
    context: "案内の人にトイレの場所を聞く台本を、繰り返し使います。",
    scenarioId: "restroom-directions",
    stepIds: [...directionsSteps],
    focusWordIds: ["restroom", "where", "right", "yes"],
  },
  {
    lessonId: "sound-contrasts",
    title: "挨拶から会話を続けよう",
    objective: "挨拶・来た場所・お礼への返答を思い出す。",
    context:
      "宿の受付での既習会話を復習します。相手の挨拶をきっかけに、やり取りを続けてみましょう。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["hello", "come", "from", "never-mind"],
  },
  {
    lessonId: "tone-reading-review",
    title: "買い物で使った表現を復習",
    objective: "既習の値段の質問、選ぶ意思、お礼を使い直す。",
    context:
      "店での短い台本を復習します。文字の読みと、会話で伝える意味をそれぞれ確かめましょう。",
    scenarioId: "shopping-price",
    stepIds: [...shoppingSteps],
    focusWordIds: ["price", "how-much", "take", "thank-you"],
  },
  {
    lessonId: "basic-word-order",
    title: "日本から来たことを伝えよう",
    objective: "既習の挨拶と出身の会話を、もう一度つなげる。",
    context:
      "宿の受付の台本を復習します。表現のまとまりで出会った返答と、文のしくみの学習を行き来しましょう。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["i-male", "come", "from", "japan"],
  },
  {
    lessonId: "pronouns-politeness",
    title: "丁寧な返答を選んでみよう",
    objective: "登録された丁寧な挨拶・出身の返答例を復習する。",
    context:
      "宿の受付での会話です。この教材にある複数の話し方を試せます。性別の登録や話し方の固定はしません。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["i-male", "you", "polite-male", "polite-female-statement"],
  },
  {
    lessonId: "predicates-negation",
    title: "要らないときも、丁寧に",
    objective: "水を頼み、追加のコーヒーを断る既習会話を復習する。",
    context:
      "カフェで水を頼む台本です。勧められたコーヒーは受けないという目標で返答します。",
    scenarioId: "cafe-water",
    stepIds: [...cafeSteps],
    focusWordIds: ["not", "receive", "coffee", "thank-you"],
  },
  {
    lessonId: "basic-questions",
    title: "場所を聞き、方向を確かめよう",
    objective: "既習の場所の質問と、右かどうかの確認を復習する。",
    context: "案内の人にトイレの場所を尋ねる台本を使います。",
    scenarioId: "restroom-directions",
    stepIds: [...directionsSteps],
    focusWordIds: ["where", "yes", "question-particle", "right"],
  },
  {
    lessonId: "numbers-classifiers",
    title: "20バーツの買い物を復習",
    objective: "台本の値段を受けて商品を選び、お礼を言う。",
    context:
      "商品が20バーツという既習の台本です。商品を選ぶところから、会計後のお礼までをもう一度たどります。",
    scenarioId: "shopping-price",
    stepIds: [...shoppingSteps],
    focusWordIds: ["twenty", "baht", "take", "thank-you"],
  },
  {
    lessonId: "time-aspect",
    title: "出身を伝える会話を復習",
    objective: "以前に学んだ挨拶と出身の返答を思い出して使う。",
    context:
      "宿の受付で、以前に出会った挨拶と出身のやり取りをもう一度使ってみましょう。",
    scenarioId: "greeting-origin",
    stepIds: [...greetingSteps],
    focusWordIds: ["hello", "come", "japan", "never-mind"],
  },
  {
    lessonId: "requests-modals",
    title: "水のお願いから、お礼まで",
    objective: "既習の依頼・断り・お礼を、会話の流れで復習する。",
    context:
      "カフェで水を頼む台本を使います。追加のコーヒーを断り、依頼を受けてもらったお礼を伝えます。",
    scenarioId: "cafe-water",
    stepIds: [...cafeSteps],
    focusWordIds: ["request", "water", "not", "thank-you"],
  },
  {
    lessonId: "comparisons-connectors",
    title: "場所と方向の会話を復習",
    objective: "以前に学んだ場所の質問・聞き返し・お礼を使い直す。",
    context:
      "案内の人に場所と方向を尋ねる、これまでの会話をつなげてみましょう。最後はお礼を伝えます。",
    scenarioId: "restroom-directions",
    stepIds: [...directionsSteps],
    focusWordIds: ["restroom", "right", "yes", "thank-you"],
  },
];

export function getCourseConversation(
  lessonId: string,
): CourseConversationUnit | undefined {
  return courseConversationUnits.find((unit) => unit.lessonId === lessonId);
}

export function getCourseConversationScenario(
  unit: CourseConversationUnit,
): ConversationScenario | undefined {
  return conversationScenarios.find(
    (scenario) => scenario.id === unit.scenarioId,
  );
}

/** 参照が壊れた場合は部分的な会話へ縮めず、空の結果として呼出元へ返す。 */
export function getCourseConversationSteps(
  unit: CourseConversationUnit,
): ConversationStep[] {
  const scenario = getCourseConversationScenario(unit);
  if (
    !scenario ||
    unit.stepIds.length === 0 ||
    new Set(unit.stepIds).size !== unit.stepIds.length
  )
    return [];
  const steps = unit.stepIds.map((id) =>
    scenario.steps.find((step) => step.id === id),
  );
  if (steps.some((step) => step === undefined)) return [];
  return steps.filter((step): step is ConversationStep => step !== undefined);
}

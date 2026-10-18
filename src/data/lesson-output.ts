import { getCourseLesson } from "@/data/course";
import { syllableEntries } from "@/data/syllables";

/** 任意練習用。既存Lessonの採点・前提・XPには加算しない。 */
export interface LessonOutputTask {
  id: string;
  lessonId: string;
  prompt: string;
  target: string;
  ipa: string;
  meaning: string;
  acceptedAnswers: readonly string[];
  explanation: string;
  hint: string;
  sourceIds: string[];
  verification: "unreviewed";
}

function outputTask(
  input: Omit<
    LessonOutputTask,
    "id" | "acceptedAnswers" | "sourceIds" | "verification"
  >,
): LessonOutputTask {
  const lesson = getCourseLesson(input.lessonId);
  if (!lesson)
    throw new Error(`出力練習のレッスンがありません: ${input.lessonId}`);
  const entry = syllableEntries.find(
    (syllable) => syllable.thai === input.target,
  );
  return {
    ...input,
    id: `${input.lessonId}-output`,
    acceptedAnswers: [input.target],
    sourceIds: [...new Set([...lesson.sourceIds, ...(entry?.sourceIds ?? [])])],
    verification: "unreviewed",
  };
}

/**
 * 各レッスンで扱う語、または前提で学んだ語を思い出して書く練習。
 * 問題文・ヒントに正答のThai文字列を含めず、回答後に理由を示す。
 * 正しい綴りの確認と、発音の正しさの評価は別に扱う。
 */
export const lessonOutputTasks: LessonOutputTask[] = [
  outputTask({
    lessonId: "sounds-and-letters",
    prompt: "「来る」を意味する、最初に学んだ語をタイ文字で入力してください。",
    target: "มา",
    ipa: "/maː˧/",
    meaning: "来る",
    hint: "唇を閉じて出す /m/ の子音に、右側へ書く長母音 /aː/ を足します。",
    explanation:
      "ม は初頭音 /m/、า は長母音 /aː/ です。この2つを組み合わせた語が『来る』を表します。声調は中平調で、母音の長さと高さを別々に意識します。",
  }),
  outputTask({
    lessonId: "first-consonants",
    prompt: "「カラス」を意味する語をタイ文字で入力してください。",
    target: "กา",
    ipa: "/kaː˧/",
    meaning: "カラス",
    hint: "初頭は強い息を伴わない /k/。母音は長い /aː/ です。",
    explanation:
      "ก の初頭音 /k/ と長母音 า を組み合わせます。『来る』の ม とは初頭の字も音も異なります。声調は中平調です。",
  }),
  outputTask({
    lessonId: "breath-and-sounds",
    prompt:
      "このレッスンで比較した「脚・足」の語を、タイ文字で入力してください。",
    target: "ขา",
    ipa: "/kʰaː˩˩˦/",
    meaning: "脚・足",
    hint: "息を伴う /kʰ/ の字のうち、高子音に分類される字を使います。",
    explanation:
      "ข は有気音 /kʰ/ を表す高子音、า は長母音 /aː/ です。ค も /kʰ/ を表しますが低子音で、同じ母音を付けた語の読み・意味が異なります。この語は上昇調です。",
  }),
  outputTask({
    lessonId: "vowel-length",
    prompt: "「見る」を意味する、長い /uː/ の語をタイ文字で入力してください。",
    target: "ดู",
    ipa: "/duː˧/",
    meaning: "見る",
    hint: "初頭は /d/。長い母音記号を子音の下に書きます。",
    explanation:
      "ด に、下に書く長母音 ู を組み合わせます。短い ุ を使う『厳しい・叱る』の語とは、長さだけでなく声調も異なります。ここは /duː˧/『見る』です。",
  }),
  outputTask({
    lessonId: "syllable-endings",
    prompt: "末子音 /n/ を持つ「皿」の語を、タイ文字で入力してください。",
    target: "จาน",
    ipa: "/tɕaːn˧/",
    meaning: "皿",
    hint: "初頭 /tɕ/、長母音 /aː/、末子音 /n/ の順です。",
    explanation:
      "จ が初頭 /tɕ/、า が長母音 /aː/、น が末子音 /n/ を表します。末尾に日本語の『ヌ』の母音を足さず、1音節として読みます。声調は中平調です。",
  }),
  outputTask({
    lessonId: "five-tones",
    prompt:
      "前のレッスンで学んだ「かす・残りかす」の語を、タイ文字で入力してください。",
    target: "กาก",
    ipa: "/kaːk̚˨˩/",
    meaning: "かす・残りかす",
    hint: "無気音 /k/ で始まり、長母音の後も /k̚/ で閉じます。声調記号は書きません。",
    explanation:
      "ก を初頭と末尾の両方に使い、間に長母音 า を置きます。末尾は破裂させない /k̚/、声調は低調です。声調記号がなくても声調はあり、無記号がすべて中平調になるわけではありません。",
  }),
  outputTask({
    lessonId: "mid-consonants",
    prompt:
      "このレッスンで学んだ「投げる」の語を、タイ文字で入力してください。",
    target: "ปา",
    ipa: "/paː˧/",
    meaning: "投げる",
    hint: "両唇を閉じて出す、無声・無気の /p/ の字を使います。",
    explanation:
      "ป は中子音で、初頭音は無声・無気の /p/。有声の บ /b/ や、有気音 /pʰ/ の字と区別します。長母音 า を組み合わせた中平調の語です。",
  }),
  outputTask({
    lessonId: "high-consonants",
    prompt: "「色」を意味する語を、タイ文字で入力してください。",
    target: "สี",
    ipa: "/siː˩˩˦/",
    meaning: "色",
    hint: "/s/ を表す高子音のうち、この語で学んだ字に、長い /iː/ を上へ書きます。",
    explanation:
      "この語の綴りでは高子音 ส と長母音 ี を使います。ศ・ษ も基本初頭音 /s/ を表しますが、同じ音だからといって単語の字を自由に入れ替えることはできません。読みは上昇調です。",
  }),
  outputTask({
    lessonId: "low-pairs-one",
    prompt: "「茶」を意味する語を、タイ文字で入力してください。",
    target: "ชา",
    ipa: "/tɕʰaː˧/",
    meaning: "茶",
    hint: "有気音 /tɕʰ/ を表す低子音のうち、一般的な字を使い、長母音を右へ足します。",
    explanation:
      "ช は有気音 /tɕʰ/ を表す低子音です。無気音の จ /tɕ/ と区別します。ここでは ช と長母音 า を組み合わせ、中平調で『茶』を表します。",
  }),
  outputTask({
    lessonId: "low-pairs-two",
    prompt:
      "このレッスンの「連れていく・連れてくる」の語を、タイ文字で入力してください。",
    target: "พา",
    ipa: "/pʰaː˧/",
    meaning: "連れていく・連れてくる",
    hint: "有気音 /pʰ/ の低子音に、長い /aː/ を足します。『投げる』の無気音とは別の字です。",
    explanation:
      "พ は有気音 /pʰ/ の低子音、า は長母音です。中平調で読みます。無気音の ป を使った『投げる』とは、初頭の息と単語の意味が違います。",
  }),
  outputTask({
    lessonId: "low-sonorants",
    prompt: "「猿」を意味する語を、タイ文字で入力してください。",
    target: "ลิง",
    ipa: "/liŋ˧/",
    meaning: "猿",
    hint: "初頭 /l/、上に書く短い /i/、末子音 /ŋ/ の順です。",
    explanation:
      "ล は初頭 /l/、ิ は短母音 /i/、ง は末子音 /ŋ/ です。/ŋ/ の後に必ず /g/ を付け足すわけではありません。鼻音で終わる中平調の語です。",
  }),
  outputTask({
    lessonId: "vowels-central",
    prompt: "「手」を意味する、長い /ɯː/ の語をタイ文字で入力してください。",
    target: "มือ",
    ipa: "/mɯː˧/",
    meaning: "手",
    hint: "初頭は /m/。末子音字のない長い /ɯː/ の綴りでは、上の記号に加えて右側にも字が現れます。",
    explanation:
      "ม と長母音の基本形 -ือ を組み合わせます。ここで อ は独立した音節を増やす字ではなく、母音綴りの一部です。唇を丸めない長母音 /ɯː/ と中平調を確認します。",
  }),
  outputTask({
    lessonId: "vowels-surround",
    prompt:
      "「大きい・成長する」を意味する、長い /oː/ の語をタイ文字で入力してください。",
    target: "โต",
    ipa: "/toː˧/",
    meaning: "大きい・成長する",
    hint: "無気音 /t/ の字より前に、長い /oː/ の母音記号を書きます。",
    explanation:
      "โ を ต の前に書きますが、発音の順は初頭 /t/ の後に長母音 /oː/ です。母音が前に見えても先に発音するわけではなく、全体で中平調の1音節になります。",
  }),
  outputTask({
    lessonId: "vowel-compounds",
    prompt:
      "「舟」を意味する、二重母音 /ɯːa/ の語をタイ文字で入力してください。",
    target: "เรือ",
    ipa: "/rɯːa˧/",
    meaning: "舟",
    hint: "初頭は /r/。母音は子音の前・上・右にまたがる一組の綴りです。",
    explanation:
      "ร と母音の基本形 เ-ือ を組み合わせます。前後や上の記号を別々の音節にせず、長い二重母音 /ɯːa/ として読みます。全体で1音節・中平調です。",
  }),
  outputTask({
    lessonId: "syllable-parts",
    prompt:
      "初頭に子音連続 /pl/ を持つ「魚」の語を、タイ文字で入力してください。",
    target: "ปลา",
    ipa: "/plaː˧/",
    meaning: "魚",
    hint: "無気音 /p/ と /l/ が同じ音節の始まりを作り、長母音 /aː/ が続きます。",
    explanation:
      "ป と ล が初頭の子音連続 /pl/、า が長母音です。ล を末子音として分けず、音節の始まりへまとめます。発音上の末子音はなく、1音節の中平調の語です。",
  }),
  outputTask({
    lessonId: "live-dead-syllables",
    prompt:
      "母音の綴りに末尾 /j/ を含む「心」の語を、タイ文字で入力してください。",
    target: "ใจ",
    ipa: "/tɕaj˧/",
    meaning: "心",
    hint: "初頭は無気音 /tɕ/。/aj/ の2種類の綴りのうち、この語で学んだ方を前に書きます。",
    explanation:
      "この語は ใ を จ の前に書きます。ใ の読み /aj/ に末尾 /j/ が含まれるため、末子音字が見えなくても生音節です。中子音・生・無記号なので中平調になります。",
  }),
  outputTask({
    lessonId: "unmarked-tone-rules",
    prompt: "高子音で始まる「掘る」の語を、タイ文字で入力してください。",
    target: "ขุด",
    ipa: "/kʰut̚˨˩/",
    meaning: "掘る",
    hint: "有気音 /kʰ/ の高子音、下に書く短い /u/、末尾 /t̚/。声調記号は不要です。",
    explanation:
      "初頭 ข が高子音、ุ が短母音、末尾 ด が /t̚/ を表します。閉鎖音で終わる死音節・無記号なので低調です。末尾 ด の中子音クラスを、初頭の代わりに使いません。",
  }),
  outputTask({
    lessonId: "low-dead-length",
    prompt:
      "低子音・短母音の死音節になる「愛する」の語を、タイ文字で入力してください。",
    target: "รัก",
    ipa: "/rak̚˦˥/",
    meaning: "愛する",
    hint: "初頭 /r/、上に書く短い /a/、末子音 /k̚/。声調記号は書きません。",
    explanation:
      "ร は低子音、ั は閉音節の短い /a/、末尾 ก は /k̚/ です。低子音の死音節・短母音・無記号なので高調です。母音が長い低子音死音節の下降調と区別します。",
  }),
  outputTask({
    lessonId: "tone-marks",
    prompt:
      "「おば・年長の女性への呼びかけ」を表す、下降調の語をタイ文字で入力してください。",
    target: "ป้า",
    ipa: "/paː˥˩/",
    meaning: "おば・年長の女性への呼びかけ",
    hint: "中子音の無気音 /p/ に長母音を組み合わせ、マイトーを付けます。",
    explanation:
      "ป は中子音で、้（マイトー）により下降調になります。่（マイエーク）を使う『森』とは別の綴り・声調です。記号ありの規則を使い、無記号の生音節の表へ進みません。",
  }),
  outputTask({
    lessonId: "onset-and-exceptions",
    prompt: "ห นำを使う「ネズミ」の語を、タイ文字で入力してください。",
    target: "หนู",
    ipa: "/nuː˩˩˦/",
    meaning: "ネズミ",
    hint: "発音の初頭は /n/、母音は長い /uː/。声調のクラスを変える、発音しない先行子音を忘れずに。",
    explanation:
      "น に先行する ห により、有効クラスは高になります。ห を別音節の /h/ とせず、初頭 /n/ と長母音 /uː/ で読みます。高・生・無記号なので上昇調です。",
  }),
  outputTask({
    lessonId: "sound-contrasts",
    prompt:
      "短い /a/ を持つ「水くみ用の鉢」の語を、タイ文字で入力してください。",
    target: "ขัน",
    ipa: "/kʰan˩˩˦/",
    meaning: "水くみ用の鉢",
    hint: "有気音 /kʰ/ の高子音、閉音節の短い /a/、末子音 /n/ の順です。",
    explanation:
      "ข と短母音 ั、末子音 น を組み合わせます。/n/ 終わりの生音節・高子音・無記号なので上昇調です。長い /aː/ を持つ『呼びかけに応じる』の語とは、母音長と綴りが異なります。",
  }),
  outputTask({
    lessonId: "tone-reading-review",
    prompt:
      "限定的な อ นำを使う「〜しないで」の語を、タイ文字で入力してください。",
    target: "อย่า",
    ipa: "/jaː˨˩/",
    meaning: "〜しないで",
    hint: "発音の初頭は /j/ ですが、中子音の規則で扱う先行子音があります。記号はマイエークです。",
    explanation:
      "限定的な อ นำ の語で、ย の音節を中子音の規則で扱います。่（マイエーク）があるので低調です。先頭の อ は独立した別音節にせず、この型をすべての อ 始まりへ一般化しません。",
  }),
];

export function getLessonOutputTask(lessonId: string) {
  return lessonOutputTasks.find((task) => task.lessonId === lessonId);
}

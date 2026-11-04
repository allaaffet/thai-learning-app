import { describe, expect, it } from "vitest";
import { conversationSources, conversationWords } from "@/data/conversations";
import { languageSources, vocabularyEntries } from "@/data/language";
import {
  ROMANCE_DIALOGUE_CURRICULUM_ID,
  getRomanceDialogueQuestions,
  romanceDialogueSources,
  romanceDialogueWords,
} from "@/data/romance-dialogue";
import type { RomanceEpisodeId } from "@/lib/romance-types";

const episodes: RomanceEpisodeId[] = [
  "meet",
  "cafe",
  "likes",
  "market",
  "walk",
];
const words = new Map(romanceDialogueWords.map((word) => [word.id, word]));

/** NPC本文・女性疑問の区別・プレイヤーの返答。物語で使う15ターンの内容契約。 */
const turns: Record<
  RomanceEpisodeId,
  [npc: string, question: boolean, reply: string][]
> = {
  meet: [
    ["สวัสดี", false, "สวัสดี"],
    ["คุยด้วยได้ไหม", true, "ได้"],
    ["ดีใจที่ได้เจอคุณ", false, "ดีใจที่ได้เจอคุณ"],
  ],
  cafe: [
    ["นั่งด้วยได้ไหม", true, "ได้"],
    ["อยากคุยกับคุณ", false, "อยากคุยกับคุณ"],
    ["ไปด้วยกันไหม", true, "ไปด้วยกัน"],
  ],
  likes: [
    ["คุณน่ารัก", false, "ขอบคุณ"],
    ["คุณชอบใคร", true, "ชอบคุณ"],
    ["คิดถึงคุณ", false, "คิดถึงคุณ"],
  ],
  market: [
    ["พรุ่งนี้ว่างไหม", true, "ว่าง"],
    ["ไปด้วยกันไหม", true, "อยากไปกับคุณ"],
    ["เจอกันพรุ่งนี้", false, "เจอกันพรุ่งนี้"],
  ],
  walk: [
    ["อยากเจอคุณอีก", false, "อยากเจอคุณอีก"],
    ["พรุ่งนี้เจอกันไหม", true, "เจอกันพรุ่งนี้"],
    ["ฝันดี", false, "ฝันดี"],
  ],
};

/**
 * 実取得TSVの16原行。CIで外部取得や /tmp へ依存させない。
 * commit f826bca74edafb281aa2bf7ecbb2ae38ec72fe63
 * G2P/wiktionary-11-2-2020.tsv, Thai Wiktionary / PyThaiNLP, CC BY-SA 3.0。
 */
const dictionaryRows: Record<string, string> = {
  กัน: "k a n ˧",
  กับ: "k a p̚ ˨˩",
  คิดถึง: "kʰ i t̚ ˦˥ . tʰ ɯ ŋ ˩˩˦",
  คุย: "kʰ u j ˧",
  ดีใจ: "d iː ˧ . t͡ɕ a j ˧",
  ด้วย: "d u a̯ j ˥˩",
  ด้วยกัน: "d u a̯ j ˥˩ . k a n ˧",
  ที่: "tʰ iː ˥˩",
  นั่ง: "n a ŋ ˥˩",
  น่ารัก: "n aː ˥˩ . r a k̚ ˦˥",
  ฝันดี: "f a n ˩˩˦ . d iː ˧",
  พรุ่งนี้: "pʰ r u ŋ ˥˩ . n iː ˦˥",
  ว่าง: "w aː ŋ ˥˩",
  อีก: "ʔ iː k̚ ˨˩",
  เจอ: "t͡ɕ ɤː ˧",
  ใคร: "kʰ r a j ˧",
};

describe("物語の中で使う恋愛会話の教材", () => {
  it("5話15問を、出会いからデートと再会の約束の順に持つ", () => {
    expect(ROMANCE_DIALOGUE_CURRICULUM_ID).toBe("romance-dialogue-2026-11");
    const all = episodes.flatMap((episode) =>
      getRomanceDialogueQuestions("female", episode),
    );
    expect(all).toHaveLength(15);
    expect(new Set(all.map((question) => question.id)).size).toBe(15);
    expect(all[2].npc.meaning).toBe("あなたに会えてうれしいです。");
    expect(
      all[7].choices
        .filter((choice) => all[7].answerIds.includes(choice.id))
        .map((choice) => choice.phrase.meaning),
    ).toEqual(["あなたが好きです。", "あなたが好きです。"]);
    expect(all[10].choices[0].phrase.meaning).toBe("あなたと行きたいです。");
    expect(all[12].choices[0].phrase.meaning).toBe(
      "またあなたに会いたいです。",
    );
    expect(all[14].choices[0].phrase.meaning).toBe("おやすみなさい。");
  });

  it.each(episodes)(
    "%s は男女双方のNPCに合う文末で、同じ意味の二つの丁寧な返答を受け付ける",
    (episode) => {
      for (const gender of ["male", "female"] as const) {
        const questions = getRomanceDialogueQuestions(gender, episode);
        expect(questions).toHaveLength(3);
        questions.forEach((question, index) => {
          const [npc, isQuestion, reply] = turns[episode][index];
          expect(question.npc.thai).toBe(
            npc + (gender === "male" ? "ครับ" : isQuestion ? "คะ" : "ค่ะ"),
          );
          expect(question.answerIds).toHaveLength(2);
          expect(new Set(question.answerIds).size).toBe(2);
          const accepted = question.choices.filter((choice) =>
            question.answerIds.includes(choice.id),
          );
          expect(accepted.map((choice) => choice.phrase.thai)).toEqual([
            reply + "ครับ",
            reply + "ค่ะ",
          ]);
          expect(accepted[0].phrase.meaning).toBe(accepted[1].phrase.meaning);
          expect(
            new Set(question.choices.map((choice) => choice.id)).size,
          ).toBe(question.choices.length);
          expect(
            new Set(question.choices.map((choice) => choice.phrase.thai)).size,
          ).toBe(question.choices.length);
          const other = question.choices.filter(
            (choice) => !question.answerIds.includes(choice.id),
          );
          expect(other.length).toBeGreaterThan(0);
          for (const choice of other)
            expect(choice.explanation.length).toBeGreaterThan(15);
        });
      }
    },
  );

  it("登録された52語だけを原順序で組み立て、別教材のトイレや買物の台詞を出さない", () => {
    expect(romanceDialogueWords).toHaveLength(52);
    expect(words.size).toBe(52);
    const sourceIds = new Set(
      [
        ...conversationSources,
        ...languageSources,
        ...romanceDialogueSources,
      ].map((source) => source.id),
    );
    const unrelated = new Set([
      "restroom",
      "where",
      "right",
      "left",
      "price",
      "how-much",
      "twenty",
      "baht",
      "water",
      "coffee",
      "receive",
      "take",
      "japan",
      "cat",
    ]);
    for (const episode of episodes) {
      for (const question of getRomanceDialogueQuestions("female", episode)) {
        const phrases = [
          question.npc,
          ...question.choices.map((choice) => choice.phrase),
        ];
        for (const phrase of phrases) {
          expect(phrase.wordIds.length).toBeGreaterThan(0);
          expect(phrase.wordIds.every((id) => words.has(id))).toBe(true);
          expect(phrase.wordIds.some((id) => unrelated.has(id))).toBe(false);
          expect(phrase.thai).toBe(
            phrase.wordIds.map((id) => words.get(id)!.thai).join(""),
          );
          expect(phrase.meaning.length).toBeGreaterThan(0);
          expect(Object.hasOwn(phrase, "ipa")).toBe(false);
        }
        const expectedSources = new Set(
          phrases
            .flatMap((phrase) => phrase.wordIds)
            .flatMap((id) => words.get(id)!.sourceIds),
        );
        expect(new Set(question.sourceIds)).toEqual(expectedSources);
        expect(question.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
        expect(question.verification).toBe("unreviewed");
        expect(question.sourceNote).toContain("専門家監修前");
        expect(question.goal.length).toBeGreaterThan(8);
        expect(question.explanation.length).toBeGreaterThan(15);
      }
    }
  });

  it("追加16語の辞書形IPAを実取得した原行と照合し、全文の監修とは扱わない", () => {
    const added = romanceDialogueWords.filter((word) =>
      word.id.startsWith("romance-"),
    );
    expect(added).toHaveLength(16);
    expect(new Set(added.map((word) => word.thai))).toEqual(
      new Set(Object.keys(dictionaryRows)),
    );
    for (const word of added) {
      const ipa = dictionaryRows[word.thai]
        .replaceAll(" ", "")
        .replaceAll("t͡ɕ", "tɕ");
      expect(word.ipa).toBe("/" + ipa + "/");
      expect(word.sourceIds).toContain("wiktionary-ipa-romance-dialogue");
      expect(word.verification).toBe("unreviewed");
    }
    // この5語の今回の語義は、取得した語義辞書で照合できなかった。
    for (const thai of ["ที่", "กับ", "กัน", "ด้วยกัน", "ฝันดี"]) {
      const word = added.find((entry) => entry.thai === thai)!;
      expect(word.sourceIds).not.toContain(
        "wiktionary-meaning-romance-dialogue",
      );
    }
    for (const source of romanceDialogueSources) {
      expect(source.checkedAt).toBe("2026-11-04");
      expect(source.access).toBe("accessible");
      expect(source.scope).toMatch(/未監修|専門家監修前/u);
      expect(source.scope).toContain("CC BY-SA");
    }
  });

  it("本編40語・独立会話34語を変更せず、登録語のIPAをそのまま再利用する", () => {
    const before = JSON.stringify([conversationWords, vocabularyEntries]);
    expect(conversationWords).toHaveLength(34);
    expect(vocabularyEntries).toHaveLength(40);
    for (const source of conversationWords) {
      const copy = words.get(source.id)!;
      expect(copy).not.toBe(source);
      expect(copy.sourceIds).not.toBe(source.sourceIds);
      expect(copy.thai).toBe(source.thai);
      expect(copy.ipa).toBe(source.ipa);
      expect(copy.sourceIds).toEqual(source.sourceIds);
    }
    expect(conversationWords.find((word) => word.id === "can")!.meaning).toBe(
      "できる・よい（この会話では承諾の返答）",
    );
    for (const episode of episodes) {
      getRomanceDialogueQuestions("male", episode);
      getRomanceDialogueQuestions("female", episode);
    }
    expect(JSON.stringify([conversationWords, vocabularyEntries])).toBe(before);
  });

  it("一度取得した問題の配列を編集しても、次の相手への教材を壊さない", () => {
    const pristine = getRomanceDialogueQuestions("female", "walk");
    const editable = getRomanceDialogueQuestions("female", "walk");
    editable[0].npc.wordIds.reverse();
    editable[0].choices[0].phrase.wordIds.push("not");
    editable[0].answerIds.pop();
    editable[1].choices.pop();
    expect(getRomanceDialogueQuestions("female", "walk")).toEqual(pristine);
  });
});

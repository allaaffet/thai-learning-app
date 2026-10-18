import { describe, expect, it } from "vitest";
import {
  getGrammarPoint,
  getVocabularyEntry,
  grammarPoints,
  languageSources,
  vocabularyCategories,
  vocabularyEntries,
} from "@/data/language";

describe("Phase 4の語彙と文法カタログ", () => {
  it("40語と8文法項目を、重複しない安定IDで参照できる", () => {
    expect(vocabularyEntries).toHaveLength(40);
    expect(grammarPoints).toHaveLength(8);
    expect(new Set(vocabularyEntries.map((entry) => entry.id)).size).toBe(40);
    expect(new Set(vocabularyEntries.map((entry) => entry.thai)).size).toBe(40);
    expect(new Set(grammarPoints.map((point) => point.id)).size).toBe(8);
    for (const entry of vocabularyEntries) {
      expect(getVocabularyEntry(entry.id)).toBe(entry);
    }
    for (const point of grammarPoints) {
      expect(getGrammarPoint(point.id)).toBe(point);
    }
    expect(getVocabularyEntry("unknown-word")).toBeUndefined();
    expect(getGrammarPoint("unknown-grammar")).toBeUndefined();
  });

  it("分類・出典の参照先が存在し、確認状態を監修済みにしない", () => {
    const sourceIds = new Set(languageSources.map((source) => source.id));
    const categoryIds = new Set(
      vocabularyCategories.map((category) => category.id),
    );
    expect(categoryIds.size).toBe(vocabularyCategories.length);
    expect(sourceIds.size).toBe(languageSources.length);
    for (const entry of vocabularyEntries) {
      expect(categoryIds.has(entry.categoryId)).toBe(true);
      expect(entry.level).toBe("A1");
      expect(entry.verification).toBe("unreviewed");
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      expect(entry.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      expect(entry.relatedLessonIds.length).toBeGreaterThan(0);
    }
    for (const point of grammarPoints) {
      expect(point.verification).toBe("unreviewed");
      expect(point.sourceIds.length).toBeGreaterThan(0);
      expect(point.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      expect(point.relatedLessonIds).toContain(point.id);
    }
    for (const source of languageSources) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.scope).toBeTruthy();
      expect(source.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("音節区切りを結合してもThaiの元の綴りと結合記号が変わらない", () => {
    for (const entry of vocabularyEntries) {
      expect(entry.syllables.join("")).toBe(entry.thai);
      expect(entry.syllables.every((part) => part.length > 0)).toBe(true);
    }
    expect(getVocabularyEntry("book")?.syllables).toEqual(["หนัง", "สือ"]);
    expect(getVocabularyEntry("ongoing")?.syllables).toEqual(["กำ", "ลัง"]);
    expect(getVocabularyEntry("what")?.syllables).toEqual(["อะ", "ไร"]);
    expect(getVocabularyEntry("polite-female-statement")?.thai).toBe("ค่ะ");
    expect(getVocabularyEntry("polite-female-question")?.thai).toBe("คะ");
  });

  it("全語に声調付きIPA・日本語の意味・その語を含む例がある", () => {
    for (const entry of vocabularyEntries) {
      expect(entry.thai).toMatch(/^[\u0e01-\u0e5b]+$/u);
      expect(entry.meaning).toBeTruthy();
      expect(entry.ipa).toMatch(/^\/.+[˧˨˩˦˥].+\/$|^\/.+[˧˨˩˦˥]\/$/u);
      expect(entry.ipa).not.toMatch(/t͡ɕ/);
      expect(entry.example.thai).toContain(entry.thai);
      expect(entry.example.meaning).toBeTruthy();
      expect(entry.example.note).toContain("監修前");
    }
  });

  it("文法の例は文字単位ではなく意味ある役割ごとに分かれ、全体の綴りと一致する", () => {
    for (const point of grammarPoints) {
      expect(point.explanation.length).toBeGreaterThanOrEqual(3);
      expect(point.examples.length).toBeGreaterThanOrEqual(2);
      expect(point.vocabularyIds.every((id) => getVocabularyEntry(id))).toBe(
        true,
      );
      for (const example of point.examples) {
        expect(example.segments.map((segment) => segment.thai).join("")).toBe(
          example.thai,
        );
        for (const segment of example.segments) {
          expect(segment.role).toBeTruthy();
          expect(
            vocabularyEntries.some((entry) => entry.thai === segment.thai),
          ).toBe(true);
        }
        expect(example.note).toContain("専門家監修前");
      }
    }
  });

  it("同じ音に見える疑問詞・否定と丁寧詞の声調を区別する", () => {
    expect(getVocabularyEntry("not")?.ipa).toBe("/maj˥˩/");
    expect(getVocabularyEntry("question-particle")?.ipa).toBe("/maj˩˩˦/");
    expect(getVocabularyEntry("polite-female-statement")?.ipa).toBe("/kʰaʔ˥˩/");
    expect(getVocabularyEntry("polite-female-question")?.ipa).toBe("/kʰaʔ˦˥/");
    expect(getVocabularyEntry("polite-female-statement")?.note).toContain(
      "変種",
    );
  });

  it("文法項目は形容詞の前のเป็น・過去形としてのแล้ว等を一律の規則にしない", () => {
    const predicates = getGrammarPoint("predicates-negation");
    const aspect = getGrammarPoint("time-aspect");
    const quantity = getGrammarPoint("numbers-classifiers");
    expect(
      predicates?.examples.some((example) => example.thai === "บ้านใหญ่"),
    ).toBe(true);
    expect(
      predicates?.examples.some((example) => example.thai === "บ้านเป็นใหญ่"),
    ).toBe(false);
    expect(aspect?.explanation.join("")).toContain(
      "過去形を全てแล้วに置き換えることはできません",
    );
    expect(quantity?.explanation.join("")).toContain("หนังสือเล่มหนึ่ง");
    expect(getVocabularyEntry("request")?.note).toContain("許可");
  });
});

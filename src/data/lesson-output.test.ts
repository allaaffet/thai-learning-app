import { describe, expect, it } from "vitest";
import { alphabetCharacters, vowelPatterns } from "./alphabet";
import { courseLessons, courseSources, getCourseLesson } from "./course";
import { getLessonOutputTask, lessonOutputTasks } from "./lesson-output";
import { syllableEntries } from "./syllables";

function learnedText(lessonId: string, seen = new Set<string>()): string {
  if (seen.has(lessonId)) return "";
  seen.add(lessonId);
  const lesson = getCourseLesson(lessonId);
  if (!lesson) throw new Error(`存在しない前提: ${lessonId}`);
  return [
    ...lesson.blocks.flatMap((block) => [
      ...block.paragraphs,
      ...(block.examples ?? []).map((example) => example.thai),
    ]),
    ...lesson.explore.flatMap((example) => [example.thai, example.note]),
    ...lesson.prerequisites.map((id) => learnedText(id, seen)),
  ].join("\n");
}

describe("各レッスンの任意の文字入力練習", () => {
  it("全22レッスンを一度ずつ対象にし、未登録のIDには問題を返さない", () => {
    expect(lessonOutputTasks).toHaveLength(22);
    expect(lessonOutputTasks.map((task) => task.lessonId)).toEqual(
      courseLessons.map((lesson) => lesson.id),
    );
    expect(new Set(lessonOutputTasks.map((task) => task.id)).size).toBe(22);
    expect(getLessonOutputTask("not-a-lesson")).toBeUndefined();
    expect(getLessonOutputTask("sounds-and-letters")?.target).toBe("มา");
    expect(getLessonOutputTask("tone-reading-review")?.target).toBe("อย่า");
  });

  it("未学習の語や比較用の架空音節を要求せず、Learn・Exploreか前提に出てくる語を使う", () => {
    for (const task of lessonOutputTasks) {
      expect(learnedText(task.lessonId), task.id).toContain(task.target);
      expect(task.target, task.id).toMatch(/^[\u0e01-\u0e3a\u0e40-\u0e4e]+$/u);
      expect(task.target, task.id).not.toMatch(/[◌/\-\s]/u);
      expect(task.meaning, task.id).not.toMatch(/比較用|練習用音節/u);
      expect(task.acceptedAnswers, task.id).toContain(task.target);
    }
  });

  it("答えを問題文・ヒントへ先に表示せず、正答後には綴りと音の理由を持つ", () => {
    for (const task of lessonOutputTasks) {
      expect(task.prompt, task.id).not.toContain(task.target);
      expect(task.hint, task.id).not.toContain(task.target);
      expect(task.prompt.trim().length).toBeGreaterThan(10);
      expect(task.hint.trim().length).toBeGreaterThan(10);
      expect(task.explanation.trim().length).toBeGreaterThan(30);
      expect(task.ipa, task.id).toMatch(/^\/.+\/$/u);
      expect(task.meaning.trim().length).toBeGreaterThan(0);
    }
  });

  it("同じ単語を掲載する音節辞書・文字例・母音例とIPAを矛盾させない", () => {
    const referenceExamples = [
      ...syllableEntries,
      ...alphabetCharacters.map((character) => character.example),
      ...vowelPatterns.map((vowel) => vowel.example),
    ];
    for (const task of lessonOutputTasks) {
      const references = referenceExamples.filter(
        (entry) => entry.thai === task.target,
      );
      if (references.length > 0) {
        expect(new Set(references.map((entry) => entry.ipa)), task.id).toEqual(
          new Set([task.ipa]),
        );
      }
    }
  });

  it("出典は実在する参照に限定し、綴りの正解を専門家監修や発音採点と混同しない", () => {
    for (const task of lessonOutputTasks) {
      expect(task.verification).toBe("unreviewed");
      expect(task.sourceIds.length).toBeGreaterThan(0);
      expect(new Set(task.sourceIds).size).toBe(task.sourceIds.length);
      for (const sourceId of task.sourceIds) {
        expect(
          courseSources.some((source) => source.id === sourceId),
          task.id,
        ).toBe(true);
      }
      expect(task).not.toHaveProperty("xp");
      expect(task).not.toHaveProperty("prerequisites");
    }
  });
});

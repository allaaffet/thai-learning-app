import { describe, expect, it } from "vitest";
import type { Exercise } from "@/lib/content-types";
import {
  gradeExercise,
  INCORRECT_INPUT_ID,
  type ExerciseResponse,
} from "@/lib/exercise-grading";

const base = {
  id: "grammar-test",
  prompt: "練習問題",
  options: [
    { id: "answer", label: "ฉันกินข้าว" },
    { id: "other", label: "別の答え" },
  ],
  answerId: "answer",
  explanation: "主語・動詞・目的語の順番です。",
  relatedConcepts: ["語順"],
  difficulty: 1 as const,
};

const choice: Exercise = { ...base, type: "multiple-choice" };
const text: Exercise = {
  ...base,
  type: "fill-in-the-blank",
  acceptedAnswers: ["กิน", "ทาน"],
};
const ordering: Exercise = {
  ...base,
  type: "word-ordering",
  tokens: [
    { id: "rice", label: "ข้าว" },
    { id: "i", label: "ฉัน" },
    { id: "eat", label: "กิน" },
  ],
  answerOrder: ["i", "eat", "rice"],
};

describe("gradeExercise", () => {
  it("既存の選択式は正答・誤答とも選択肢IDを維持する", () => {
    expect(
      gradeExercise(choice, { type: "option", optionId: "answer" }),
    ).toEqual({ correct: true, selectedOptionId: "answer" });
    expect(
      gradeExercise(choice, { type: "option", optionId: "other" }),
    ).toEqual({ correct: false, selectedOptionId: "other" });
  });

  it("文字識別の採点も変えない", () => {
    expect(
      gradeExercise(
        { ...base, type: "character-recognition" },
        { type: "option", optionId: "answer" },
      ),
    ).toEqual({ correct: true, selectedOptionId: "answer" });
  });

  it("存在しない選択肢と形式違いを採点しない", () => {
    expect(
      gradeExercise(choice, { type: "option", optionId: "injected" }),
    ).toBeUndefined();
    expect(
      gradeExercise(choice, { type: "text", text: "answer" }),
    ).toBeUndefined();
  });

  it("空欄は前後の空白のみ無視し、登録済み別解も受け付ける", () => {
    for (const answer of ["กิน", "  กิน\n", "ทาน"]) {
      expect(gradeExercise(text, { type: "text", text: answer })).toEqual({
        correct: true,
        selectedOptionId: "answer",
      });
    }
  });

  it("誤った空欄は固定IDのみを返し、生文字を保存対象に含めない", () => {
    const input = "ไม่ถูกต้อง";
    const result = gradeExercise(text, { type: "text", text: input });
    expect(result).toEqual({
      correct: false,
      selectedOptionId: INCORRECT_INPUT_ID,
    });
    expect(JSON.stringify(result)).not.toContain(input);
  });

  it("Unicode正規化や結合文字の並べ替え、語中空白の除去をしない", () => {
    const marked: Exercise = {
      ...base,
      type: "fill-in-the-blank",
      acceptedAnswers: ["กี่", "กำ"],
    };
    for (const answer of ["ก่ี", "กี", "กํา", "ก ี่"]) {
      expect(
        gradeExercise(marked, { type: "text", text: answer })?.correct,
      ).toBe(false);
    }
  });

  it.each(["", " \n ", "ก".repeat(201)])(
    "空・過大な空欄入力を採点しない: %s",
    (answer) => {
      expect(
        gradeExercise(text, { type: "text", text: answer }),
      ).toBeUndefined();
    },
  );

  it("空欄の教材正答が未設定の場合は推測しない", () => {
    expect(
      gradeExercise(
        { ...text, acceptedAnswers: [] },
        { type: "text", text: "กิน" },
      ),
    ).toBeUndefined();
  });

  it("並べ替えは全IDが正答順で1回ずつ並ぶ場合だけ正解にする", () => {
    expect(
      gradeExercise(ordering, {
        type: "ordering",
        tokenIds: ["i", "eat", "rice"],
      }),
    ).toEqual({ correct: true, selectedOptionId: "answer" });
    expect(
      gradeExercise(ordering, {
        type: "ordering",
        tokenIds: ["rice", "i", "eat"],
      }),
    ).toEqual({ correct: false, selectedOptionId: INCORRECT_INPUT_ID });
  });

  it.each([
    [],
    ["i"],
    ["i", "eat"],
    ["i", "eat", "rice", "rice"],
    ["i", "i", "rice"],
    ["i", "eat", "unknown"],
  ])("不足・重複・未知の語句は採点しない: %j", (...tokenIds) => {
    expect(
      gradeExercise(ordering, { type: "ordering", tokenIds }),
    ).toBeUndefined();
  });

  it("同じ表示語でも異なるtoken IDを区別する", () => {
    const repeated: Exercise = {
      ...ordering,
      tokens: [
        { id: "same-1", label: "ไป" },
        { id: "same-2", label: "ไป" },
      ],
      answerOrder: ["same-1", "same-2"],
    };
    expect(
      gradeExercise(repeated, {
        type: "ordering",
        tokenIds: ["same-1", "same-2"],
      })?.correct,
    ).toBe(true);
    expect(
      gradeExercise(repeated, {
        type: "ordering",
        tokenIds: ["same-2", "same-1"],
      })?.correct,
    ).toBe(false);
  });

  it("不正な並べ替え教材は推測して採点しない", () => {
    const response: ExerciseResponse = {
      type: "ordering",
      tokenIds: ["i", "eat", "rice"],
    };
    for (const exercise of [
      { ...ordering, tokens: [] },
      { ...ordering, tokens: [...ordering.tokens, ordering.tokens[0]] },
      { ...ordering, answerOrder: ["i", "eat"] },
      { ...ordering, answerOrder: ["i", "eat", "other"] },
      { ...ordering, answerOrder: ["i", "i", "rice"] },
    ]) {
      expect(gradeExercise(exercise, response)).toBeUndefined();
    }
  });

  it("未回答・型違い・正答ID不在の教材を採点しない", () => {
    expect(gradeExercise(choice, null)).toBeUndefined();
    expect(
      gradeExercise(text, { type: "ordering", tokenIds: [] }),
    ).toBeUndefined();
    expect(
      gradeExercise(ordering, { type: "text", text: "ฉันกินข้าว" }),
    ).toBeUndefined();
    expect(
      gradeExercise(
        { ...choice, answerId: "missing" },
        { type: "option", optionId: "answer" },
      ),
    ).toBeUndefined();
  });
});

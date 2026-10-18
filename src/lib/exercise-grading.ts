import { compareThaiAnswer } from "@/lib/answer-comparison";
import type { Exercise } from "@/lib/content-types";

/** 生の入力・並べ替え文字列を学習履歴へ持ち込まないための画面内の状態。 */
export type ExerciseResponse =
  | { type: "option"; optionId: string }
  | { type: "text"; text: string }
  | { type: "ordering"; tokenIds: readonly string[] };

export interface ExerciseGrade {
  correct: boolean;
  selectedOptionId: string;
}

/** 入力形式の誤答に使う固定ID。学習者の生の文字列を保存しない。 */
export const INCORRECT_INPUT_ID = "__incorrect__";

/**
 * 未回答・不正な回答はundefined。確定できる回答だけを採点する。
 * Thai文字は前後の空白以外を変更しない。
 */
export function gradeExercise(
  exercise: Exercise,
  response: ExerciseResponse | null,
): ExerciseGrade | undefined {
  if (!response) return undefined;
  if (!exercise.options.some((option) => option.id === exercise.answerId))
    return undefined;

  if (
    exercise.type === "multiple-choice" ||
    exercise.type === "character-recognition"
  ) {
    if (
      response.type !== "option" ||
      !exercise.options.some((option) => option.id === response.optionId)
    )
      return undefined;
    return {
      correct: response.optionId === exercise.answerId,
      selectedOptionId: response.optionId,
    };
  }

  let correct: boolean;
  if (exercise.type === "fill-in-the-blank") {
    if (response.type !== "text") return undefined;
    const result = compareThaiAnswer(response.text, exercise.acceptedAnswers);
    if (result.status === "empty" || result.status === "invalid")
      return undefined;
    correct = result.status === "correct";
  } else {
    if (response.type !== "ordering" || !Array.isArray(response.tokenIds))
      return undefined;
    const tokenIds = exercise.tokens.map((token) => token.id);
    if (
      tokenIds.length === 0 ||
      new Set(tokenIds).size !== tokenIds.length ||
      tokenIds.some((id) => typeof id !== "string" || !id.trim()) ||
      exercise.answerOrder.length !== tokenIds.length ||
      new Set(exercise.answerOrder).size !== tokenIds.length ||
      exercise.answerOrder.some((id) => !tokenIds.includes(id)) ||
      response.tokenIds.length !== tokenIds.length ||
      new Set(response.tokenIds).size !== tokenIds.length ||
      response.tokenIds.some((id) => !tokenIds.includes(id))
    )
      return undefined;
    correct = response.tokenIds.every(
      (id, index) => id === exercise.answerOrder[index],
    );
  }

  return {
    correct,
    selectedOptionId: correct ? exercise.answerId : INCORRECT_INPUT_ID,
  };
}

export type ThaiAnswerComparison = {
  status: "correct" | "incorrect" | "empty" | "invalid";
  value: string;
};

const maxAnswerLength = 200;

/**
 * 入力・音声認識が返した「文字列」の一致を調べる。発音や声調の評価ではない。
 * 前後の空白以外は変更しない。Unicodeの正規化・記号除去・語中の空白結合は行わない。
 */
export function compareThaiAnswer(
  input: string,
  acceptedAnswers: readonly string[],
): ThaiAnswerComparison {
  if (typeof input !== "string") return { status: "invalid", value: "" };
  const value = input.trim();
  if (
    input.length > maxAnswerLength ||
    !Array.isArray(acceptedAnswers) ||
    acceptedAnswers.length === 0
  ) {
    return { status: "invalid", value };
  }
  for (const answer of acceptedAnswers) {
    if (
      typeof answer !== "string" ||
      answer.length > maxAnswerLength ||
      answer.trim().length === 0
    ) {
      return { status: "invalid", value };
    }
  }
  if (value.length === 0) return { status: "empty", value };
  return {
    status: acceptedAnswers.some((answer) => answer.trim() === value)
      ? "correct"
      : "incorrect",
    value,
  };
}

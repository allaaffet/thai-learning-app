import {
  getCourseConversation,
  getCourseConversationScenario,
  getCourseConversationSteps,
  type CourseConversationUnit,
} from "@/data/course-conversations";
import { courseWordBuilderTargets } from "@/data/course-word-builders";
import { conversationWords } from "@/data/conversations";
import type {
  ConversationScenario,
  ConversationStep,
  ConversationWord,
} from "@/lib/conversation-types";

export interface CourseWordBuilder {
  lessonId: string;
  unit: CourseConversationUnit;
  step: ConversationStep;
  scenario: ConversationScenario;
  bank: ConversationWord[];
  acceptedWordIds: string[][];
}

export interface CourseWordBuilderGrade {
  correct: boolean;
  explanation: string;
}

function shuffled<T>(items: readonly T[], key: string) {
  const result = [...items];
  let state = 2166136261;
  for (const letter of key)
    state = Math.imul(state ^ letter.charCodeAt(0), 16777619);
  for (let index = result.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/** 登録済みの語句IDとモデルだけを使い、Thaiの文字列を推測分割しない。 */
export function getCourseWordBuilder(
  lessonId: string,
  seed = 0,
): CourseWordBuilder | undefined {
  const unit = getCourseConversation(lessonId);
  const target = courseWordBuilderTargets[lessonId];
  if (!unit || !target) return undefined;
  const scenario = getCourseConversationScenario(unit);
  const step = getCourseConversationSteps(unit).find(
    (item) => item.id === target,
  );
  if (!scenario || !step)
    throw new Error("組み立てる会話の参照を確認してください。");
  const acceptedWordIds = step.choices
    .filter((choice) => step.answerIds.includes(choice.id))
    .map((choice) => [...choice.phrase.wordIds]);
  if (!acceptedWordIds.length || acceptedWordIds.some((ids) => ids.length < 2))
    throw new Error("組み立てる返答例を確認してください。");
  // Copies of one registered word support explicitly authored repetitions too.
  const required = new Map<string, number>();
  for (const ids of acceptedWordIds) {
    for (const id of new Set(ids))
      required.set(
        id,
        Math.max(
          required.get(id) ?? 0,
          ids.filter((wordId) => wordId === id).length,
        ),
      );
  }
  const distractor = step.choices
    .filter((choice) => !step.answerIds.includes(choice.id))
    .flatMap((choice) => choice.phrase.wordIds)
    .find((id) => !required.has(id));
  if (distractor) required.set(distractor, 1);
  const bank = [...required].flatMap(([id, count]) => {
    const word = conversationWords.find((entry) => entry.id === id);
    if (!word) throw new Error("使える語句の参照を確認してください。");
    return Array.from({ length: count }, () => word);
  });
  const safeSeed = Number.isSafeInteger(seed) ? seed >>> 0 : 0;
  return {
    lessonId,
    unit,
    scenario,
    step,
    acceptedWordIds,
    bank: shuffled(bank, `${lessonId}:${safeSeed}`),
  };
}

/** 初回の語句列だけを判定する。成績・進捗・XPへの書込みは行わない。 */
export function gradeCourseWordBuilder(
  builder: CourseWordBuilder,
  response: unknown,
): CourseWordBuilderGrade {
  if (
    !Array.isArray(response) ||
    response.length === 0 ||
    !response.every((id: unknown) => typeof id === "string")
  )
    return {
      correct: false,
      explanation: "使える語句を選んで、返答を組み立てましょう。",
    };
  const ids: string[] = response;
  const available = builder.bank.map((word) => word.id);
  if (
    ids.some(
      (id) =>
        ids.filter((item) => item === id).length >
        available.filter((item) => item === id).length,
    )
  )
    return {
      correct: false,
      explanation:
        "同じ語句を重ねすぎたり、語句の一覧にないものを使ったりしています。返答例と見比べましょう。",
    };
  const correct = builder.acceptedWordIds.some(
    (answer) =>
      answer.length === ids.length &&
      answer.every((id, index) => ids[index] === id),
  );
  return {
    correct,
    explanation: correct
      ? builder.step.explanation
      : `今回は、この場面の返答例と同じ語句の順を練習します。抜け・余分な語句・並べる順を見比べましょう。${builder.step.explanation}`,
  };
}

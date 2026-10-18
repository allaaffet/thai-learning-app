"use client";

import { Check, RotateCcw, Undo2, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@/lib/content-types";
import type { ExerciseResponse } from "@/lib/exercise-grading";
import { cn } from "@/lib/utils";

interface ExerciseInputProps {
  exercise: Exercise;
  response: ExerciseResponse | null;
  onChange: (response: ExerciseResponse) => void;
  disabled: boolean;
  answeredCorrect?: boolean;
}

/** 問題形式ごとの入力。採点・保存はLessonPlayerから呼ぶpure helperで行う。 */
export function ExerciseInput({
  exercise,
  response,
  onChange,
  disabled,
  answeredCorrect,
}: ExerciseInputProps) {
  if (exercise.type === "fill-in-the-blank") {
    const inputId = `exercise-answer-${exercise.id}`;
    return (
      <div className="space-y-3">
        <label className="block font-medium" htmlFor={inputId}>
          空欄の答え
        </label>
        <input
          id={inputId}
          className="thai block min-h-14 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:bg-stone-100"
          value={response?.type === "text" ? response.text : ""}
          onChange={(event) =>
            onChange({ type: "text", text: event.currentTarget.value })
          }
          lang="th"
          maxLength={200}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          aria-describedby={`${inputId}-help`}
        />
        <p id={`${inputId}-help`} className="text-sm text-stone-600">
          タイ文字で入力してください。語中の空白や声調記号も綴りの一部として比較します。
        </p>
        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer py-2">タイ文字の入力方法</summary>
          <p className="mt-2 leading-7">
            Macは「システム設定 → キーボード → テキスト入力 → 編集 →
            ＋」からタイ語を追加できます。スマートフォンはキーボード設定でタイ語を追加してください。
          </p>
        </details>
      </div>
    );
  }

  if (exercise.type === "word-ordering") {
    const selected = response?.type === "ordering" ? response.tokenIds : [];
    return (
      <div className="space-y-5">
        <p className="text-sm text-stone-600">
          語句を選んで文を組み立てましょう。キーボードではTabとEnterで操作できます。
        </p>
        <div
          className="rounded-xl border border-stone-300 bg-stone-50 p-4"
          role="group"
          aria-label="選んだ語句"
        >
          <p className="mb-3 text-sm font-medium">選んだ語句</p>
          {selected.length > 0 ? (
            <ol className="flex min-h-12 flex-wrap gap-2">
              {selected.map((id, index) => (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2"
                >
                  <span className="text-xs text-stone-500">{index + 1}</span>
                  <span className="thai text-xl" lang="th">
                    {exercise.tokens.find((token) => token.id === id)?.label}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="min-h-12 py-3 text-sm text-stone-500">
              下の語句を、文の順番に選んでください。
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={disabled || selected.length === 0}
              onClick={() =>
                onChange({ type: "ordering", tokenIds: selected.slice(0, -1) })
              }
            >
              <Undo2 size={15} /> 一つ戻す
            </Button>
            <Button
              variant="ghost"
              disabled={disabled || selected.length === 0}
              onClick={() => onChange({ type: "ordering", tokenIds: [] })}
            >
              <RotateCcw size={15} /> 並べ直す
            </Button>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-3"
          role="group"
          aria-label="並べ替える語句"
        >
          {exercise.tokens.map((token) => (
            <button
              key={token.id}
              type="button"
              aria-label={`${token.label} を追加`}
              className="thai min-h-14 rounded-xl border border-stone-300 bg-white px-4 py-3 text-xl outline-offset-4 hover:border-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-default disabled:opacity-40"
              lang="th"
              disabled={disabled || selected.includes(token.id)}
              onClick={() =>
                onChange({
                  type: "ordering",
                  tokenIds: [...selected, token.id],
                })
              }
            >
              {token.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedOption = response?.type === "option" ? response.optionId : null;

  function handleRadioKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (
      disabled ||
      ![
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const current = exercise.options.findIndex(
      (option) => option.id === selectedOption,
    );
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? exercise.options.length - 1
          : (current + direction + exercise.options.length) %
            exercise.options.length;
    onChange({ type: "option", optionId: exercise.options[index].id });
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>("[role=radio]")
      [index]?.focus();
  }

  return (
    <div
      className="quiz-options"
      role="radiogroup"
      aria-labelledby="exercise-prompt"
      onKeyDown={handleRadioKeys}
    >
      {exercise.options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-label={option.label}
          aria-checked={selectedOption === option.id}
          disabled={disabled}
          tabIndex={
            selectedOption === option.id || (!selectedOption && index === 0)
              ? 0
              : -1
          }
          onClick={() => onChange({ type: "option", optionId: option.id })}
          className={cn(
            "quiz-option",
            selectedOption === option.id && "selected",
            disabled && option.id === exercise.answerId && "correct",
            disabled &&
              option.id === selectedOption &&
              !answeredCorrect &&
              "incorrect",
          )}
        >
          <span className="option-key">
            {disabled && option.id === exercise.answerId ? (
              <Check size={14} />
            ) : disabled && option.id === selectedOption && !answeredCorrect ? (
              <X size={14} />
            ) : (
              String.fromCharCode(65 + index)
            )}
          </span>
          <span
            className={cn(
              "option-label",
              /[\u0e00-\u0e7f]/.test(option.label) && "has-thai",
            )}
          >
            {option.label}
            {option.detail && <small>{option.detail}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

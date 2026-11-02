"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  Lightbulb,
  MessageCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  getCourseConversationScenario,
  getCourseConversationSteps,
  type CourseConversationUnit,
} from "@/data/course-conversations";
import { conversationSources, conversationWords } from "@/data/conversations";
import { languageSources } from "@/data/language";
import {
  createConversationChoiceOrder,
  gradeConversationChoice,
  type ConversationGrade,
} from "@/lib/conversation";
import type {
  ConversationChoice,
  ConversationScenario,
  ConversationStep,
} from "@/lib/conversation-types";
import { isThaiSpeechText } from "@/lib/device-speech";
import { Button } from "@/components/ui/button";
import { useSoundEffects } from "@/components/sound-effects-provider";
import {
  SpeakButton,
  type SpeakButtonHandle,
} from "@/components/speech-practice";

const wordsById = new Map(conversationWords.map((word) => [word.id, word]));

function ModelReplies({ step }: { step: ConversationStep }) {
  return (
    <div className="cd-model-replies">
      <p className="cd-model-label">あなたの返答例</p>
      {step.choices
        .filter((choice) => step.answerIds.includes(choice.id))
        .map((choice, index) => (
          <div className="cd-model-reply" key={choice.id}>
            <p className="thai cd-phrase" lang="th">
              {choice.phrase.thai}
            </p>
            <p>{choice.phrase.meaning}</p>
            {choice.phrase.note && (
              <p className="cd-small">{choice.phrase.note}</p>
            )}
            {isThaiSpeechText(choice.phrase.thai) && (
              <SpeakButton
                text={choice.phrase.thai}
                label={`返答例${index + 1}を聞く`}
              />
            )}
          </div>
        ))}
      <p className="cd-small">
        ここにある丁寧な形は、どちらもこの目標に合う返答例です。
      </p>
    </div>
  );
}

function ConversationSources({ scenario }: { scenario: ConversationScenario }) {
  const sources = [...conversationSources, ...languageSources].filter(
    (source) => scenario.sourceIds.includes(source.id),
  );
  return (
    <details className="cd-sources">
      <summary>
        <BookOpen size={16} aria-hidden="true" /> 教材・音声と出典
      </summary>
      <p>
        会話文・訳・使い方は教材案で、専門家の監修前です。単語のIPAの限定照合と、会話全体の自然さの確認は別です。
      </p>
      <p>
        音声は端末の合成音声です。ネイティブ話者の録音や、発音・声調の評価ではありません。タイ語の声がない端末でも、文字と訳で続けられます。
      </p>
      {sources.map((source) => (
        <div key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
          <p className="cd-small">{source.scope}</p>
        </div>
      ))}
    </details>
  );
}

function FocusWords({ unit }: { unit: CourseConversationUnit }) {
  const words = unit.focusWordIds.flatMap((id) => {
    const word = wordsById.get(id);
    return word ? [word] : [];
  });
  if (!words.length) return null;
  return (
    <details className="cd-words">
      <summary>
        <Lightbulb size={16} aria-hidden="true" /> 今日のことばと読み方
      </summary>
      <p className="cd-small">
        語句ごとの辞書形IPAです。文全体の発音表記ではありません。
      </p>
      <ul>
        {words.map((word) => (
          <li key={word.id}>
            <span className="thai" lang="th">
              {word.thai}
            </span>
            <span>{word.meaning}</span>
            <span className="ipa">{word.ipa}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * A finite, guided exchange embedded in the core course. A confirmed answer
 * teaches the accepted forms; it does not award XP or rate pronunciation.
 */
export function CourseDialogueCard({
  unit,
  mode,
  onComplete,
}: {
  unit: CourseConversationUnit;
  mode: "learn" | "recall";
  onComplete: () => void;
}) {
  const { playEffect } = useSoundEffects();
  const scenario = getCourseConversationScenario(unit);
  const steps = getCourseConversationSteps(unit);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"model" | "practice" | "complete">(
    mode === "learn" ? "model" : "practice",
  );
  const [choiceOrder] = useState<Record<string, string[]>>(() =>
    scenario
      ? createConversationChoiceOrder(scenario.id, mode === "learn" ? 0 : 1)
      : {},
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ConversationGrade | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const npcAudio = useRef<SpeakButtonHandle>(null);
  const replyAudio = useRef<SpeakButtonHandle>(null);
  const selected = useRef<string | null>(null);
  const committed = useRef(new Set<string>());
  const advanced = useRef(new Set<string>());
  const completed = useRef(false);
  const activeStep = useRef<string | null>(steps[0]?.id ?? null);
  const id = useId();
  const step = steps[index];
  const chosen = step?.choices.find((choice) => choice.id === selectedId);
  const choices = step
    ? (choiceOrder[step.id] ?? step.choices.map((choice) => choice.id)).flatMap(
        (choiceId) => {
          const choice = step.choices.find((item) => item.id === choiceId);
          return choice ? [choice] : [];
        },
      )
    : [];

  useEffect(() => {
    const node = heading.current;
    node?.focus({ preventScroll: true });
    if (node) {
      const bounds = node.getBoundingClientRect();
      if (bounds.top < 80 || bounds.bottom > window.innerHeight - 100)
        node.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [index, phase]);

  function stopAudio() {
    npcAudio.current?.stop();
    replyAudio.current?.stop();
  }

  function choose(choice: ConversationChoice) {
    if (
      !step ||
      completed.current ||
      activeStep.current !== step.id ||
      phase !== "practice" ||
      committed.current.has(step.id)
    )
      return;
    selected.current = choice.id;
    setSelectedId(choice.id);
    setError(null);
    if (isThaiSpeechText(choice.phrase.thai))
      replyAudio.current?.play(choice.phrase.thai);
  }

  function handleChoiceKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!step || committed.current.has(step.id)) return;
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const current = buttons.findIndex((button) => button === event.target);
    if (current < 0 || !buttons.length) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current +
              (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) +
              buttons.length) %
            buttons.length;
    const choice = choices[next];
    if (!choice) return;
    buttons[next].focus();
    choose(choice);
  }

  function confirm() {
    if (
      !scenario ||
      !step ||
      !selected.current ||
      activeStep.current !== step.id ||
      completed.current ||
      committed.current.has(step.id)
    )
      return;
    try {
      const result = gradeConversationChoice(
        scenario.id,
        step.id,
        selected.current,
      );
      committed.current.add(step.id);
      stopAudio();
      playEffect(result.correct ? "correct" : "incorrect");
      setFeedback(result);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "返答を確認できませんでした。",
      );
    }
  }

  function next() {
    if (
      !step ||
      !committed.current.has(step.id) ||
      advanced.current.has(step.id) ||
      completed.current
    )
      return;
    advanced.current.add(step.id);
    stopAudio();
    setShowModel(false);
    if (index === steps.length - 1) {
      completed.current = true;
      activeStep.current = null;
      setPhase("complete");
      onComplete();
      return;
    }
    activeStep.current = steps[index + 1]?.id ?? null;
    selected.current = null;
    setIndex((value) => value + 1);
    setSelectedId(null);
    setFeedback(null);
    setShowTranslations(false);
    setError(null);
    setPhase(mode === "learn" ? "model" : "practice");
  }

  if (!scenario || !step)
    return (
      <section className="surface cd-card" aria-label="会話チャレンジ">
        <p role="alert">この会話の教材を確認できませんでした。</p>
      </section>
    );

  return (
    <section
      className="surface cd-card"
      aria-label="会話チャレンジ"
      data-dialogue-phase={phase}
      data-step-id={step.id}
      data-dialogue-mode={mode}
    >
      <div className="cd-topline">
        <span className="cd-badge">
          <MessageCircle size={18} aria-hidden="true" />
          {mode === "learn" ? "ことばを使ってみよう" : "もう一度、会話しよう"}
        </span>
        <span className="cd-small">
          {phase === "complete" ? steps.length : index + 1} / {steps.length}{" "}
          やり取り
        </span>
      </div>
      {phase === "complete" ? (
        <div className="cd-complete">
          <CircleCheck size={36} aria-hidden="true" />
          <h2 ref={heading} tabIndex={-1}>
            会話の返し方を確認しました
          </h2>
          <p>このやり取りを、少しずつ自分のものに。</p>
          <p className="cd-small">
            返答の意味を確かめる練習です。発音や会話能力の採点ではありません。
          </p>
        </div>
      ) : (
        <>
          <p className="cd-context" id={`${id}-context`}>
            {unit.context}
          </p>
          <p className="cd-disclosure">
            教材・訳・用法は専門家監修前。音声は端末合成（未監修）で、提供元と通信する場合があります。
          </p>
          <div className="cd-npc">
            <span className="cd-avatar" aria-hidden="true">
              <MessageCircle size={22} />
            </span>
            <div className="cd-bubble">
              <span className="cd-speaker">相手</span>
              <p className="thai cd-phrase" lang="th">
                {step.npc.thai}
              </p>
              <p>{step.npc.meaning}</p>
              {step.npc.note && <p className="cd-small">{step.npc.note}</p>}
              {isThaiSpeechText(step.npc.thai) && (
                <SpeakButton
                  ref={npcAudio}
                  text={step.npc.thai}
                  label="相手のことばを聞く"
                />
              )}
            </div>
          </div>
          <h2 className="cd-goal" id={`${id}-goal`} ref={heading} tabIndex={-1}>
            {step.goal}
          </h2>
          {phase === "model" ? (
            <>
              <p className="cd-small">
                まずは返答例を見て、音も聞いてみましょう。
              </p>
              <ModelReplies step={step} />
              <div className="cd-actions">
                <Button
                  size="lg"
                  onClick={() => {
                    stopAudio();
                    setShowModel(false);
                    setPhase("practice");
                  }}
                >
                  会話で使ってみる <ArrowRight size={18} aria-hidden="true" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="cd-hint-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showModel}
                  aria-controls={`${id}-models`}
                  onClick={() => {
                    stopAudio();
                    setShowModel((value) => !value);
                  }}
                >
                  <BookOpen size={16} aria-hidden="true" />
                  {showModel ? "お手本を閉じる" : "お手本を見る"}
                </Button>
                {mode === "recall" && !feedback && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={showTranslations}
                    onClick={() => setShowTranslations((value) => !value)}
                  >
                    <Lightbulb size={16} aria-hidden="true" />
                    {showTranslations ? "訳を隠す" : "訳をヒントにする"}
                  </Button>
                )}
              </div>
              {showModel && (
                <div id={`${id}-models`}>
                  <ModelReplies step={step} />
                </div>
              )}
              <p className="cd-small cd-choice-help" id={`${id}-help`}>
                返答を選ぶと、対応端末ではそのまま音も聞けます。意味を確かめてから確認しましょう。
              </p>
              <div
                className="cd-choices"
                role="radiogroup"
                aria-labelledby={`${id}-goal`}
                aria-describedby={`${id}-help`}
                onKeyDown={handleChoiceKey}
              >
                {choices.map((choice, choiceIndex) => {
                  const accepted = Boolean(
                    feedback && step.answerIds.includes(choice.id),
                  );
                  const picked = selectedId === choice.id;
                  return (
                    <button
                      type="button"
                      role="radio"
                      key={choice.id}
                      aria-label={choice.phrase.thai}
                      aria-checked={picked}
                      tabIndex={
                        picked || (!selectedId && choiceIndex === 0) ? 0 : -1
                      }
                      disabled={Boolean(feedback)}
                      className={`cd-choice${picked ? " is-selected" : ""}${accepted ? " is-accepted" : ""}`}
                      onClick={() => choose(choice)}
                    >
                      <span className="cd-choice-icon" aria-hidden="true">
                        {accepted ? <Check size={19} /> : <Volume2 size={19} />}
                      </span>
                      <span className="cd-choice-copy">
                        <span className="thai cd-choice-thai" lang="th">
                          {choice.phrase.thai}
                        </span>
                        {(mode === "learn" || showTranslations || feedback) && (
                          <span className="cd-choice-meaning">
                            {choice.phrase.meaning}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Keep the player mounted and enabled for the first card gesture.
                  Visibility, rather than a stale disabled prop, hides no-selection playback. */}
              <div hidden={!selectedId} className="cd-replay">
                <SpeakButton
                  ref={replyAudio}
                  text={chosen?.phrase.thai ?? ""}
                  label="選んだ返答をもう一度聞く"
                />
              </div>
              {feedback && (
                <div
                  className={`cd-feedback${feedback.correct ? " is-correct" : " is-review"}`}
                  role="status"
                  data-correct={feedback.correct}
                >
                  {feedback.correct ? (
                    <CircleCheck size={24} aria-hidden="true" />
                  ) : (
                    <Lightbulb size={24} aria-hidden="true" />
                  )}
                  <div>
                    <h3>
                      {feedback.correct
                        ? "伝えたいことに合っています！"
                        : "この場面の返し方を確かめよう。"}
                    </h3>
                    <p>{feedback.choiceExplanation}</p>
                    <p>{feedback.explanation}</p>
                    {!feedback.correct && (
                      <div className="cd-accepted-replies">
                        <strong>この目標に合う返答例</strong>
                        {step.choices
                          .filter((choice) =>
                            step.answerIds.includes(choice.id),
                          )
                          .map((choice) => (
                            <p key={choice.id}>
                              <span className="thai" lang="th">
                                {choice.phrase.thai}
                              </span>
                              <span>{choice.phrase.meaning}</span>
                            </p>
                          ))}
                      </div>
                    )}
                    <p className="cd-small">
                      意味を確認したら、そのまま次へ進めます。
                    </p>
                  </div>
                </div>
              )}
              {error && <p role="alert">{error}</p>}
              <div className="cd-actions">
                {feedback ? (
                  <Button size="lg" onClick={next}>
                    {index === steps.length - 1
                      ? "会話を終える"
                      : "次のやりとりへ"}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                ) : (
                  <Button size="lg" disabled={!selectedId} onClick={confirm}>
                    返答を確認 <Check size={18} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
      <FocusWords unit={unit} />
      <ConversationSources scenario={scenario} />
      <p className="cd-small cd-learning-note">
        <Sparkles size={15} aria-hidden="true" />
        {unit.objective}
      </p>
    </section>
  );
}

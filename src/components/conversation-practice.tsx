"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  Coffee,
  Compass,
  Flag,
  Hand,
  Lightbulb,
  MessageCircle,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/speech-practice";
import { useConversations } from "@/components/use-conversations";
import {
  conversationScenarios,
  conversationSources,
  conversationWords,
} from "@/data/conversations";
import { getCourseLesson } from "@/data/course";
import { languageSources } from "@/data/language";
import {
  createConversationChoiceOrder,
  gradeConversationChoice,
  type ConversationAnswer,
  type ConversationGrade,
} from "@/lib/conversation";
import type {
  ConversationPhrase,
  ConversationScenario,
} from "@/lib/conversation-types";
import { isThaiSpeechText } from "@/lib/device-speech";

const words = new Map(conversationWords.map((word) => [word.id, word]));
const sourceIds = new Set(
  conversationScenarios.flatMap((scenario) => scenario.sourceIds),
);
const sources = [...conversationSources, ...languageSources].filter((source) =>
  sourceIds.has(source.id),
);
const scenarioIcons: Record<string, typeof MessageCircle> = {
  "greeting-origin": Hand,
  "cafe-water": Coffee,
  "shopping-price": ShoppingBag,
  "restroom-directions": Compass,
};

interface RunningConversation {
  id: string;
  scenarioId: string;
  index: number;
  phase: "practice" | "review";
  answers: ConversationAnswer[];
  choiceOrder: Record<string, string[]>;
}

interface Feedback extends ConversationGrade {
  choiceId: string;
  stepId: string;
}

function WordHints({ phrase }: { phrase: ConversationPhrase }) {
  const selected = phrase.wordIds.flatMap((id) => {
    const word = words.get(id);
    return word ? [word] : [];
  });
  return (
    <details className="cv-word-hints">
      <summary>
        <BookOpen size={16} aria-hidden="true" /> 単語の読み方を見る
      </summary>
      <p className="cv-small">
        単語ごとのIPAです。文全体の音声表記や、連続した発話の保証ではありません。
      </p>
      <ul>
        {selected.map((word, index) => (
          <li key={`${word.id}-${index}`}>
            <span className="thai" lang="th">
              {word.thai}
            </span>
            <span className="ipa">{word.ipa}</span>
            <span>{word.meaning}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Phrase({ phrase }: { phrase: ConversationPhrase }) {
  return (
    <div className="cv-phrase">
      <p className="thai cv-phrase-thai" lang="th">
        {phrase.thai}
      </p>
      <p className="cv-phrase-meaning">{phrase.meaning}</p>
      {phrase.note && <p className="cv-small">{phrase.note}</p>}
    </div>
  );
}

function ModelAudio({
  phrase,
  label = "この表現を聞く",
}: {
  phrase: ConversationPhrase;
  label?: string;
}) {
  if (!isThaiSpeechText(phrase.thai)) return null;
  return (
    <div className="cv-model-audio">
      <p className="cv-small">
        端末合成音声は未監修です。利用時に音声提供元へ通信する場合があります。
      </p>
      <SpeakButton text={phrase.thai} label={label} />
    </div>
  );
}

function RelatedLessons({ scenario }: { scenario: ConversationScenario }) {
  return (
    <details className="cv-related">
      <summary>関連レッスンを確認する</summary>
      <div>
        {scenario.relatedLessonIds.flatMap((id) => {
          const lesson = getCourseLesson(id);
          return lesson
            ? [
                <Link key={id} href={`/lessons/${id}`}>
                  <BookOpen size={16} aria-hidden="true" /> {lesson.title}
                </Link>,
              ]
            : [];
        })}
      </div>
    </details>
  );
}

function Sources() {
  return (
    <details className="cv-sources surface">
      <summary>教材・音声と出典について</summary>
      <p>
        会話文・日本語訳・使い方の説明は教材案で、専門家の監修前です。単語のIPAは資料との限定的な照合に基づきます。文全体のIPAは収録していません。
      </p>
      <p>
        再生する音声は端末の合成音声です。タイ語の声がある場合だけ利用でき、録音されたネイティブ話者の音声教材ではありません。音声なしでも練習できます。
      </p>
      {sources.map((source) => (
        <article key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
          <p className="cv-small">{source.publisher}</p>
          <p>{source.scope}</p>
        </article>
      ))}
    </details>
  );
}

/** Guided intent choices: no voice scoring, automatic audio or course XP. */
export function ConversationPractice() {
  const progress = useConversations();
  const [session, setSession] = useState<RunningConversation | null>(null);
  const current = useRef<RunningConversation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackRef = useRef<Feedback | null>(null);
  const [recorded, setRecorded] = useState(false);
  const recordedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const catalogHeading = useRef<HTMLHeadingElement>(null);
  const activeScenario = session
    ? conversationScenarios.find(
        (scenario) => scenario.id === session.scenarioId,
      )
    : undefined;
  const step =
    activeScenario && session ? activeScenario.steps[session.index] : undefined;
  const chosen = step?.choices.find(
    (choice) => choice.id === feedback?.choiceId,
  );
  const orderedChoices =
    session && step
      ? session.choiceOrder[step.id].flatMap((id) => {
          const choice = step.choices.find((entry) => entry.id === id);
          return choice ? [choice] : [];
        })
      : [];
  const practiced = conversationScenarios.filter(
    (scenario) => progress.state.scenarios[scenario.id],
  ).length;

  function focusHeading(catalog = false) {
    window.requestAnimationFrame(() => {
      const target = catalog ? catalogHeading.current : heading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start" });
    });
  }

  function clearChoice() {
    selected.current = null;
    feedbackRef.current = null;
    setSelectedId(null);
    setFeedback(null);
    setError(null);
  }

  function start(scenario: ConversationScenario) {
    if (!progress.ready) return;
    try {
      const random = window.crypto.getRandomValues(new Uint32Array(4));
      const next: RunningConversation = {
        id: `conversation-${Array.from(random, (value) => value.toString(16)).join("-")}`,
        scenarioId: scenario.id,
        index: 0,
        phase: "practice",
        answers: [],
        choiceOrder: createConversationChoiceOrder(scenario.id, random[0]),
      };
      current.current = next;
      recordedRef.current = false;
      setSession(next);
      setRecorded(false);
      clearChoice();
      focusHeading();
    } catch {
      setError(
        "会話を準備できませんでした。ページを再読み込みしてお試しください。",
      );
    }
  }

  function back() {
    current.current = null;
    setSession(null);
    clearChoice();
    focusHeading(true);
  }

  function checkAnswer() {
    const running = current.current;
    if (
      !running ||
      !session ||
      !step ||
      !selected.current ||
      running.id !== session.id ||
      running.index !== session.index ||
      running.phase !== "practice" ||
      feedbackRef.current
    )
      return;
    try {
      const choiceId = selected.current;
      const grade = gradeConversationChoice(
        running.scenarioId,
        step.id,
        choiceId,
      );
      const nextFeedback = { ...grade, choiceId, stepId: step.id };
      feedbackRef.current = nextFeedback;
      setFeedback(nextFeedback);
      if (grade.correct) {
        const next = {
          ...running,
          answers: [...running.answers, { stepId: step.id, choiceId }],
        };
        current.current = next;
        setSession(next);
      }
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "表現を確認できませんでした。",
      );
    }
  }

  function retry() {
    if (
      !session ||
      !step ||
      !feedbackRef.current ||
      feedbackRef.current.correct
    )
      return;
    if (
      current.current?.id !== session.id ||
      current.current.index !== session.index
    )
      return;
    clearChoice();
    focusHeading();
  }

  function advance() {
    const running = current.current;
    if (
      !running ||
      !session ||
      !step ||
      !activeScenario ||
      running.id !== session.id ||
      running.index !== session.index ||
      running.phase !== "practice" ||
      !feedbackRef.current?.correct ||
      feedbackRef.current.stepId !== step.id
    )
      return;
    const next: RunningConversation =
      running.index === activeScenario.steps.length - 1
        ? { ...running, phase: "review" }
        : { ...running, index: running.index + 1 };
    current.current = next;
    setSession(next);
    clearChoice();
    focusHeading();
  }

  function record() {
    const running = current.current;
    if (
      !running ||
      !session ||
      running.id !== session.id ||
      running.phase !== "review" ||
      recordedRef.current
    )
      return;
    recordedRef.current = true;
    const success = progress.complete({
      scenarioId: running.scenarioId,
      sessionId: running.id,
      answers: running.answers,
      completedAt: new Date().toISOString(),
    });
    if (!success) {
      recordedRef.current = false;
      return;
    }
    setRecorded(true);
    focusHeading();
  }

  return (
    <div className="cv-page">
      <header className="cv-page-heading">
        <p className="eyebrow">
          <MessageCircle size={15} aria-hidden="true" /> CONVERSATION MISSIONS
        </p>
        <h1 className="page-title" ref={catalogHeading} tabIndex={-1}>
          会話ミッション
        </h1>
        <p className="page-description">旅行のひとことを、短い会話で試そう。</p>
        <div className="cv-page-badges">
          <span className="badge neutral">教材案・専門家監修前</span>
          <span className="cv-practiced-count">
            <Check size={16} aria-hidden="true" /> 練習済み {practiced} /{" "}
            {conversationScenarios.length}シーン
          </span>
        </div>
      </header>

      {progress.message && (
        <div className="cv-storage-notice" role="status">
          <p>{progress.message}</p>
          {progress.loadStatus === "invalid" && (
            <details>
              <summary>会話の保存を再開する</summary>
              <p>
                このブラウザの会話記録だけを、このタブで確認できる記録に置き換えます。以前の会話データは復元できません。
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={progress.recoverStorage}
              >
                会話の保存記録を置き換える
              </Button>
            </details>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="cv-error">
          {error}
        </p>
      )}

      {!session && (
        <section aria-label="会話ミッション一覧">
          <p className="cv-catalog-note">
            用意された会話で、場面に合う表現を選びます。何度でも確かめられ、音声なしでも進めます。
          </p>
          {!progress.ready && <p role="status">会話の記録を読み込み中です…</p>}
          <div className="cv-catalog">
            {conversationScenarios.map((scenario, index) => {
              const Icon = scenarioIcons[scenario.id] ?? MessageCircle;
              const saved = progress.state.scenarios[scenario.id];
              return (
                <article
                  className="cv-scenario surface"
                  key={scenario.id}
                  data-testid={`conversation-card-${scenario.id}`}
                >
                  <div className="cv-scenario-top">
                    <span className="cv-scenario-icon">
                      <Icon size={27} aria-hidden="true" />
                    </span>
                    <span className="cv-scenario-number">
                      SCENE {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2>{scenario.title}</h2>
                  <p className="cv-small">{scenario.setting}</p>
                  <p className="cv-scenario-objective">{scenario.objective}</p>
                  <div className="cv-scenario-meta">
                    <span>
                      {scenario.steps.length}つのやりとり · 約
                      {scenario.durationMinutes}分
                    </span>
                    {saved && (
                      <span>
                        <CircleCheck size={16} aria-hidden="true" /> 練習済み ·{" "}
                        {saved.completedSessions}回
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    disabled={!progress.ready}
                    aria-label={`${scenario.title}を始める`}
                    onClick={() => start(scenario)}
                  >
                    このシーンを始める{" "}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                </article>
              );
            })}
          </div>
          <p className="cv-small cv-boundary-note">
            記録はこのブラウザだけに保存します。練習済みの表示は取り組みの記録で、会話力・発音の評価ではありません。XPの追加はありません。
          </p>
        </section>
      )}

      {session && activeScenario && session.phase === "practice" && step && (
        <section
          className="cv-practice surface"
          aria-label="会話の練習"
          data-scenario-id={activeScenario.id}
          data-step-id={step.id}
          data-step-index={session.index + 1}
          key={`${session.id}-${step.id}`}
        >
          <Button type="button" variant="ghost" onClick={back}>
            <ArrowLeft size={16} aria-hidden="true" /> シーン一覧に戻る
          </Button>
          <div className="cv-practice-title">
            <h2 ref={heading} tabIndex={-1}>
              {activeScenario.title}
              <span className="sr-only">、やりとり{session.index + 1}</span>
            </h2>
            <span className="cv-step-counter">
              {session.index + 1} / {activeScenario.steps.length}
            </span>
          </div>
          <ol className="cv-trail" aria-label="会話の進み具合">
            {activeScenario.steps.map((item, index) => (
              <li
                key={item.id}
                aria-current={index === session.index ? "step" : undefined}
                className={index < session.answers.length ? "is-done" : ""}
              >
                <span aria-hidden="true">
                  {index < session.answers.length ? (
                    <Check size={18} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="sr-only">
                  やりとり{index + 1}：
                  {index < session.answers.length
                    ? "表現を確認済み"
                    : index === session.index
                      ? "選択中"
                      : "これから"}
                </span>
              </li>
            ))}
          </ol>
          <div className="cv-npc-bubble">
            <span className="cv-speaker">
              <MessageCircle size={16} aria-hidden="true" /> 相手
            </span>
            <p
              className="thai cv-npc-thai"
              lang="th"
              data-testid="conversation-npc"
            >
              {step.npc.thai}
            </p>
            <details className="cv-translation">
              <summary>日本語を見る</summary>
              <p>{step.npc.meaning}</p>
              {step.npc.note && <p className="cv-small">{step.npc.note}</p>}
            </details>
            <ModelAudio phrase={step.npc} label="相手の表現を聞く" />
            <WordHints phrase={step.npc} />
          </div>
          <div className="cv-your-goal">
            <Flag size={20} aria-hidden="true" />
            <div>
              <span>あなたの番</span>
              <h3>{step.goal}</h3>
            </div>
          </div>
          <fieldset className="cv-choices" disabled={Boolean(feedback)}>
            <legend className="sr-only">この場面で返す表現</legend>
            {orderedChoices.map((choice, index) => (
              <label
                className={`cv-choice${selectedId === choice.id ? " is-selected" : ""}`}
                key={choice.id}
              >
                <input
                  type="radio"
                  name="conversation-answer"
                  value={choice.id}
                  data-choice-id={choice.id}
                  checked={selectedId === choice.id}
                  onChange={() => {
                    selected.current = choice.id;
                    setSelectedId(choice.id);
                  }}
                  aria-label={choice.phrase.thai}
                />
                <span className="cv-choice-letter" aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="thai cv-choice-thai" lang="th">
                  {choice.phrase.thai}
                </span>
              </label>
            ))}
          </fieldset>
          {feedback && chosen && (
            <div
              className={`cv-feedback${feedback.correct ? " is-correct" : " is-review"}`}
              role="status"
              data-answer-correct={feedback.correct}
            >
              <div className="cv-feedback-title">
                {feedback.correct ? (
                  <CircleCheck size={22} aria-hidden="true" />
                ) : (
                  <Lightbulb size={22} aria-hidden="true" />
                )}
                <h3>
                  {feedback.correct
                    ? "この場面の目的に合いました！"
                    : "場面に合う表現を確かめよう。"}
                </h3>
              </div>
              <p>{chosen.phrase.meaning}</p>
              <p>{feedback.choiceExplanation}</p>
              <p>{feedback.explanation}</p>
              {feedback.correct ? (
                <>
                  <ModelAudio phrase={chosen.phrase} />
                  <WordHints phrase={chosen.phrase} />
                </>
              ) : (
                <div className="cv-answer-examples">
                  <h4>この場面で使う例</h4>
                  {step.choices
                    .filter((choice) =>
                      feedback.correctChoiceIds.includes(choice.id),
                    )
                    .map((choice) => (
                      <Phrase key={choice.id} phrase={choice.phrase} />
                    ))}
                </div>
              )}
            </div>
          )}
          <div className="cv-practice-actions">
            <p className="cv-small">
              意味と場面を確かめる練習です。発音の自動採点は行いません。
            </p>
            {feedback ? (
              feedback.correct ? (
                <Button type="button" onClick={advance}>
                  {session.index === activeScenario.steps.length - 1
                    ? "会話を振り返る"
                    : "次のやりとりへ"}
                  <ArrowRight size={17} aria-hidden="true" />
                </Button>
              ) : (
                <Button type="button" onClick={retry}>
                  <RotateCcw size={17} aria-hidden="true" />
                  もう一度選ぶ
                </Button>
              )
            ) : (
              <Button
                type="button"
                disabled={!selectedId}
                onClick={checkAnswer}
              >
                この表現で答える <Check size={17} aria-hidden="true" />
              </Button>
            )}
          </div>
        </section>
      )}

      {session && activeScenario && session.phase === "review" && (
        <section
          className="cv-review surface"
          aria-label="会話の振り返り"
          data-scenario-id={activeScenario.id}
        >
          <span className="cv-review-emblem" aria-hidden="true">
            <MessageCircle size={35} />
          </span>
          <p className="eyebrow">MISSION REVIEW</p>
          <h2 ref={heading} tabIndex={-1}>
            {recorded ? "この会話を練習しました！" : "会話を振り返ろう。"}
          </h2>
          <p>
            {activeScenario.steps.length}
            つのやりとりで、場面に合う表現を確かめました。
          </p>
          <p className="cv-small">{activeScenario.objective}</p>
          <div className="cv-review-actions">
            {!recorded && (
              <Button type="button" onClick={record}>
                この会話の練習を記録 <Check size={17} aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => start(activeScenario)}
            >
              <RotateCcw size={17} aria-hidden="true" />
              もう一度このシーン
            </Button>
            <Button type="button" variant="ghost" onClick={back}>
              シーン一覧に戻る <ArrowRight size={17} aria-hidden="true" />
            </Button>
          </div>
          {recorded && (
            <p className="cv-save-note" role="status">
              {progress.loadStatus === "loaded"
                ? "このブラウザに練習の記録を保存しました。"
                : "このタブで練習を記録しています。保存状態は上のお知らせを確認してください。"}
            </p>
          )}
          <details className="cv-transcript">
            <summary>今回選んだ会話を見返す</summary>
            {activeScenario.steps.map((item) => {
              const answer = session.answers.find(
                (entry) => entry.stepId === item.id,
              );
              const reply = item.choices.find(
                (choice) => choice.id === answer?.choiceId,
              );
              return reply ? (
                <div className="cv-transcript-turn" key={item.id}>
                  <div>
                    <span className="cv-speaker">相手</span>
                    <Phrase phrase={item.npc} />
                  </div>
                  <div className="cv-transcript-reply">
                    <span className="cv-speaker">あなた</span>
                    <Phrase phrase={reply.phrase} />
                  </div>
                </div>
              ) : null;
            })}
          </details>
          <RelatedLessons scenario={activeScenario} />
        </section>
      )}
      <Sources />
    </div>
  );
}

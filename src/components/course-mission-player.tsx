"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  Flag,
  Layers2,
  Leaf,
  LockKeyhole,
  MessagesSquare,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { courseLessons } from "@/data/course";
import { getCourseConversation } from "@/data/course-conversations";
import { CourseDialogueCard } from "@/components/course-dialogue-card";
import { CourseWordBuilderCard } from "@/components/course-word-builder-card";
import type { Lesson } from "@/lib/content-types";
import {
  appendMissionRetry,
  buildLessonMission,
  buildMixedReviewMission,
  getMissionExercise,
} from "@/lib/course-mission";
import {
  gradeExercise,
  type ExerciseGrade,
  type ExerciseResponse,
} from "@/lib/exercise-grading";
import {
  getNextLesson,
  isLessonUnlocked,
  type ExerciseAttempt,
} from "@/lib/progress";
import { isThaiSpeechText } from "@/lib/device-speech";
import { useLearning } from "@/components/learning-provider";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { useGameProgress } from "@/components/use-game-progress";
import {
  CompletionRewards,
  type RewardBaseline,
} from "@/components/completion-rewards";
import { LessonCelebration } from "@/components/lesson-celebration";
import { LearningBlockCard, ExampleVisual } from "@/components/lesson-visuals";
import { ExerciseInput } from "@/components/exercise-input";
import {
  SpeakButton,
  type SpeakButtonHandle,
} from "@/components/speech-practice";
import { Button } from "@/components/ui/button";

export function CourseMissionPlayer({ lesson }: { lesson?: Lesson }) {
  const { progress, ready } = useLearning();
  const [run, setRun] = useState(0);
  if (!ready) return <p role="status">冒険の続きを準備しています…</p>;
  if (lesson && !isLessonUnlocked(progress, lesson)) {
    return (
      <section className="surface mission-empty">
        <LockKeyhole size={36} aria-hidden="true" />
        <h1 className="page-title">ここから、一歩ずつ。</h1>
        <p>先にこちらのミッションをクリアしましょう。</p>
        {lesson.prerequisites.map((id) => (
          <Button asChild key={id}>
            <Link href={`/play/${id}`}>
              {courseLessons.find((item) => item.id === id)?.title ??
                "前のミッション"}
              <ArrowRight size={17} />
            </Link>
          </Button>
        ))}
        <Link className="text-link" href="/play">
          冒険マップへ
        </Link>
      </section>
    );
  }
  return (
    <MissionRun
      key={`${lesson?.id ?? "mix"}:${run}`}
      lesson={lesson}
      seed={run}
      restart={() => setRun((value) => value + 1)}
    />
  );
}

function MissionRun({
  lesson,
  seed,
  restart,
}: {
  lesson?: Lesson;
  seed: number;
  restart: () => void;
}) {
  const { progress, finishLesson, storageMessage } = useLearning();
  const { playEffect } = useSoundEffects();
  const { game } = useGameProgress();
  // Freeze the queue for this run. A storage update in another tab must not
  // replace the card the learner is answering or turn recall into core answers.
  const [mission] = useState(() =>
    lesson
      ? buildLessonMission(
          lesson,
          courseLessons,
          progress,
          seed + (progress.lessons[lesson.id]?.attemptCount ?? 0),
        )
      : buildMixedReviewMission(courseLessons, progress, seed),
  );
  const [cards, setCards] = useState(mission.cards);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [feedback, setFeedback] = useState<ExerciseGrade | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<ExerciseAttempt[]>([]);
  const [practiceCount, setPracticeCount] = useState(0);
  const [dialogueDone, setDialogueDone] = useState(false);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [builderDone, setBuilderDone] = useState(false);
  const [builderCount, setBuilderCount] = useState(0);
  const [chain, setChain] = useState(0);
  const [result, setResult] = useState<{
    passed: boolean;
    earnedXp: number;
  } | null>(null);
  const [baseline, setBaseline] = useState<RewardBaseline | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committed = useRef(new Set<string>());
  const advanced = useRef(new Set<string>());
  const saved = useRef(false);
  const completedDialogues = useRef(new Set<string>());
  const completedBuilders = useRef(new Set<string>());
  const activeCardId = useRef(mission.cards[0]?.id ?? null);
  const heading = useRef<HTMLHeadingElement>(null);
  const exploreAudio = useRef<SpeakButtonHandle>(null);
  const card = cards[index];
  const finished = !card;
  const correct = answers.filter((answer) => answer.correct).length;
  const baseCount = mission.cards.length;
  const question = card?.kind === "question" ? getMissionExercise(card) : null;
  const pending = question ? gradeExercise(question, response) : undefined;
  const next = getNextLesson(progress, courseLessons);
  const conversation = lesson ? getCourseConversation(lesson.id) : undefined;

  useEffect(() => {
    const node = heading.current;
    node?.focus({ preventScroll: true });
    if (node) {
      const bounds = node.getBoundingClientRect();
      if (bounds.top < 80 || bounds.bottom > window.innerHeight - 100)
        node.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [index, result]);
  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 1100);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  function checkAnswer() {
    if (card?.kind !== "question" || !pending || committed.current.has(card.id))
      return;
    committed.current.add(card.id);
    setFeedback(pending);
    setChain((value) => (pending.correct ? value + 1 : 0));
    playEffect(pending.correct ? "correct" : "incorrect");
    if (card.purpose === "core" && lesson) {
      setAnswers((previous) =>
        previous.some((answer) => answer.exerciseId === card.exercise.id)
          ? previous
          : [
              ...previous,
              {
                exerciseId: card.exercise.id,
                lessonId: lesson.id,
                selectedOptionId: pending.selectedOptionId,
                correct: pending.correct,
                attemptedAt: new Date().toISOString(),
              },
            ],
      );
    } else setPracticeCount((value) => value + 1);
    if (!pending.correct)
      setCards((previous) => appendMissionRetry(previous, card));
  }

  function advance() {
    if (!card || advanced.current.has(card.id)) return;
    if (card.kind === "question" && !feedback) return;
    if (card.kind === "explore" && !revealed) return;
    if (card.kind === "conversation" && !dialogueDone) return;
    if (card.kind === "word-builder" && !builderDone) return;
    advanced.current.add(card.id);
    activeCardId.current = cards[index + 1]?.id ?? null;
    exploreAudio.current?.stop();
    setIndex((value) => value + 1);
    setResponse(null);
    setFeedback(null);
    setRevealed(false);
    setDialogueDone(false);
    setBuilderDone(false);
  }

  function recordResult() {
    if (
      !lesson ||
      !finished ||
      saved.current ||
      answers.length !== mission.coreExerciseIds.length
    )
      return;
    try {
      const outcome = finishLesson(lesson, {
        correct,
        total: lesson.exercises.length,
        attempts: answers,
      });
      saved.current = true;
      if (game)
        setBaseline({
          level: game.experience.level,
          badgeIds: game.badges
            .filter((badge) => badge.done)
            .map((badge) => badge.id),
        });
      setResult(outcome);
      setError(null);
      if (outcome.passed) {
        playEffect("lesson-complete");
        setCelebrating(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "記録できませんでした。もう一度お試しください。",
      );
    }
  }

  if (cards.length === 0)
    return (
      <section className="surface mission-empty">
        <Layers2 size={36} aria-hidden="true" />
        <h1 className="page-title">まずは、ひとつ遊んでみよう。</h1>
        <p>クリアしたミッションの内容を、ここでミックスして練習できます。</p>
        <Button asChild>
          <Link href="/play">
            冒険マップへ
            <ArrowRight size={17} />
          </Link>
        </Button>
      </section>
    );

  const purpose = card?.kind === "question" ? card.purpose : undefined;
  const badge =
    card?.kind === "conversation"
      ? card.mode === "learn"
        ? "まずは、会話で使ってみよう"
        : "もう一度、会話で思い出そう"
      : card?.kind === "word-builder"
        ? "ことばを組み立てよう"
        : card?.kind === "learn"
          ? "新しい発見"
          : card?.kind === "explore"
            ? "めくって思い出す"
            : purpose === "review"
              ? "前の冒険から"
              : purpose === "recall"
                ? "もう一度、思い出そう"
                : purpose === "retry"
                  ? "仕上げのもう一度"
                  : "チェックポイント";
  const sourceLesson = card
    ? courseLessons.find((item) => item.id === card.lessonId)
    : lesson;

  return (
    <section
      className="course-mission"
      aria-label="学習ミッション"
      data-mission-mode={lesson ? "lesson" : "mix"}
      data-card-kind={card?.kind ?? "summary"}
      data-purpose={purpose}
      data-exercise-id={question?.id}
      data-lesson-id={card?.lessonId ?? lesson?.id}
      data-explore-id={card?.kind === "explore" ? card.item.id : undefined}
      data-step-index={index}
      data-conversation-mode={
        card?.kind === "conversation" ? card.mode : undefined
      }
    >
      <div className="mission-topline">
        <Link href="/play" className="text-link">
          <Flag size={17} />
          冒険マップへ
        </Link>
        <span className="mission-counter">
          {finished
            ? "ひと区切り！"
            : index >= baseCount
              ? "仕上げの練習"
              : `${index + 1} / ${baseCount} カード`}
        </span>
      </div>
      <progress
        className="mission-progress"
        aria-label="本編カードの進み具合"
        value={Math.min(index, baseCount)}
        max={baseCount}
      />
      <div className="mission-context">
        <span>
          {conversation?.title ?? lesson?.title ?? "おまかせミックス"}
        </span>
        {chain >= 2 && !finished && (
          <span className="mission-chain">
            <Sparkles size={16} />
            クイズで{chain}問連続正解
          </span>
        )}
      </div>
      {!finished && (
        <p className="mission-disclosure">
          教材案・専門家レビュー前。音声は端末の合成音声（未監修）で、提供元と通信する場合があります。
        </p>
      )}
      {!finished ? (
        <>
          <div className="mission-card-heading">
            <span
              className={`mission-kind mission-kind-${purpose ?? card.kind}`}
            >
              {card.kind === "conversation" ? (
                <MessagesSquare size={19} />
              ) : card.kind === "word-builder" ? (
                <Layers2 size={19} />
              ) : card.kind === "learn" ? (
                <Sparkles size={19} />
              ) : card.kind === "explore" ? (
                <Layers2 size={19} />
              ) : (
                <RotateCcw size={19} />
              )}
              {badge}
            </span>
            {card.kind === "question" &&
              card.lessonId !== lesson?.id &&
              sourceLesson && (
                <p className="mission-disclosure">
                  この問題のレッスン：{sourceLesson.title}
                </p>
              )}
            <h1
              id={question ? "exercise-prompt" : undefined}
              ref={heading}
              tabIndex={-1}
              className="mission-title"
            >
              {card.kind === "conversation"
                ? card.unit.objective
                : card.kind === "word-builder"
                  ? card.builder.step.goal
                  : card.kind === "learn"
                    ? "小さな発見を、ひとつ。"
                    : card.kind === "explore"
                      ? "めくって、確かめよう。"
                      : question?.prompt}
            </h1>
          </div>
          {card.kind === "conversation" && (
            <CourseDialogueCard
              key={card.id}
              unit={card.unit}
              mode={card.mode}
              onComplete={() => {
                if (
                  activeCardId.current !== card.id ||
                  completedDialogues.current.has(card.id)
                )
                  return;
                completedDialogues.current.add(card.id);
                setDialogueDone(true);
                setDialogueCount((value) => value + 1);
              }}
            />
          )}
          {card.kind === "learn" && (
            <LearningBlockCard
              key={card.id}
              block={card.block}
              number={card.number}
            />
          )}
          {card.kind === "word-builder" && (
            <CourseWordBuilderCard
              key={card.id}
              builder={card.builder}
              onComplete={() => {
                if (
                  activeCardId.current !== card.id ||
                  completedBuilders.current.has(card.id)
                )
                  return;
                completedBuilders.current.add(card.id);
                setBuilderDone(true);
                setBuilderCount((value) => value + 1);
              }}
            />
          )}
          {card.kind === "explore" && (
            <div className="surface mission-explore" key={card.id}>
              {isThaiSpeechText(card.item.thai) ? (
                <button
                  type="button"
                  className="mission-sound-tile thai"
                  lang="th"
                  aria-label={`${card.item.thai} を聞く`}
                  onClick={() => exploreAudio.current?.play(card.item.thai)}
                >
                  <span>{card.item.thai}</span>
                  <Volume2 size={25} aria-hidden="true" />
                </button>
              ) : (
                <div className="mission-sound-tile thai" lang="th">
                  {card.item.thai}
                </div>
              )}
              {isThaiSpeechText(card.item.thai) && (
                <SpeakButton
                  ref={exploreAudio}
                  text={card.item.thai}
                  label="もう一度聞く"
                />
              )}
              <div className="mission-flip">
                {revealed ? (
                  <div className="mission-reveal">
                    <strong>{card.item.meaning}</strong>
                    <p className="ipa">{card.item.ipa}</p>
                    <p>{card.item.note}</p>
                    <ExampleVisual example={card.item} />
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setRevealed(true)}>
                    <Layers2 size={18} />
                    意味をめくる
                  </Button>
                )}
              </div>
            </div>
          )}
          {card.kind === "question" && question && (
            <div className="surface mission-question">
              <ExerciseInput
                key={card.id}
                exercise={question}
                response={response}
                onChange={setResponse}
                disabled={Boolean(feedback)}
                answeredCorrect={feedback?.correct}
              />
              {feedback && (
                <div
                  className={`mission-feedback ${feedback.correct ? "is-correct" : "is-retry"}`}
                  role="status"
                >
                  {feedback.correct ? (
                    <CircleCheck size={24} aria-hidden="true" />
                  ) : (
                    <Leaf size={24} aria-hidden="true" />
                  )}
                  <div>
                    <h2>
                      {feedback.correct
                        ? "そのとおり！"
                        : "だいじょうぶ、ここで確認。"}
                    </h2>
                    {!feedback.correct && (
                      <p className="mission-correct-answer">
                        正しい答え：
                        {
                          question.options.find(
                            (option) => option.id === question.answerId,
                          )?.label
                        }
                      </p>
                    )}
                    <p>{question.explanation}</p>
                    {!feedback.correct && purpose !== "retry" && (
                      <small>
                        あとで、もう一度出会えるチャンスがあります。
                      </small>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mission-actions">
            {sourceLesson && (
              <Link
                href={`/lessons/${sourceLesson.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                <BookOpen size={17} />
                教科書を見る<span className="sr-only">（新しいタブ）</span>
              </Link>
            )}
            {card.kind === "question" && !feedback ? (
              <Button size="lg" disabled={!pending} onClick={checkAnswer}>
                答えを確認
                <Check size={18} />
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={
                  (card.kind === "explore" && !revealed) ||
                  (card.kind === "conversation" && !dialogueDone) ||
                  (card.kind === "word-builder" && !builderDone)
                }
                onClick={advance}
              >
                次のカードへ
                <ArrowRight size={18} />
              </Button>
            )}
          </div>
          <p className="mission-footnote">
            教材案・専門家レビュー前。
            {card.kind === "word-builder" || (purpose && purpose !== "core")
              ? "この問題は気軽な反復練習です。確認5問の初回成績やXPは変わりません。"
              : "途中で閉じると、この回は最初からになります。"}
          </p>
        </>
      ) : (
        <>
          <div className="surface mission-summary">
            {celebrating && <LessonCelebration />}
            <div className="mission-trophy">
              {result?.passed ? <Trophy size={48} /> : <Flag size={48} />}
            </div>
            <h1 className="mission-title" ref={heading} tabIndex={-1}>
              {!lesson
                ? "ミックス練習、おつかれさま！"
                : result
                  ? result.passed
                    ? "ミッションクリア！"
                    : "もう一度、確かめよう"
                  : "ミッションを走りきった！"}
            </h1>
            <p>
              {!lesson
                ? "前の冒険で出会ったことばに、また会えました。"
                : result?.passed
                  ? "次の冒険につながる、一歩です。"
                  : "思い出すたびに、少しずつ慣れていきます。"}
            </p>
            <div className="mission-summary-stats">
              {dialogueCount > 0 && (
                <div>
                  <strong>{dialogueCount}</strong>
                  <span>会話を練習したラウンド</span>
                </div>
              )}
              {builderCount > 0 && (
                <div>
                  <strong>{builderCount}</strong>
                  <span>ことばを組み立てた回数</span>
                </div>
              )}
              {lesson && (
                <div>
                  <strong>
                    {correct} / {lesson.exercises.length}
                  </strong>
                  <span>確認5問の初回正解</span>
                </div>
              )}
              <div>
                <strong>{practiceCount}</strong>
                <span>反復で答えた回数</span>
              </div>
              {result && (
                <div>
                  <strong>+{result.earnedXp} XP</strong>
                  <span>{result.earnedXp ? "今回の獲得XP" : "追加XPなし"}</span>
                </div>
              )}
            </div>
            {lesson && (
              <p className="mission-result-note">
                確認5問の初回回答で4問以上正解するとクリア。復習・もう一度の問題は、この成績には含めません。XPは初回クリア時だけ獲得できます。
              </p>
            )}
            {!lesson && (
              <p className="mission-result-note">
                気軽な反復練習です。学習記録や単語の復習予定は変わりません。XPの加算はありません。
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="mission-summary-actions">
              {lesson && !result && (
                <Button size="lg" onClick={recordResult}>
                  結果を記録する
                  <Check size={18} />
                </Button>
              )}
              {result?.passed && (
                <Button size="lg" asChild>
                  <Link href={next ? `/play/${next.id}` : "/play/mix"}>
                    {next ? "次のミッションへ" : "ミックス練習へ"}
                    <ArrowRight size={18} />
                  </Link>
                </Button>
              )}
              {(!lesson || result) && (
                <Button variant="outline" onClick={restart}>
                  <RotateCcw size={18} />
                  {lesson ? "もう一度チャレンジ" : "新しい組み合わせでもう一度"}
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link href="/play">マップに戻る</Link>
              </Button>
            </div>
            {result && (
              <p className="mission-footnote" role="status">
                {storageMessage
                  ? "保存について、画面上部のお知らせを確認してください。"
                  : "このブラウザに学習の記録を保存しました。"}
              </p>
            )}
          </div>
          {result?.passed && <CompletionRewards baseline={baseline} />}
          {lesson && (
            <section className="surface mission-takeaway">
              <h2>
                <Sparkles size={20} />
                今回の持ち帰り
              </h2>
              <ul>
                {lesson.summary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="text-link" href={`/lessons/${lesson.id}`}>
                <BookOpen size={17} />
                教科書で確かめる
              </Link>
            </section>
          )}
        </>
      )}
    </section>
  );
}

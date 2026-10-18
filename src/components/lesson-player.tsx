"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  Clock3,
  Eye,
  Leaf,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { courseLessons as lessons, getCourseChapter } from "@/data/course";
import type { Lesson } from "@/lib/content-types";
import {
  getNextLesson,
  isLessonUnlocked,
  type ExerciseAttempt,
} from "@/lib/progress";
import { useLearning } from "@/components/learning-provider";
import { SpeakButton } from "@/components/speech-practice";
import { LessonOutputPractice } from "@/components/lesson-output-practice";
import { ExerciseInput } from "@/components/exercise-input";
import { gradeExercise, type ExerciseResponse } from "@/lib/exercise-grading";
import { getLessonOutputTask } from "@/data/lesson-output";
import { isThaiSpeechText } from "@/lib/device-speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const stages = [
  { label: "理解する", english: "LEARN" },
  { label: "確認する", english: "EXPLORE" },
  { label: "練習する", english: "PRACTICE" },
  { label: "振り返る", english: "REVIEW" },
];

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { progress, ready, finishLesson, storageMessage } = useLearning();
  const [stage, setStage] = useState(0);
  const [captureActive, setCaptureActive] = useState(false);
  const [exploreId, setExploreId] = useState(lesson.explore[0].id);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [answers, setAnswers] = useState<ExerciseAttempt[]>([]);
  const [savedResult, setSavedResult] = useState<{
    passed: boolean;
    earnedXp: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saved = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Focus after React commits so screen readers receive the new question.
    if (stage === 2) questionHeading.current?.focus({ preventScroll: true });
    else panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "start" });
  }, [stage, questionIndex]);

  if (!ready)
    return (
      <div className="empty-state" role="status">
        学習の記録を読み込み中です…
      </div>
    );

  if (!isLessonUnlocked(progress, lesson)) {
    return (
      <div className="empty-state surface">
        <LockKeyhole size={34} />
        <p className="eyebrow">ONE STEP AT A TIME</p>
        <h1 className="page-title">まずは、前提レッスンから。</h1>
        <p>
          「{lesson.title}
          」の前に、次のレッスンを完了しましょう。学んだことが次の理解につながります。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {lesson.prerequisites.map((id) => {
            const prerequisite = lessons.find((item) => item.id === id);
            return (
              prerequisite && (
                <Button asChild key={id}>
                  <Link href={`/lessons/${id}`}>
                    {prerequisite.title}
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              )
            );
          })}
        </div>
        <Button asChild variant="ghost">
          <Link href="/roadmap">ロードマップへ戻る</Link>
        </Button>
      </div>
    );
  }

  const question = lesson.exercises[questionIndex];
  const answered = answers.find((answer) => answer.exerciseId === question.id);
  const explored =
    lesson.explore.find((item) => item.id === exploreId) ?? lesson.explore[0];
  const correct = answers.filter((answer) => answer.correct).length;
  const score = Math.round((correct / lesson.exercises.length) * 100);
  const passed = correct >= Math.ceil(lesson.exercises.length * 0.8);
  const completedSession = savedResult?.passed === true;
  const nextLesson = getNextLesson(progress, lessons);
  const completionXp = progress.lessons[lesson.id]?.completedAt ? 0 : lesson.xp;
  const outputTask = getLessonOutputTask(lesson.id);
  const pendingGrade = gradeExercise(question, response);

  function pauseRecordedAudio() {
    panel.current?.querySelectorAll("audio").forEach((audio) => audio.pause());
  }

  function goToStage(index: number) {
    if (index === 3 && answers.length === lesson.exercises.length && !passed)
      recordResult();
    setStage(index);
  }

  function checkAnswer() {
    if (!pendingGrade || answered) return;
    setAnswers((previous) => {
      // Keep the first committed answer, including events arriving in one render.
      if (previous.some((answer) => answer.exerciseId === question.id))
        return previous;
      return [
        ...previous,
        {
          exerciseId: question.id,
          lessonId: lesson.id,
          selectedOptionId: pendingGrade.selectedOptionId,
          correct: pendingGrade.correct,
          attemptedAt: new Date().toISOString(),
        },
      ];
    });
  }

  function recordResult() {
    if (saved.current) return savedResult;
    try {
      const result = finishLesson(lesson, {
        correct,
        total: lesson.exercises.length,
        attempts: answers,
      });
      saved.current = true;
      setSavedResult(result);
      setErrorMessage(null);
      return result;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "結果を記録できませんでした。もう一度お試しください。",
      );
      return null;
    }
  }

  function nextQuestion() {
    if (!answered) return;
    if (questionIndex === lesson.exercises.length - 1) {
      // Failed attempts are useful learning records, even without completion XP.
      if (!passed) recordResult();
      goToStage(3);
    } else {
      setQuestionIndex((index) => index + 1);
      setResponse(null);
    }
  }

  function retryQuiz() {
    setQuestionIndex(0);
    setResponse(null);
    setAnswers([]);
    setSavedResult(null);
    setErrorMessage(null);
    saved.current = false;
    goToStage(2);
  }

  return (
    <div className="lesson-container">
      <Link href="/roadmap" className="back-link">
        <ArrowLeft size={14} /> 学習ロードマップへ
      </Link>
      <header className="lesson-heading">
        <div>
          <p className="eyebrow">
            CHAPTER{" "}
            {String(getCourseChapter(lesson.chapterId)?.number).padStart(
              2,
              "0",
            )}{" "}
            <span className="separator">/</span> LESSON{" "}
            {String(lesson.number).padStart(2, "0")}
          </p>
          <h1 className="page-title">{lesson.title}</h1>
          <p className="page-description">{lesson.subtitle}</p>
        </div>
        <div className="lesson-meta">
          <span>
            <Clock3 size={13} /> 約{lesson.durationMinutes}分
          </span>
          <span>
            <Sparkles size={13} /> {lesson.xp} XP
          </span>
        </div>
      </header>
      <div className="lesson-steps" aria-label="レッスンの段階">
        {stages.map((item, index) => (
          <button
            key={item.english}
            className={cn("lesson-step", stage === index && "active")}
            aria-label={item.label}
            aria-current={stage === index ? "step" : undefined}
            disabled={index === 3 && answers.length !== lesson.exercises.length}
            onClick={() => goToStage(index)}
          >
            <span>{index < stage ? <Check size={12} /> : index + 1}</span>
            <span>
              <small>{item.english}</small>
              <strong>{item.label}</strong>
            </span>
          </button>
        ))}
      </div>
      <div className="lesson-review-note">
        <span>
          {lesson.verification === "unreviewed"
            ? "教材案 · 専門家レビュー前"
            : "資料と限定照合済み"}
        </span>{" "}
        · IPA・語義・声調の監修は未完了です。
        <Link
          href="/characters#content-sources"
          className="underline underline-offset-4"
        >
          出典と確認状況
        </Link>
      </div>
      <div ref={panel} tabIndex={-1} className="outline-none scroll-mt-6">
        {stage === 0 && (
          <>
            <section className="objective-card">
              <h2>
                <Target size={17} /> このレッスンで、できるようになること
              </h2>
              <ul>
                {lesson.objectives.map((objective) => (
                  <li key={objective}>
                    <Check size={13} />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </section>
            <p className="explore-disclaimer">
              例語の再生には端末のタイ語合成音声（未監修）を使います。録音教材ではなく、読み方・声調の自然さは未検証です。タイ語の声がない端末では再生できません。音声提供元への通信が発生する場合があります。
            </p>
            {lesson.blocks.map((block) => (
              <section className="learning-block surface" key={block.id}>
                <h2>{block.title}</h2>
                {block.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                {block.examples && (
                  <div className="example-grid">
                    {block.examples.map((example, index) => (
                      <div key={index} className="example-card">
                        <div className="example-thai thai" lang="th">
                          {example.thai}
                        </div>
                        <div className="ipa">{example.ipa}</div>
                        <div className="meaning">{example.meaning}</div>
                        {example.note && (
                          <p className="example-note">{example.note}</p>
                        )}
                        {isThaiSpeechText(example.thai) && (
                          <SpeakButton text={example.thai} compact />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {block.callout && (
                  <div className="rule-callout">{block.callout}</div>
                )}
              </section>
            ))}
            <div className="lesson-actions">
              <p>読むペースは、自分に合わせて。</p>
              <Button onClick={() => goToStage(1)}>
                文字と音を確認する
                <ArrowRight size={15} />
              </Button>
            </div>
          </>
        )}

        {stage === 1 && (
          <>
            <div className="explore-intro">
              <p className="eyebrow">
                <Eye size={14} /> TAKE A CLOSER LOOK
              </p>
              <h2>見比べると、違いが見えてくる。</h2>
              <p>
                カードを選んで、文字・IPA・意味を確かめましょう。
                <br />
                文字の形と音の仕組みを比較し、対応端末では合成音声も確認できます。
              </p>
            </div>
            <div
              className="explore-grid"
              role="group"
              aria-label="文字と音を比較する"
            >
              {lesson.explore.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "explore-tile",
                    exploreId === item.id && "active",
                  )}
                  aria-pressed={exploreId === item.id}
                  aria-label={`${item.thai} の説明`}
                  aria-controls="explore-detail"
                  onClick={() => setExploreId(item.id)}
                >
                  <span className="thai" lang="th">
                    {item.thai}
                  </span>
                  <span className="ipa">{item.ipa}</span>
                </button>
              ))}
            </div>
            <div
              className="explore-detail surface"
              id="explore-detail"
              aria-live="polite"
            >
              <div className="thai" lang="th">
                {explored.thai}
              </div>
              <div className="ipa">{explored.ipa}</div>
              <h3>{explored.meaning}</h3>
              <p>{explored.note}</p>
              {isThaiSpeechText(explored.thai) ? (
                <SpeakButton
                  key={explored.id}
                  text={explored.thai}
                  disabled={captureActive}
                  beforePlay={pauseRecordedAudio}
                />
              ) : (
                <p className="output-help">
                  これは綴りの模式表記です。下の語の練習で音声を確認できます。
                </p>
              )}
            </div>
            <p className="explore-disclaimer">
              見本は端末の合成音声（未監修）です。声によって読み方が異なります。音声提供元への通信が発生する場合があります。発音・声調の自動採点は行いません。
            </p>
            {outputTask && (
              <LessonOutputPractice
                key={outputTask.id}
                task={outputTask}
                onCaptureChange={setCaptureActive}
              />
            )}
            <div className="lesson-actions">
              <Button variant="ghost" onClick={() => goToStage(0)}>
                <ArrowLeft size={15} /> 解説を読み直す
              </Button>
              <Button onClick={() => goToStage(2)}>
                練習に進む
                <ArrowRight size={15} />
              </Button>
            </div>
          </>
        )}

        {stage === 2 && (
          <section className="quiz-card surface" aria-label="練習問題">
            <div className="quiz-progress">
              <span>
                問題 {questionIndex + 1} / {lesson.exercises.length}
              </span>
              <div
                className="track"
                role="progressbar"
                aria-valuenow={questionIndex}
                aria-valuemin={0}
                aria-valuemax={lesson.exercises.length}
                aria-label="問題の進み具合"
              >
                <span
                  style={{
                    width: `${(questionIndex / lesson.exercises.length) * 100}%`,
                  }}
                />
              </div>
              <span>{correct}問正解</span>
            </div>
            <p className="quiz-kind">
              <BookOpen size={13} />
              {question.type === "character-recognition"
                ? "文字を見分けよう"
                : question.type === "fill-in-the-blank"
                  ? "空欄を埋めよう"
                  : question.type === "word-ordering"
                    ? "語句を並べよう"
                    : "仕組みを確かめよう"}{" "}
              <span className="separator">·</span> 難易度 {question.difficulty}
            </p>
            <h2
              id="exercise-prompt"
              ref={questionHeading}
              tabIndex={-1}
              className="quiz-prompt outline-none"
            >
              {question.prompt}
            </h2>
            <ExerciseInput
              key={question.id}
              exercise={question}
              response={response}
              onChange={setResponse}
              disabled={Boolean(answered)}
              answeredCorrect={answered?.correct}
            />
            {answered && (
              <div
                role="status"
                className={cn("quiz-feedback", !answered.correct && "wrong")}
              >
                {answered.correct ? (
                  <CircleCheck size={22} />
                ) : (
                  <Leaf size={22} />
                )}
                <div>
                  <h3>
                    {answered.correct
                      ? "正解！ その調子です。"
                      : "不正解。理由を確かめてみましょう。"}
                  </h3>
                  {!answered.correct && (
                    <p className="correct-answer">
                      正しい答え：
                      {
                        question.options.find(
                          (option) => option.id === question.answerId,
                        )?.label
                      }
                    </p>
                  )}
                  <p>{question.explanation}</p>
                </div>
              </div>
            )}
            <div className="lesson-actions">
              <p>正答率80%以上で完了。まちがえても大丈夫。</p>
              {answered ? (
                <Button onClick={nextQuestion}>
                  {questionIndex === lesson.exercises.length - 1
                    ? "結果を見る"
                    : "次の問題へ"}
                  <ArrowRight size={15} />
                </Button>
              ) : (
                <Button disabled={!pendingGrade} onClick={checkAnswer}>
                  答えを確認
                  <Check size={15} />
                </Button>
              )}
            </div>
          </section>
        )}

        {stage === 3 && (
          <>
            <section className="review-card surface">
              <span className="score-emblem">
                {completedSession ? (
                  <Trophy size={39} strokeWidth={1.5} />
                ) : passed ? (
                  <CircleCheck size={39} strokeWidth={1.5} />
                ) : (
                  <Leaf size={39} strokeWidth={1.5} />
                )}
              </span>
              <p className="eyebrow justify-center">
                {completedSession ? "ONE MORE STEP FORWARD" : "LET’S LOOK BACK"}
              </p>
              <h2>
                {completedSession
                  ? "レッスン完了！"
                  : passed
                    ? "よくできました。学びを振り返ろう。"
                    : "もう一度、確かめてみよう。"}
              </h2>
              <p>
                {completedSession
                  ? "ひとつの「わかった」が、次の一歩につながります。"
                  : passed
                    ? "今回わかったことを確認して、レッスンを完了しましょう。"
                    : "5問中4問以上で完了です。解説に戻ってから、何度でも挑戦できます。"}
              </p>
              <div className="review-score">
                <div>
                  <strong>{score}%</strong>
                  <span>
                    正答率 · {correct} / {lesson.exercises.length}問
                  </span>
                </div>
                <div>
                  <strong>
                    {completedSession
                      ? `+${savedResult.earnedXp}`
                      : passed
                        ? completionXp
                        : "–"}
                  </strong>
                  <span>
                    {completedSession
                      ? savedResult.earnedXp
                        ? "獲得したXP"
                        : "XP · 再受講は加算なし"
                      : passed
                        ? completionXp
                          ? "初回完了で獲得するXP"
                          : "XP · 再受講は加算なし"
                        : "まだXPは増えません"}
                  </span>
                </div>
              </div>
              {errorMessage && <p role="alert">{errorMessage}</p>}
              <div className="review-actions">
                {completedSession ? (
                  <>
                    <Button asChild>
                      <Link
                        href={
                          nextLesson ? `/lessons/${nextLesson.id}` : "/roadmap"
                        }
                      >
                        {nextLesson ? "次のレッスンへ" : "ロードマップに戻る"}
                        <ArrowRight size={15} />
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={retryQuiz}>
                      <RotateCcw size={14} /> もう一度復習する
                    </Button>
                  </>
                ) : passed ? (
                  <Button onClick={recordResult}>
                    レッスンを完了する
                    <Check size={15} />
                  </Button>
                ) : (
                  <>
                    <Button onClick={retryQuiz}>
                      <RotateCcw size={14} /> もう一度練習する
                    </Button>
                    <Button variant="outline" onClick={() => goToStage(0)}>
                      解説を読み直す
                    </Button>
                  </>
                )}
              </div>
              {completedSession && (
                <p className="save-note">
                  {storageMessage
                    ? "保存できていない可能性があります。画面上部のお知らせを確認してください。"
                    : "このブラウザに学習の記録を保存しました。"}
                </p>
              )}
            </section>
            <section className="review-summary surface">
              <h3>今日の「わかった」を持ち帰ろう。</h3>
              <ul>
                {lesson.summary.map((item) => (
                  <li key={item}>
                    <Check size={14} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
            {answers.some((answer) => !answer.correct) && (
              <details className="review-mistakes surface">
                <summary>
                  まちがえた{answers.filter((answer) => !answer.correct).length}
                  問を、もう一度確かめる
                </summary>
                {lesson.exercises
                  .filter((exercise) =>
                    answers.some(
                      (answer) =>
                        answer.exerciseId === exercise.id && !answer.correct,
                    ),
                  )
                  .map((exercise) => (
                    <article key={exercise.id}>
                      <h3>{exercise.prompt}</h3>
                      <p className="font-medium">
                        正しい答え：
                        {
                          exercise.options.find(
                            (option) => option.id === exercise.answerId,
                          )?.label
                        }
                      </p>
                      <p>{exercise.explanation}</p>
                      <p className="mistake-concepts">
                        関連する学習事項：{exercise.relatedConcepts.join("・")}
                      </p>
                    </article>
                  ))}
                <Button variant="ghost" onClick={() => goToStage(0)}>
                  <BookOpen size={14} /> 解説に戻って確かめる
                </Button>
              </details>
            )}
            <div className="related-lessons">
              <p>つながるレッスン</p>
              {lesson.relatedLessonIds.map((id) => {
                const related = lessons.find((item) => item.id === id);
                if (!related) return null;
                return isLessonUnlocked(progress, related) ? (
                  <Link key={id} href={`/lessons/${id}`}>
                    {related.title}
                  </Link>
                ) : (
                  <span key={id}>{related.title}（前提の完了後）</span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

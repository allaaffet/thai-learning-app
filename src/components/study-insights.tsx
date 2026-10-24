"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookCheck,
  CalendarClock,
  Check,
  CheckCheck,
  CircleHelp,
  ListChecks,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { useLearning } from "@/components/learning-provider";
import { useReview } from "@/components/review-provider";
import { useLocalClock } from "@/components/review-summary";
import { courseLessons } from "@/data/course";
import { getLearningInsights } from "@/lib/learning-insights";
import { isLessonUnlocked } from "@/lib/progress";
import { getReviewStats } from "@/lib/review";

export function StudyInsights() {
  const { progress, ready } = useLearning();
  const review = useReview();
  const now = useLocalClock();
  if (!ready || !review.ready || !now)
    return <p role="status">振り返りを読み込み中です…</p>;
  const insights = getLearningInsights(progress, courseLessons, now);
  const stats = getReviewStats(review.state, now);
  const activityMaximum = Math.max(
    1,
    ...insights.activity.map((day) => day.answered),
  );
  const reviewMetrics = [
    {
      label: "登録した語",
      value: stats.totalCards,
      unit: "語",
      icon: BookCheck,
    },
    {
      label: "復習の期限が来た語",
      value: stats.dueCount,
      unit: "語",
      icon: CalendarClock,
    },
    {
      label: "これまでの復習",
      value: stats.reviewCount,
      unit: "回",
      icon: RotateCcw,
    },
    {
      label: "間隔が7日以上の語",
      value: stats.expandedCount,
      unit: "語",
      icon: TrendingUp,
    },
  ];
  return (
    <section
      className="phase4-insights visual-insights"
      aria-label="詳しい学習記録"
    >
      <div>
        <p className="eyebrow">FIND YOUR NEXT STEP</p>
        <h2 className="text-xl font-semibold">次の一歩が、見えてくる。</h2>
        <p className="muted mt-2">
          学習の記録から、復習するところを見つけましょう。
        </p>
      </div>
      <div className="phase4-insight-grid">
        <article className="surface p-5">
          <h3 className="insight-heading">
            <Target size={21} aria-hidden="true" />
            もう一度確かめたいこと
          </h3>
          <div className="insight-accuracy">
            <p>
              {insights.questionCount}問中、正答率{" "}
              {insights.latestAccuracy === null
                ? "記録なし"
                : `${insights.latestAccuracy}%`}
            </p>
            {insights.latestAccuracy !== null ? (
              <div className="insight-meter" aria-hidden="true">
                <span style={{ width: `${insights.latestAccuracy}%` }} />
              </div>
            ) : (
              <span className="insight-no-record">
                <CircleHelp size={16} aria-hidden="true" />
                解答すると表示されます
              </span>
            )}
          </div>
          {insights.weakConcepts.length ? (
            <ul className="insight-concepts">
              {insights.weakConcepts.map((item) => (
                <li key={item.concept}>
                  <div className="insight-concept-label">
                    <p className="font-medium">{item.concept}</p>
                    <span>
                      {item.correct}/{item.total}問 正解
                    </span>
                  </div>
                  <div
                    className="insight-meter insight-concept-meter"
                    aria-hidden="true"
                  >
                    <span
                      style={{ width: `${(item.correct / item.total) * 100}%` }}
                    />
                  </div>
                  <div className="insight-concept-links">
                    {item.lessonIds.map((id) => {
                      const lesson = courseLessons.find(
                        (entry) => entry.id === id,
                      );
                      if (!lesson) return null;
                      const unlocked = isLessonUnlocked(progress, lesson);
                      return (
                        <Link
                          className="text-link"
                          key={id}
                          href={unlocked ? `/lessons/${id}` : "/roadmap"}
                        >
                          {lesson.title}
                          {!unlocked && "（前提を確認）"}
                          <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="insight-clear-state">
              <CheckCheck size={27} aria-hidden="true" />
              <p>
                {insights.questionCount
                  ? "いまの記録に誤答はありません。"
                  : "最初のレッスンから始めましょう。"}
              </p>
            </div>
          )}
          <details className="insight-note">
            <summary>正答率の見方</summary>
            <p>
              各問題の最新の確定回答で集計します。未回答の問題の理解度は含みません。XP・復習の自己評価とは別の指標です。
            </p>
          </details>
        </article>
        <article className="surface p-5">
          <h3 className="insight-heading">
            <RotateCcw size={21} aria-hidden="true" />
            単語の復習記録
          </h3>
          <dl className="phase4-insight-metrics">
            {reviewMetrics.map((metric) => (
              <div key={metric.label}>
                <dt>
                  <metric.icon size={18} aria-hidden="true" />
                  {metric.label}
                </dt>
                <dd>
                  {metric.value}
                  <small>{metric.unit}</small>
                </dd>
              </div>
            ))}
          </dl>
          <details className="insight-note">
            <summary>復習予定について</summary>
            <p>
              自己評価で設定した予定です。間隔の長さは習熟度の保証ではありません。
            </p>
          </details>
          {review.storageMessage && (
            <p role="status" className="storage-notice">
              {review.storageMessage}
            </p>
          )}
          <Link href="/review" className="text-link insight-review-link">
            単語の復習へ
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </article>
      </div>
      <article className="surface p-5">
        <div className="insight-activity-heading">
          <h3 className="insight-heading">
            <ListChecks size={21} aria-hidden="true" />
            直近7日の活動
          </h3>
          <span>解答数</span>
        </div>
        <div className="phase4-week visual-week">
          {insights.activity.map((day) => (
            <div key={day.day}>
              <strong>
                {day.answered}
                <small>問</small>
              </strong>
              <div className="activity-bar-track" aria-hidden="true">
                <span
                  className={
                    day.answered ? "activity-bar" : "activity-bar is-zero"
                  }
                  style={{
                    height: `${(day.answered / activityMaximum) * 100}%`,
                  }}
                />
              </div>
              <time dateTime={day.day}>
                {day.day.slice(5).replace("-", "/")}
              </time>
              <span
                className={`activity-day-dot${day.studied ? " is-studied" : ""}`}
                role="img"
                aria-label={day.studied ? "受講記録あり" : "受講記録なし"}
              />
            </div>
          ))}
        </div>
        <div className="activity-legend">
          <span>
            <i className="activity-day-dot is-studied" aria-hidden="true" />
            受講記録あり
          </span>
          <span>
            <i className="activity-day-dot" aria-hidden="true" />
            受講記録なし
          </span>
        </div>
        <details className="insight-note">
          <summary>活動の数え方</summary>
          <p>
            終了した受講の初回確定回答を数えます。0問は、このブラウザに記録された解答がない日です。途中の練習・録音・実測学習時間は含みません。記録の読み込み中はグラフを表示しません。
          </p>
        </details>
      </article>
      <article className="surface p-5">
        <h3 className="insight-heading">
          <BookCheck size={21} aria-hidden="true" />
          直近の解答
        </h3>
        {insights.recentAnswers.length ? (
          <ul className="insight-recent-answers">
            {insights.recentAnswers.map((answer, index) => (
              <li key={`${answer.attemptedAt}-${answer.exerciseId}-${index}`}>
                <span
                  className={`insight-answer-mark ${answer.correct ? "is-correct" : ""}`}
                  aria-label={answer.correct ? "正解" : "要確認"}
                >
                  {answer.correct ? (
                    <Check size={19} aria-hidden="true" />
                  ) : (
                    <RotateCcw size={18} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <p className="insight-answer-status">
                    {answer.correct ? "正解" : "要確認"}
                  </p>
                  <p className="font-medium">{answer.exercise.prompt}</p>
                  <p className="insight-answer-meta">
                    {answer.lesson.title} ·{" "}
                    {new Date(answer.attemptedAt).toLocaleString("ja-JP")}
                  </p>
                  <Link
                    href={`/lessons/${answer.lesson.id}`}
                    className="text-link"
                  >
                    理由をレッスンで確認
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3">レッスンを終えると、解答がここに並びます。</p>
        )}
      </article>
    </section>
  );
}

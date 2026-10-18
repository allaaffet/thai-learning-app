"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  return (
    <section className="phase4-insights" aria-label="詳しい学習記録">
      <div>
        <p className="eyebrow">FIND YOUR NEXT STEP</p>
        <h2 className="text-xl font-semibold">次の一歩が、見えてくる。</h2>
        <p className="muted mt-2">
          終了した受講の記録から振り返ります。XP・自己評価・クイズの正答率は別の指標です。
        </p>
      </div>
      <div className="phase4-insight-grid">
        <article className="surface p-5">
          <h3 className="font-semibold">もう一度確かめたいこと</h3>
          <p className="muted my-3 text-sm">
            各問題の最新の確定回答で集計します。{insights.questionCount}
            問中、正答率{" "}
            {insights.latestAccuracy === null
              ? "記録なし"
              : `${insights.latestAccuracy}%`}
            。
          </p>
          {insights.weakConcepts.length ? (
            <ul className="space-y-4">
              {insights.weakConcepts.map((item) => (
                <li key={item.concept}>
                  <p className="font-medium">
                    {item.concept}
                    <span className="muted ml-2 text-xs">
                      {item.correct}/{item.total}問 正解
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {item.lessonIds.map((id) => {
                      const lesson = courseLessons.find(
                        (entry) => entry.id === id,
                      );
                      if (!lesson) return null;
                      const unlocked = isLessonUnlocked(progress, lesson);
                      return (
                        <Link
                          className="text-link text-sm"
                          key={id}
                          href={unlocked ? `/lessons/${id}` : "/roadmap"}
                        >
                          {lesson.title}
                          {!unlocked && "（前提を確認）"}
                          <ArrowRight size={12} aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              いまの記録に誤答はありません。未回答の問題の理解度を示すものではありません。
            </p>
          )}
        </article>
        <article className="surface p-5">
          <h3 className="font-semibold">単語の復習記録</h3>
          <dl className="phase4-insight-metrics">
            <div>
              <dt>登録した語</dt>
              <dd>{stats.totalCards}語</dd>
            </div>
            <div>
              <dt>復習の期限が来た語</dt>
              <dd>{stats.dueCount}語</dd>
            </div>
            <div>
              <dt>これまでの復習</dt>
              <dd>{stats.reviewCount}回</dd>
            </div>
            <div>
              <dt>間隔が7日以上の語</dt>
              <dd>{stats.expandedCount}語</dd>
            </div>
          </dl>
          <p className="muted my-3 text-sm">
            自己評価で設定した予定です。間隔の長さは習熟度の保証ではありません。
          </p>
          {review.storageMessage && (
            <p role="status" className="storage-notice">
              {review.storageMessage}
            </p>
          )}
          <Link href="/review" className="text-link">
            単語の復習へ
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>
      </div>
      <article className="surface p-5">
        <h3 className="font-semibold">直近7日の活動</h3>
        <div className="phase4-week">
          {insights.activity.map((day) => (
            <div key={day.day}>
              <time dateTime={day.day}>
                {day.day.slice(5).replace("-", "/")}
              </time>
              <strong>
                {day.answered}
                <small>問</small>
              </strong>
              <span>{day.studied ? "受講記録あり" : "受講記録なし"}</span>
            </div>
          ))}
        </div>
        <p className="muted mt-3 text-xs">
          終了した受講の初回確定回答を数えます。途中の練習・録音・実測学習時間は含みません。
        </p>
      </article>
      <article className="surface p-5">
        <h3 className="font-semibold">直近の解答</h3>
        {insights.recentAnswers.length ? (
          <ul className="divide-y divide-[var(--line)]">
            {insights.recentAnswers.map((answer, index) => (
              <li
                key={`${answer.attemptedAt}-${answer.exerciseId}-${index}`}
                className="py-3"
              >
                <span className={`badge ${answer.correct ? "" : "neutral"}`}>
                  {answer.correct ? "正解" : "要確認"}
                </span>
                <p className="my-2 font-medium">{answer.exercise.prompt}</p>
                <p className="muted text-xs">
                  {answer.lesson.title} ·{" "}
                  {new Date(answer.attemptedAt).toLocaleString("ja-JP")}
                </p>
                <Link
                  href={`/lessons/${answer.lesson.id}`}
                  className="text-link mt-2 text-sm"
                >
                  理由をレッスンで確認
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3">
            レッスンを受講すると、解答の記録がここに表示されます。
          </p>
        )}
      </article>
    </section>
  );
}

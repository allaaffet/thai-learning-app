"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Flag,
  Footprints,
  Gem,
  Layers3,
  Leaf,
  LockKeyhole,
  Map,
  Puzzle,
  RotateCcw,
  Sparkles,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { courseLessons } from "@/data/course";
import { useLearning } from "@/components/learning-provider";
import { useReview } from "@/components/review-provider";
import { useLocalClock } from "@/components/review-summary";
import { useGameProgress } from "@/components/use-game-progress";
import { Button } from "@/components/ui/button";
import { getNextLesson } from "@/lib/progress";
import { getReviewStats } from "@/lib/review";
import type { GameMilestone } from "@/lib/gamification";

const questIcons: Record<string, LucideIcon> = {
  lesson: BookOpen,
  answers: Puzzle,
  review: RotateCcw,
};

const badgeIcons: Record<string, LucideIcon> = {
  "first-lesson": Sprout,
  "five-lessons": Footprints,
  "first-chapter": Flag,
  "three-days": Leaf,
  "seven-days": Gem,
  "first-review": RotateCcw,
  "ten-reviews": Layers3,
  "course-complete": Map,
};

function MilestoneMeter({ milestone }: { milestone: GameMilestone }) {
  return (
    <div
      className="game-milestone-meter"
      role="progressbar"
      aria-label={`${milestone.title}の進み具合`}
      aria-valuemin={0}
      aria-valuemax={milestone.target}
      aria-valuenow={milestone.current}
      aria-valuetext={`${milestone.current} / ${milestone.target}${milestone.done ? " 達成" : ""}`}
    >
      <span style={{ width: `${milestone.percent}%` }} />
    </div>
  );
}

export function ExperienceMeter({ compact = false }: { compact?: boolean }) {
  const { game, ready } = useGameProgress();
  const experience = ready ? game?.experience : undefined;
  return (
    <section
      className={`surface experience-card${compact ? " is-compact" : ""}`}
      aria-label="経験レベル"
    >
      <div className="experience-card-heading">
        <span className="game-heading-icon" aria-hidden="true">
          <Sparkles size={21} />
        </span>
        <h2>経験レベル</h2>
      </div>
      <div className="experience-card-body">
        <div className="experience-medallion">
          <span aria-hidden="true">Lv.</span>
          <strong data-testid="experience-level">
            {experience?.level ?? "—"}
          </strong>
          <Sparkles className="experience-spark" size={19} aria-hidden="true" />
        </div>
        <div className="experience-details">
          <p className="experience-total" data-testid="experience-xp">
            {experience ? `${experience.xp} XP` : "— XP"}
          </p>
          <p className="experience-next">
            {experience ? (
              experience.isMax ? (
                <>
                  <Trophy size={17} aria-hidden="true" /> コースのXPゴール達成！
                </>
              ) : (
                <>
                  次のレベルまで <strong>{experience.remainingXp} XP</strong>
                </>
              )
            ) : (
              <span role="status">経験値を読み込み中…</span>
            )}
          </p>
          {experience && (
            <div
              className="game-milestone-meter experience-meter"
              role="progressbar"
              aria-label={
                experience.isMax
                  ? "コースのXPゴール達成度"
                  : "次の経験レベルまでの進み具合"
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={experience.percent}
            >
              <span style={{ width: `${experience.percent}%` }} />
            </div>
          )}
        </div>
      </div>
      <details className="game-explanation">
        <summary>
          経験レベルとは <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <p>
          初回のレッスン完了で獲得したXPの積み重ねです。タイ語の習熟度とは別の目安です。再受講や単語の復習で追加XPは増えません。
        </p>
      </details>
    </section>
  );
}

export function DailyQuestBoard() {
  const { game, ready } = useGameProgress();
  const { progress } = useLearning();
  const review = useReview();
  const now = useLocalClock();
  const reviewStats =
    review.ready && now ? getReviewStats(review.state, now) : undefined;
  const hasReviewCards = Boolean(reviewStats?.totalCards);
  const next = getNextLesson(progress, courseLessons);
  const lessonHref = next ? `/lessons/${next.id}` : "/roadmap";
  const quests = ready ? game?.quests : undefined;
  return (
    <section className="game-quest-board" aria-label="今日のクエスト">
      <div className="game-section-heading">
        <div>
          <span className="game-section-kicker">
            <Flag size={16} aria-hidden="true" /> できる分だけ、ひとつずつ。
          </span>
          <h2>今日のクエスト</h2>
        </div>
        <span className="game-quest-total">
          <Check size={17} aria-hidden="true" />
          {quests ? `${game?.completedQuestCount} / ${quests.length}` : "— / 3"}
          <span>クリア</span>
        </span>
      </div>
      {quests ? (
        <div className="game-quest-grid">
          {quests.map((quest) => {
            const Icon = questIcons[quest.id] ?? Flag;
            const waitingForReview =
              quest.id === "review" &&
              hasReviewCards &&
              reviewStats?.dueCount === 0 &&
              !quest.done;
            return (
              <article
                className={`game-quest-card quest-${quest.id}${quest.done ? " is-complete" : ""}`}
                data-testid={`quest-${quest.id}`}
                data-state={quest.done ? "complete" : "active"}
                key={quest.id}
              >
                <div className="game-quest-card-top">
                  <span className="game-quest-icon" aria-hidden="true">
                    <Icon size={26} />
                  </span>
                  <span
                    className={`game-quest-state${quest.done ? " is-complete" : ""}`}
                  >
                    {quest.done ? (
                      <>
                        <Check size={15} aria-hidden="true" />
                        クリア
                      </>
                    ) : (
                      "挑戦中"
                    )}
                  </span>
                </div>
                <h3>{quest.title}</h3>
                <div className="game-quest-progress">
                  <MilestoneMeter milestone={quest} />
                  <strong>
                    {quest.current}
                    <span> / {quest.target}</span>
                  </strong>
                </div>
                {waitingForReview && (
                  <p className="game-quest-waiting">予定が来たら取り組めます</p>
                )}
                <Button
                  asChild
                  variant={quest.done ? "ghost" : "outline"}
                  size="sm"
                >
                  <Link
                    href={
                      quest.id === "review"
                        ? hasReviewCards
                          ? "/review"
                          : "/vocabulary"
                        : lessonHref
                    }
                  >
                    {quest.id === "review"
                      ? !hasReviewCards
                        ? "単語を選ぶ"
                        : waitingForReview
                          ? "復習の予定を見る"
                          : "復習へ"
                      : quest.id === "answers"
                        ? "クイズに挑戦"
                        : "学びを進める"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="surface game-loading" role="status">
          今日のクエストを読み込み中…
        </p>
      )}
      <details className="game-explanation game-quest-help">
        <summary>
          クエストの数え方 <ChevronDown size={15} aria-hidden="true" />
        </summary>
        {quests?.map((quest) => (
          <p key={quest.id}>
            <strong>{quest.title}：</strong>
            {quest.description}
          </p>
        ))}
        <p>
          正誤に関係なく取り組みを数え、日付が変わると今日の進み具合を切り替えます。クエストに追加XPや学習を進める条件はありません。
        </p>
      </details>
    </section>
  );
}

export function AchievementCollection({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { game, ready } = useGameProgress();
  const badges = ready ? game?.badges : undefined;
  const displayed = compact ? badges?.slice(0, 4) : badges;
  return (
    <section
      className={`game-achievements${compact ? " is-compact" : ""}`}
      id={compact ? undefined : "achievements"}
      aria-label="達成バッジ"
    >
      <div className="game-section-heading">
        <div>
          <span className="game-section-kicker">
            <Award size={17} aria-hidden="true" /> 取り組みが、コレクションに。
          </span>
          <h2>達成バッジ</h2>
        </div>
        <span className="game-badge-total">
          <Trophy size={18} aria-hidden="true" />
          {badges ? `${game?.unlockedBadgeCount} / ${badges.length}` : "— / 8"}
          <span>獲得</span>
        </span>
      </div>
      {displayed ? (
        <div className="game-badge-grid">
          {displayed.map((badge) => {
            const Icon = badgeIcons[badge.id] ?? Award;
            return (
              <details
                className={`game-badge-card${badge.done ? " is-earned" : ""}`}
                data-testid={`badge-${badge.id}`}
                data-state={badge.done ? "unlocked" : "locked"}
                data-earned={badge.done ? "true" : "false"}
                key={badge.id}
              >
                <summary>
                  <span className="game-badge-icon" aria-hidden="true">
                    <Icon size={31} />
                    {badge.done && (
                      <span>
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <span className="game-badge-title">{badge.title}</span>
                  <span className="game-badge-state">
                    {badge.done ? (
                      <>
                        <Check size={13} aria-hidden="true" />
                        獲得済み
                      </>
                    ) : (
                      <>
                        <LockKeyhole size={13} aria-hidden="true" />
                        これから
                      </>
                    )}
                  </span>
                  <ChevronDown
                    size={15}
                    className="game-badge-chevron"
                    aria-hidden="true"
                  />
                </summary>
                <div className="game-badge-condition">
                  <p>{badge.description}</p>
                  <MilestoneMeter milestone={badge} />
                  <p className="game-badge-count">
                    {badge.current} / {badge.target}
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="surface game-loading" role="status">
          達成バッジを読み込み中…
        </p>
      )}
      <div className="game-badge-footer">
        <span>バッジを開くと、獲得条件を確認できます。</span>
        {compact && (
          <Link href="/progress#achievements" className="text-link">
            すべてのバッジを見る <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

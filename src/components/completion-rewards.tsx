"use client";

import { Award, Flag, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useGameProgress } from "@/components/use-game-progress";

export interface RewardBaseline {
  level: number;
  badgeIds: readonly string[];
}

/** Only mounted by an explicit lesson/review completion, never by loading a page. */
export function CompletionRewards({
  baseline,
}: {
  baseline: RewardBaseline | null;
}) {
  const { game } = useGameProgress();
  if (!game || !baseline) return null;
  const badges = game.badges.filter(
    (badge) => badge.done && !baseline.badgeIds.includes(badge.id),
  );
  const levelUp = game.experience.level > baseline.level;
  return (
    <section
      className="completion-rewards"
      aria-label="今回の達成"
      aria-live="polite"
    >
      <div className={`reward-experience ${levelUp ? "is-level-up" : ""}`}>
        <span className="reward-symbol" aria-hidden="true">
          <Sparkles size={24} />
        </span>
        <div>
          <span className="reward-label">
            {levelUp ? "経験レベルアップ！" : "積み重ねた経験"}
          </span>
          <strong>経験レベル {game.experience.level}</strong>
          <p>
            {game.experience.isMax
              ? "このコースのXPゴールに到達！"
              : `次の経験レベルまで ${game.experience.remainingXp} XP`}
          </p>
        </div>
      </div>
      {badges.length > 0 && (
        <div className="reward-new-badges">
          <h3>
            <Trophy size={19} aria-hidden="true" />
            バッジ獲得！
          </h3>
          <ul>
            {badges.map((badge) => (
              <li key={badge.id}>
                <Award size={24} aria-hidden="true" />
                <div>
                  <strong>{badge.title}</strong>
                  <span>{badge.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="reward-quest-summary">
        <Flag size={18} aria-hidden="true" />
        <span>
          今日のクエスト{" "}
          <strong>
            {game.completedQuestCount} / {game.quests.length}
          </strong>
        </span>
        <Link href="/">クエストを見る</Link>
      </div>
    </section>
  );
}

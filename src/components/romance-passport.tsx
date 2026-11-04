import { BookOpen, Check, Compass, Heart, Sparkles } from "lucide-react";
import { journeyChapters } from "@/data/romance-journey";
import {
  getJourneyKeepsakes,
  getJourneyLearningProgress,
  getJourneyStoryChoice,
  hasCurrentRomanceDialogue,
  type RomanceLearningState,
} from "@/lib/romance-journey";
import type { RomanceCharacter } from "@/lib/romance-types";
import type { RomanceSetting } from "@/lib/romance-setting";

export function RomancePassport({
  setting = "city",
  character,
  state,
}: {
  setting?: RomanceSetting;
  character: RomanceCharacter;
  state: RomanceLearningState;
}) {
  const practiced = journeyChapters.filter((chapter) =>
    hasCurrentRomanceDialogue(
      getJourneyLearningProgress(state, character.id, chapter.episodeId),
    ),
  ).length;
  const keepsakes = getJourneyKeepsakes(state, character.id, setting);
  return (
    <>
      <section
        className="rjp-passport surface"
        aria-label="会話のパスポート"
        data-testid="romance-passport"
      >
        <div className="rjp-section-heading">
          <span className="rjp-heading-icon">
            <Compass size={24} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">CONVERSATION PASSPORT</p>
            <h2>ひと言から、会話をつなぐ。</h2>
          </div>
          <span className="rjp-total">
            {practiced}
            <small> / 5 場面</small>
          </span>
        </div>
        <p>
          挨拶から、また会う約束へ。相手への気持ちを伝えながら、前の出会いのひと言も思い出します。
        </p>
        <ol className="rjp-goals">
          {journeyChapters.map((chapter) => {
            const entry = getJourneyLearningProgress(
              state,
              character.id,
              chapter.episodeId,
            );
            const selectedStory = getJourneyStoryChoice(
              state,
              character.id,
              chapter.episodeId,
              setting,
            );
            const current = hasCurrentRomanceDialogue(entry);
            return (
              <li key={chapter.episodeId} data-practiced={current}>
                <span className="rjp-goal-number">
                  {current ? (
                    <Check size={20} aria-label="練習した" />
                  ) : (
                    chapter.level
                  )}
                </span>
                <strong>{chapter.skillTitle}</strong>
                <p>{chapter.canDo}</p>
                <span className="rjp-goal-state">
                  {current
                    ? "練習した"
                    : entry
                      ? "以前の会話の記録"
                      : "これから"}
                </span>
                {entry && !current && (
                  <p>新しい恋愛の表現は、これから練習できます。</p>
                )}
                {entry && (
                  <details>
                    <summary>
                      {current ? "直近の練習を見る" : "以前の練習を見る"}
                    </summary>
                    <p>
                      会話 {entry.last.coreCorrect} / {entry.last.coreTotal}{" "}
                      問・組立 {entry.last.buildCorrect} /{" "}
                      {entry.last.buildTotal} 問
                    </p>
                    {entry.last.recallTotal > 0 && (
                      <p>
                        以前の会話の想起 {entry.last.recallCorrect} /{" "}
                        {entry.last.recallTotal} 問
                      </p>
                    )}
                    <p>
                      追加ヒントを開いた問題 {entry.last.hints} 問。練習{" "}
                      {entry.plays} 回。
                    </p>
                    {selectedStory && (
                      <div className="rjp-story-choice">
                        <strong>直近の物語の選択</strong>
                        <p>{selectedStory.label}</p>
                        <p>{selectedStory.nextHook}</p>
                      </div>
                    )}
                  </details>
                )}
              </li>
            );
          })}
        </ol>
        <p className="rjp-note">
          <BookOpen size={16} aria-hidden="true" />{" "}
          取り組んだ練習の記録です。会話能力や発音の認定ではありません。
        </p>
      </section>
      <section
        className="rjp-keepsakes surface"
        aria-label="ふたりの思い出"
        data-testid="romance-keepsakes"
      >
        <div className="rjp-section-heading">
          <span className="rjp-heading-icon">
            <Heart size={23} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">OUR LITTLE MEMORIES</p>
            <h2>ふたりの思い出</h2>
          </div>
          <span className="rjp-total">
            {keepsakes.length}
            <small> / 10</small>
          </span>
        </div>
        {keepsakes.length ? (
          <ul className="rjp-memory-grid">
            {keepsakes.map((memory) => (
              <li key={memory.id}>
                <Sparkles size={21} aria-hidden="true" />
                <details>
                  <summary>{memory.title}</summary>
                  <p>{memory.detail}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rjp-empty-memories">
            <Sparkles size={27} aria-hidden="true" />
            <p>
              {character.name}と選んだ行き先が、思い出のカードになります。
              <br />
              各話に2つのルート。気になる方から出かけよう。
            </p>
          </div>
        )}
      </section>
    </>
  );
}

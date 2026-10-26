"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  Layers2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExampleVisual } from "@/components/lesson-visuals";
import { SpeakButton } from "@/components/speech-practice";
import type { Lesson } from "@/lib/content-types";
import { isThaiSpeechText } from "@/lib/device-speech";
import {
  advanceLessonRecall,
  createLessonRecallState,
  currentLessonRecallId,
  revealLessonRecall,
} from "@/lib/lesson-recall";

/** A source-backed, ungraded recall game. Nothing is saved or scored. */
export function LessonRecallGame({
  items,
  disabled = false,
  beforePlay,
}: {
  items: Lesson["explore"];
  disabled?: boolean;
  beforePlay?: () => void;
}) {
  const [state, setState] = useState(() =>
    createLessonRecallState(items.map((item) => item.id)),
  );
  const current = useRef(state);
  const heading = useRef<HTMLHeadingElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const id = currentLessonRecallId(state);
  const item = items.find((candidate) => candidate.id === id);
  const complete = state.phase === "complete";

  function focusCard(revealed: boolean) {
    window.requestAnimationFrame(() => {
      const target = revealed ? answer.current : heading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
  }

  function reveal() {
    if (
      currentLessonRecallId(current.current) !== id ||
      current.current.phase !== state.phase ||
      current.current.revealed
    )
      return;
    const next = revealLessonRecall(current.current);
    current.current = next;
    setState(next);
    focusCard(true);
  }

  function advance(revisit: boolean) {
    // A second event from the old card must not advance the newly rendered card.
    if (
      currentLessonRecallId(current.current) !== id ||
      current.current.phase !== state.phase ||
      !current.current.revealed
    )
      return;
    const next = advanceLessonRecall(current.current, revisit);
    current.current = next;
    setState(next);
    focusCard(false);
  }

  function restart() {
    if (current.current.phase !== "complete") return;
    const next = createLessonRecallState(items.map((entry) => entry.id));
    current.current = next;
    setState(next);
    focusCard(false);
  }

  return (
    <section
      className="lg-recall surface"
      aria-label="めくって確認"
      data-recall-id={id}
      data-recall-phase={state.phase}
      data-card-revealed={state.revealed}
    >
      <div className="lg-section-head">
        <div>
          <p className="eyebrow">
            <Layers2 size={15} aria-hidden="true" /> FLIP & RECALL
          </p>
          <h2>
            {complete
              ? "カードをひと巡り！"
              : state.phase === "revisit"
                ? "気になるカードを、もう一度。"
                : "思い出して、めくってみよう。"}
          </h2>
        </div>
        <span className="lg-round-chip">
          <Sparkles size={16} aria-hidden="true" />
          {state.phase === "revisit"
            ? "読み返し"
            : complete
              ? "ひと巡り"
              : `${state.index + 1} / ${items.length}`}
        </span>
      </div>
      <div className="lg-recall-progress">
        <p>
          <span>めくったカード</span>
          <strong>
            {state.seenIds.length} / {items.length}
          </strong>
        </p>
        <progress
          aria-label="めくったカード"
          value={state.seenIds.length}
          max={items.length}
        />
      </div>

      {complete ? (
        <div className="lg-recall-finish">
          <span className="lg-recall-emblem" aria-hidden="true">
            <Check size={31} />
          </span>
          <h3 ref={heading} tabIndex={-1} className="outline-none">
            すべての答えをめくりました。
          </h3>
          <p>このまま5問に挑戦しても、下のカードで見比べてもOK。</p>
          <Button type="button" variant="outline" onClick={restart}>
            <RotateCcw size={17} aria-hidden="true" />
            もう一度めくる
          </Button>
        </div>
      ) : item ? (
        <div className="lg-recall-card" key={`${state.phase}-${item.id}`}>
          <p className="lg-recall-prompt">
            読み方・意味・ポイントを思い出してみよう。
          </p>
          <h3
            ref={heading}
            tabIndex={-1}
            className="thai lg-recall-thai outline-none"
            lang="th"
          >
            {item.thai}
          </h3>
          {isThaiSpeechText(item.thai) && (
            <div className="lg-recall-audio">
              <p className="lg-small">
                端末合成音声は未監修です。利用時に提供元へ通信する場合があります。
              </p>
              <SpeakButton
                text={item.thai}
                label="音声でも確認"
                disabled={disabled}
                beforePlay={beforePlay}
              />
            </div>
          )}
          {state.revealed ? (
            <div
              className="lg-recall-answer"
              ref={answer}
              tabIndex={-1}
              aria-label="めくった答え"
            >
              <span className="lg-recall-answer-label">
                <Eye size={16} aria-hidden="true" />
                答えを確認
              </span>
              <p className="ipa lg-recall-ipa">{item.ipa}</p>
              <p className="lg-recall-meaning">{item.meaning}</p>
              <ExampleVisual example={item} />
              <p className="lg-recall-note">{item.note}</p>
            </div>
          ) : (
            <div className="lg-recall-hidden">
              <span aria-hidden="true">？</span>
              <p>わからなくても大丈夫。めくって見つけよう。</p>
              <Button type="button" onClick={reveal}>
                <Eye size={18} aria-hidden="true" />
                答えをめくる
              </Button>
            </div>
          )}
          {state.revealed && (
            <div className="lg-recall-actions">
              {state.phase === "first" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => advance(true)}
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  もう一度みたい
                </Button>
              )}
              <Button type="button" onClick={() => advance(false)}>
                次のカードへ
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      ) : null}
      <p className="lg-small lg-recall-footnote">
        任意の練習です。採点・XPの追加はありません。「もう一度みたい」は最後に1回だけ読み返せます。
      </p>
    </section>
  );
}

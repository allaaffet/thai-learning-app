"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Layers2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearningBlockCard } from "@/components/lesson-visuals";
import type { Lesson } from "@/lib/content-types";

/** Reading checks belong only to this screen; they are not a mastery score. */
export function LessonDiscovery({ blocks }: { blocks: Lesson["blocks"] }) {
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const block = blocks[index];
  if (!block) return null;

  function focusHeading() {
    window.requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest" });
    });
  }

  function visit(next: number) {
    setIndex(next);
    focusHeading();
  }

  const checked = checkedIds.includes(block.id);

  return (
    <section
      className="lg-discovery"
      aria-label="発見カード"
      data-discovery-view={showAll ? "all" : "cards"}
      data-block-id={showAll ? undefined : block.id}
      data-discovery-id={showAll ? undefined : block.id}
      data-discovery-index={showAll ? undefined : index + 1}
    >
      <div className="lg-section-head">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" /> LITTLE DISCOVERIES
          </p>
          <h2 ref={heading} tabIndex={-1} className="outline-none">
            {showAll ? "じっくり、まとめて読む。" : "ひとつずつ、発見しよう。"}
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setShowAll((current) => !current);
            focusHeading();
          }}
        >
          {showAll ? (
            <Layers2 size={16} aria-hidden="true" />
          ) : (
            <BookOpen size={16} aria-hidden="true" />
          )}
          {showAll ? "1枚ずつ読む" : "まとめて読む"}
        </Button>
      </div>

      <div className="lg-discovery-progress">
        <span>
          {checkedIds.length} / {blocks.length} 枚チェック
        </span>
        <progress
          aria-label="確認したカード"
          value={checkedIds.length}
          max={blocks.length}
        />
      </div>

      {!showAll && (
        <ol className="lg-discovery-trail" aria-label="発見カードを選ぶ">
          {blocks.map((item, cardIndex) => {
            const isChecked = checkedIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`発見カード${cardIndex + 1}：${item.title}`}
                  aria-current={cardIndex === index ? "step" : undefined}
                  data-checked={isChecked}
                  onClick={() => visit(cardIndex)}
                >
                  <span aria-hidden="true">
                    {isChecked ? <Check size={18} /> : cardIndex + 1}
                  </span>
                  <span className="sr-only">
                    {isChecked ? "チェック済み" : "未チェック"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {showAll ? (
        <div className="lg-discovery-all">
          {blocks.map((item, cardIndex) => (
            <LearningBlockCard
              key={item.id}
              block={item}
              number={cardIndex + 1}
            />
          ))}
        </div>
      ) : (
        <>
          <LearningBlockCard key={block.id} block={block} number={index + 1} />
          <div className="lg-discovery-controls">
            <Button
              type="button"
              variant="outline"
              disabled={index === 0}
              onClick={() => visit(index - 1)}
            >
              <ArrowLeft size={17} aria-hidden="true" />
              前のカードへ
            </Button>
            <Button
              type="button"
              disabled={checked}
              onClick={() =>
                setCheckedIds((current) =>
                  current.includes(block.id) ? current : [...current, block.id],
                )
              }
            >
              <Check size={17} aria-hidden="true" />
              {checked ? "チェック済み" : "このカードをチェック"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={index === blocks.length - 1}
              onClick={() => visit(index + 1)}
            >
              次のカードへ
              <ArrowRight size={17} aria-hidden="true" />
            </Button>
          </div>
        </>
      )}

      <p className="lg-small" role="status">
        {checkedIds.length === blocks.length
          ? "すべてのカードをチェック！ 次は、めくって確かめよう。"
          : "チェックは、この画面だけの読書メモ。いつでも先へ進めます。"}
      </p>
    </section>
  );
}

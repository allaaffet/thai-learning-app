"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  createHandwritingState,
  HANDWRITING_VIEWBOX_SIZE,
  handwritingReducer,
  MAX_HANDWRITING_STROKES,
  normalizeClientPoint,
  strokeToSvgPoints,
} from "@/lib/handwriting";
import type { HandwritingStroke } from "@/lib/handwriting";
import {
  isReferenceStrokeGuide,
  type ReferenceStrokeGuide,
} from "@/lib/stroke-types";

export interface HandwritingPadProps {
  thai: string;
  characterName: string;
  strokeGuide?: ReferenceStrokeGuide;
}

/** Changing the character starts a fresh practice surface, with no stored XP. */
export function HandwritingPad(props: HandwritingPadProps) {
  return <HandwritingSurface key={props.thai} {...props} />;
}

function DrawnStroke({ points }: { points: HandwritingStroke }) {
  if (points.length === 1) {
    return (
      <circle
        cx={points[0].x * HANDWRITING_VIEWBOX_SIZE}
        cy={points[0].y * HANDWRITING_VIEWBOX_SIZE}
        r="4"
        fill="currentColor"
      />
    );
  }
  return (
    <polyline
      points={strokeToSvgPoints(points)}
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Count graphemes only for sizing; keep the original Thai string untouched. */
function modelFontSize(thai: string) {
  const count =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter("th", { granularity: "grapheme" }).segment(thai),
        ).length
      : Array.from(thai).length;
  return Math.min(620, 820 / Math.max(1, count));
}

function HandwritingSurface({
  thai,
  characterName,
  strokeGuide,
}: HandwritingPadProps) {
  const [drawing, dispatch] = useReducer(
    handwritingReducer,
    undefined,
    createHandwritingState,
  );
  const [showModel, setShowModel] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePointer = useRef<number | null>(null);
  const instructionsId = useId();
  const titleId = useId();
  const usableGuide =
    isReferenceStrokeGuide(strokeGuide) && strokeGuide.thai === thai
      ? strokeGuide
      : undefined;

  function pointFromEvent(event: PointerEvent<SVGSVGElement>) {
    return normalizeClientPoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
  }

  function releasePointer() {
    const pointerId = activePointer.current;
    activePointer.current = null;
    if (pointerId !== null && svgRef.current?.hasPointerCapture(pointerId)) {
      svgRef.current.releasePointerCapture(pointerId);
    }
  }

  function startStroke(event: PointerEvent<SVGSVGElement>) {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      activePointer.current !== null ||
      drawing.strokes.length >= MAX_HANDWRITING_STROKES
    ) {
      return;
    }
    const point = pointFromEvent(event);
    if (!point) return;
    event.preventDefault();
    // Capture keeps an off-surface pointer-up from leaving a stuck stroke.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    activePointer.current = event.pointerId;
    dispatch({ type: "start", pointerId: event.pointerId, point });
  }

  function moveStroke(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerId !== activePointer.current) return;
    const point = pointFromEvent(event);
    if (point) dispatch({ type: "move", pointerId: event.pointerId, point });
  }

  function finishStroke(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerId !== activePointer.current) return;
    dispatch({
      type: "finish",
      pointerId: event.pointerId,
      point: pointFromEvent(event) ?? undefined,
    });
    releasePointer();
  }

  function cancelStroke(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerId !== activePointer.current) return;
    dispatch({ type: "cancel", pointerId: event.pointerId });
    releasePointer();
  }

  function undoStroke() {
    // Undo while writing cancels just the active line, preserving earlier lines.
    dispatch({ type: "undo" });
    releasePointer();
  }

  function clearDrawing() {
    dispatch({ type: "clear" });
    releasePointer();
  }

  return (
    <section className="space-y-5" aria-labelledby={titleId}>
      <div className="space-y-2">
        <h3 id={titleId} className="text-base font-semibold text-[#285b46]">
          {characterName}を手で書いてみる
        </h3>
        <p id={instructionsId} className="text-xs leading-7 text-[#64765b]">
          マウス・指・ペンで自由に書けます。なぞり書きの薄い手本は、標準のループあり字体です。
          文字の形を確かめる練習で、手書きの筆順を示すものではありません。
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="書き取りの表示設定"
      >
        <Button
          type="button"
          size="sm"
          variant={showModel ? "secondary" : "outline"}
          aria-pressed={showModel}
          onClick={() => setShowModel(true)}
        >
          なぞり書き
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!showModel ? "secondary" : "outline"}
          aria-pressed={!showModel}
          onClick={() => setShowModel(false)}
        >
          手本なし
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={showLines}
          onClick={() => setShowLines((shown) => !shown)}
        >
          ガイド線 {showLines ? "あり" : "なし"}
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[450px] overflow-hidden rounded-2xl border border-[#dce5d7] bg-[#fbfcf8]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${HANDWRITING_VIEWBOX_SIZE} ${HANDWRITING_VIEWBOX_SIZE}`}
          className="block aspect-square w-full text-[#285b46]"
          style={{ touchAction: "none", userSelect: "none" }}
          role="img"
          aria-label={`${thai}（${characterName}）の書き取り領域`}
          aria-describedby={instructionsId}
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={finishStroke}
          onPointerCancel={cancelStroke}
          onLostPointerCapture={cancelStroke}
        >
          <g pointerEvents="none" aria-hidden="true">
            {showLines && (
              <g stroke="#cdd9c7" strokeWidth="2" strokeDasharray="10 12">
                <path d="M0 250 H1000 M0 500 H1000 M0 750 H1000" />
                <path d="M250 0 V1000 M500 0 V1000 M750 0 V1000" />
              </g>
            )}
            {showModel && (
              <text
                x="500"
                y="530"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={modelFontSize(thai)}
                fill="#285b46"
                fillOpacity="0.15"
                lang="th"
                style={{
                  fontFamily: '"Noto Sans Thai Looped Variable", sans-serif',
                }}
              >
                {thai}
              </text>
            )}
            {/* Learner input is separate from both the font and source guides. */}
            <g data-testid="handwriting-ink">
              {drawing.strokes.map((stroke, index) => (
                <DrawnStroke key={index} points={stroke} />
              ))}
              {drawing.active && <DrawnStroke points={drawing.active.points} />}
            </g>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#64765b]" role="status">
          描いた線：{drawing.strokes.length}本
          <span className="ml-2">（画数の判定ではありません）</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={undoStroke}
            disabled={drawing.strokes.length === 0 && drawing.active === null}
          >
            1本戻す
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={clearDrawing}
            disabled={drawing.strokes.length === 0 && drawing.active === null}
          >
            すべて消す
          </Button>
        </div>
      </div>
      {drawing.strokes.length >= MAX_HANDWRITING_STROKES && (
        <p className="text-xs leading-7 text-[#805a2e]" role="status">
          この練習では{MAX_HANDWRITING_STROKES}
          本まで書けます。「1本戻す」か「すべて消す」で続けられます。
        </p>
      )}

      <p className="rounded-xl bg-[#f2f5ec] px-4 py-3 text-xs leading-7 text-[#64765b]">
        {usableGuide
          ? "下の参考の運筆例は、出典に記録された軌跡です。標準筆順は未検証です。採点なし・XP加算なしの練習です。"
          : "筆順資料未確認：この文字の標準筆順を確認できる資料はまだありません。採点なし・XP加算なしの練習です。"}
        書いた内容はこの画面を離れると消えます。
      </p>
      {usableGuide && (
        <StrokeGuidePlayer key={usableGuide.characterId} guide={usableGuide} />
      )}
    </section>
  );
}

/** Replay source-recorded trajectories without claiming standard stroke order. */
function StrokeGuidePlayer({ guide }: { guide: ReferenceStrokeGuide }) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const guideTitleId = useId();

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Show the full guide immediately when motion is reduced.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(guide.strokes.length);
      setPlaying(false);
      return;
    }
    let startedAt: number | null = null;
    function animate(time: number) {
      if (startedAt === null) startedAt = time;
      const next = Math.min(guide.strokes.length, (time - startedAt) / 1100);
      setPosition(next);
      if (next < guide.strokes.length) {
        frameRef.current = window.requestAnimationFrame(animate);
      } else {
        setPlaying(false);
      }
    }
    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null)
        window.cancelAnimationFrame(frameRef.current);
    };
  }, [playing, guide.strokes.length]);

  const currentStroke = Math.min(
    Math.floor(position),
    guide.strokes.length - 1,
  );
  const fraction = position >= guide.strokes.length ? 1 : position % 1;
  const strokeWidth = Math.max(guide.viewBox[2], guide.viewBox[3]) / 65;

  return (
    <section
      className="space-y-3 rounded-xl border border-[#e1e8dc] p-4"
      aria-labelledby={guideTitleId}
    >
      <h4 id={guideTitleId} className="text-sm font-semibold text-[#285b46]">
        参考の運筆例（専門家監修前）
      </h4>
      <svg
        viewBox={guide.viewBox.join(" ")}
        className="mx-auto block aspect-square w-full max-w-[260px]"
        role="img"
        aria-label={`${guide.thai}の参考の運筆例。記録された${guide.strokes.length}本の線のうち${Math.min(Math.ceil(position), guide.strokes.length)}本を表示`}
      >
        {guide.strokes.map((stroke, index) => (
          <g key={stroke.id}>
            <path
              d={stroke.path}
              fill="none"
              stroke="#e4eade"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {index <= currentStroke && (
              <path
                d={stroke.path}
                fill="none"
                stroke="#285b46"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={index < currentStroke ? 0 : 1 - fraction}
              />
            )}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={playing}
          onClick={() => {
            setPosition(0);
            setPlaying(true);
          }}
        >
          {playing ? "再生中" : "運筆例を再生"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={playing || position >= guide.strokes.length}
          onClick={() =>
            setPosition((current) =>
              Math.min(guide.strokes.length, Math.floor(current) + 1),
            )
          }
        >
          次の1本を表示
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setPosition(0);
          }}
        >
          最初に戻す
        </Button>
      </div>
      <p className="text-xs leading-7 text-[#64765b]">
        出典：
        <a
          href={guide.source.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {guide.source.title}
        </a>
        {" ／ "}
        <a
          href={guide.source.licenseUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          {guide.source.license}
        </a>
        {" ／ "}照合日：{guide.source.checkedAt}
        <br />
        出典の記録軌跡を表示しています。標準筆順は未検証で、専門家監修前です。
        <br />
        {guide.reviewNote}
      </p>
    </section>
  );
}

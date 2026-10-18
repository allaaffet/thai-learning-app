"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  Flag,
  Layers3,
  LockKeyhole,
} from "lucide-react";
import { lessons, parts, chapter } from "@/data/curriculum";
import { useLearning } from "@/components/learning-provider";
import { LessonCard } from "@/components/lesson-card";

export function Roadmap() {
  const { progress, ready } = useLearning();
  const completed = lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completedAt,
  ).length;
  return (
    <>
      <div className="page-header">
        <p className="eyebrow">LEARNING ROADMAP</p>
        <h1 className="page-title">学びの道のり</h1>
        <p className="page-description">
          音と文字から、ことばの仕組みへ。一歩ずつ、つながるカリキュラム。
        </p>
      </div>
      <div className="roadmap-intro surface">
        <div className="roadmap-part-icon">
          <Flag size={26} />
        </div>
        <div>
          <span className="eyebrow">PART 01 · はじめの一歩</span>
          <h2>{parts[0].title}</h2>
          <p>{parts[0].description}</p>
        </div>
        <span className="badge">学習できます</span>
      </div>
      <section className="roadmap-chapter">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CHAPTER 01</p>
            <h2>{chapter.title}</h2>
            <p>{chapter.description}</p>
          </div>
          <span className="chapter-count">
            <Check size={16} /> {ready ? completed : "–"} / {lessons.length}{" "}
            完了
          </span>
        </div>
        <div className="roadmap-flow">
          <span>
            <BookOpen size={15} /> 理解する
          </span>
          <span>→</span>
          <span>確認する</span>
          <span>→</span>
          <span>練習する</span>
          <span>→</span>
          <span>振り返る</span>
        </div>
        <p className="roadmap-help">
          5問中4問以上の正解で次のレッスンが開きます。完了したレッスンはいつでも復習できます。
        </p>
        <div className="lesson-grid">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </section>
      <section className="future-curriculum">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LOOKING AHEAD</p>
            <h2>この先につながる学び</h2>
            <p>全体のカリキュラム案です。今回は第1章を学習できます。</p>
          </div>
          <span className="badge neutral">
            <Layers3 size={13} /> 今後の計画
          </span>
        </div>
        {parts.slice(1).map((part) => (
          <details key={part.id} className="planned-part">
            <summary>
              <span className="planned-number">
                {String(part.number).padStart(2, "0")}
              </span>
              <strong>{part.title}</strong>
              <span className="planned-label">
                <LockKeyhole size={13} /> 準備中
              </span>
              <ChevronDown size={16} />
            </summary>
            <p>
              {part.description}{" "}
              この部の教材と演習は、今後の開発で追加する予定です。
            </p>
          </details>
        ))}
      </section>
    </>
  );
}

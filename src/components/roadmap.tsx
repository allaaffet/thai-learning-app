"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  Flag,
  Layers3,
  LockKeyhole,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import {
  courseParts,
  courseChapters,
  courseLessons,
  getChapterLessons,
} from "@/data/course";
import { useLearning } from "@/components/learning-provider";
import { LessonCard } from "@/components/lesson-card";

export function Roadmap() {
  const { progress, ready } = useLearning();
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">学びの道のり</h1>
        <p className="page-description">
          {courseChapters.length}章・{courseLessons.length}
          レッスン。音と文字から、日常のことばへ。
        </p>
      </div>
      <ol
        className="roadmap-flow visual-learning-flow"
        aria-label="レッスンの進め方"
      >
        {[
          { label: "理解する", Icon: BookOpen },
          { label: "確認する", Icon: Eye },
          { label: "練習する", Icon: PencilLine },
          { label: "振り返る", Icon: RotateCcw },
        ].map(({ label, Icon }, index) => (
          <li key={label}>
            <span className="flow-icon">
              <Icon size={23} aria-hidden="true" />
            </span>
            <span>{label}</span>
            <span className="flow-step" aria-hidden="true">
              {index + 1}
            </span>
          </li>
        ))}
      </ol>
      <p className="roadmap-help">
        5問中4問以上で次へ。完了したレッスンはいつでも復習できます。
      </p>
      {courseParts
        .filter((part) => part.status === "available")
        .map((part) => (
          <section
            key={part.id}
            aria-labelledby={`heading-${part.id}`}
            className="course-part"
          >
            <div className="roadmap-intro surface">
              <div className="roadmap-part-icon">
                <Flag size={26} />
              </div>
              <div>
                <span className="eyebrow">第{part.number}部</span>
                <h2 id={`heading-${part.id}`}>{part.title}</h2>
                <details className="course-description">
                  <summary>
                    この部で学ぶこと{" "}
                    <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <p>{part.description}</p>
                </details>
              </div>
              <span className="badge">教材を収録</span>
            </div>
            {courseChapters
              .filter((chapter) => chapter.partId === part.id)
              .map((chapter) => {
                const lessons = getChapterLessons(chapter.id);
                const completed = lessons.filter(
                  (lesson) => progress.lessons[lesson.id]?.completedAt,
                ).length;
                return (
                  <section
                    key={chapter.id}
                    className="roadmap-chapter"
                    aria-labelledby={`heading-${chapter.id}`}
                  >
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">第{chapter.number}章</p>
                        <h2 id={`heading-${chapter.id}`}>{chapter.title}</h2>
                      </div>
                      <span className="chapter-count">
                        <Check size={16} /> {ready ? completed : "–"} /{" "}
                        {lessons.length} 完了
                      </span>
                    </div>
                    <div
                      className="chapter-milestones"
                      role="progressbar"
                      aria-label={`${chapter.title}の進捗`}
                      aria-valuemin={0}
                      aria-valuemax={lessons.length}
                      aria-valuenow={ready ? completed : 0}
                      aria-valuetext={
                        ready
                          ? `${lessons.length}レッスン中${completed}レッスン完了`
                          : "進捗を読み込み中"
                      }
                    >
                      {lessons.map((lesson, index) => (
                        <span
                          key={lesson.id}
                          className={
                            progress.lessons[lesson.id]?.completedAt
                              ? "is-complete"
                              : ""
                          }
                          aria-hidden="true"
                        >
                          {progress.lessons[lesson.id]?.completedAt ? (
                            <Check size={16} />
                          ) : (
                            index + 1
                          )}
                        </span>
                      ))}
                    </div>
                    <details className="course-description chapter-description">
                      <summary>
                        この章で学ぶこと{" "}
                        <ChevronDown size={15} aria-hidden="true" />
                      </summary>
                      <p>{chapter.description}</p>
                    </details>
                    <div className="lesson-grid">
                      {lessons.map((lesson) => (
                        <LessonCard key={lesson.id} lesson={lesson} />
                      ))}
                    </div>
                  </section>
                );
              })}
          </section>
        ))}
      <section className="future-curriculum">
        <div className="section-heading">
          <div>
            <h2>この先につながる学び</h2>
            <p>
              全{courseChapters.length}章・{courseLessons.length}
              レッスンを収録。以下は今後の計画です。
            </p>
          </div>
          <span className="badge neutral">
            <Layers3 size={13} /> 今後の計画
          </span>
        </div>
        {courseParts
          .filter((part) => part.status === "planned")
          .map((part) => (
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

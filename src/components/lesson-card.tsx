"use client";

import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  Clock3,
  LockKeyhole,
  MessageCircle,
  Shapes,
  Sparkles,
} from "lucide-react";
import type { Lesson } from "@/lib/content-types";
import { useLearning } from "@/components/learning-provider";
import { isLessonUnlocked } from "@/lib/progress";
import { cn } from "@/lib/utils";

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const { progress, ready } = useLearning();
  const record = progress.lessons[lesson.id];
  const completed = Boolean(record?.completedAt);
  const unlocked = ready && isLessonUnlocked(progress, lesson);
  const preview = lesson.explore.find((item) => item.thai.length <= 8);
  const ChapterIcon =
    lesson.chapterId === "chapter-6" || lesson.chapterId === "chapter-7"
      ? MessageCircle
      : lesson.chapterId === "chapter-4" || lesson.chapterId === "chapter-5"
        ? AudioLines
        : lesson.chapterId === "chapter-2" || lesson.chapterId === "chapter-3"
          ? Shapes
          : BookOpen;
  const body = (
    <>
      <div className="lesson-card-top">
        <span
          className={cn(
            "lesson-glyph thai visual-lesson-glyph",
            completed && "completed",
          )}
          lang="th"
          aria-hidden="true"
        >
          {completed ? (
            <Check size={30} />
          ) : preview ? (
            preview.thai
          ) : (
            <ChapterIcon size={30} strokeWidth={1.5} />
          )}
        </span>
        <span className={cn("lesson-state", completed && "done")}>
          {!ready ? (
            "読み込み中"
          ) : completed ? (
            <>
              <Check size={14} /> 完了済み
            </>
          ) : unlocked ? (
            "学習できます"
          ) : (
            <>
              <LockKeyhole size={14} /> 前のレッスン完了後
            </>
          )}
        </span>
      </div>
      <span className="lesson-number">
        レッスン {String(lesson.number).padStart(2, "0")}
      </span>
      <h3>{lesson.title}</h3>
      <div className="lesson-card-bottom">
        <span>
          <Clock3 size={14} aria-hidden="true" /> 約{lesson.durationMinutes}分{" "}
          <span className="separator">·</span> <Sparkles size={12} />{" "}
          {lesson.xp} XP
        </span>
        {unlocked ? <ArrowRight size={18} /> : <LockKeyhole size={15} />}
      </div>
    </>
  );
  return unlocked ? (
    <Link
      href={`/lessons/${lesson.id}`}
      data-testid={`lesson-card-${lesson.id}`}
      className={cn("lesson-card", completed && "is-completed")}
      aria-label={lesson.title}
    >
      {body}
    </Link>
  ) : (
    <div
      data-testid={`lesson-card-${lesson.id}`}
      className="lesson-card is-locked"
      aria-label={`${lesson.title}：前提レッスンの完了が必要です`}
    >
      {body}
    </div>
  );
}

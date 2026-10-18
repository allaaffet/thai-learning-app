"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sparkles } from "lucide-react";
import type { Lesson } from "@/lib/content-types";
import { useLearning } from "@/components/learning-provider";
import { isLessonUnlocked } from "@/lib/progress";
import { cn } from "@/lib/utils";

const glyphs = ["ก", "จ", "ข", "า", "น", "ก้"];

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const { progress, ready } = useLearning();
  const record = progress.lessons[lesson.id];
  const completed = Boolean(record?.completedAt);
  const unlocked = ready && isLessonUnlocked(progress, lesson);
  const body = (
    <>
      <div className="lesson-card-top">
        <span
          className={cn("lesson-glyph thai", completed && "completed")}
          lang="th"
        >
          {completed ? <Check size={26} /> : glyphs[lesson.number - 1]}
        </span>
        <span className={cn("lesson-state", completed && "done")}>
          {!ready ? (
            "読み込み中"
          ) : completed ? (
            "完了済み"
          ) : unlocked ? (
            "学習できます"
          ) : (
            <>
              <LockKeyhole size={12} /> 前のレッスン完了後
            </>
          )}
        </span>
      </div>
      <span className="lesson-number">
        LESSON {String(lesson.number).padStart(2, "0")}
      </span>
      <h3>{lesson.title}</h3>
      <p>{lesson.subtitle}</p>
      <div className="lesson-card-bottom">
        <span>
          約{lesson.durationMinutes}分 <span className="separator">·</span>{" "}
          <Sparkles size={12} /> {lesson.xp} XP
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

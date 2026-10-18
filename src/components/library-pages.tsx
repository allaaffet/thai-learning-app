"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Info,
  Check,
  ChevronRight,
  LockKeyhole,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { courseLessons as lessons } from "@/data/course";
import {
  getAccuracy,
  getStreak,
  getTotalXp,
  isLessonUnlocked,
} from "@/lib/progress";
import { useLearning } from "@/components/learning-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StudyInsights } from "@/components/study-insights";

export function ProgressPage() {
  const { progress, ready, storageMessage } = useLearning();

  if (!ready) {
    return (
      <div className="space-y-8">
        <header className="page-header">
          <p className="eyebrow">YOUR PROGRESS</p>
          <h1 className="page-title">学びのあしあと</h1>
        </header>
        <p role="status" className="muted">
          保存した学習記録を読み込んでいます…
        </p>
      </div>
    );
  }

  const completedCount = lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completedAt,
  ).length;
  const accuracy = getAccuracy(progress);
  const streak = getStreak(progress);
  const hasAttempts = progress.attempts.length > 0;
  const stats = [
    {
      label: "完了したレッスン",
      value: `${completedCount}`,
      unit: `/ ${lessons.length}`,
      icon: BookOpen,
      note: "小さな一歩の積み重ね",
    },
    {
      label: "獲得したXP",
      value: `${getTotalXp(progress)}`,
      unit: "XP",
      icon: Sparkles,
      note: "初回のレッスン完了で獲得",
    },
    {
      label: "クイズの正答率",
      value: hasAttempts ? `${Math.round(accuracy)}` : "—",
      unit: hasAttempts ? "%" : "",
      icon: Target,
      note: hasAttempts
        ? "すべての受講回の初回回答"
        : "クイズに答えると記録されます",
    },
    {
      label: "学習した日数",
      value: `${progress.studyDays.length}`,
      unit: "日",
      icon: CalendarDays,
      note:
        streak > 0
          ? `現在${streak}日連続で学習中`
          : "自分のペースで続けましょう",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">YOUR PROGRESS</p>
        <h1 className="page-title">学びのあしあと</h1>
        <p className="page-description">
          昨日より、ひとつわかる。その積み重ねを振り返りましょう。
        </p>
      </header>

      {storageMessage && (
        <p
          role="status"
          className="rounded-xl border border-[#e8dcb8] bg-[#fbf7ec] p-4 text-sm leading-7 text-[#756331]"
        >
          {storageMessage}
        </p>
      )}

      <div className="stat-grid">
        {stats.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <div className="stat-icon">
              <stat.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-medium text-[#77817b]">
              {stat.label}
            </p>
            <p className="mt-2 flex items-baseline gap-1.5 text-3xl font-semibold tracking-tight text-[#285b46]">
              {stat.value}
              <span className="text-sm font-normal tracking-normal text-[#77817b]">
                {stat.unit}
              </span>
            </p>
            <p className="mt-2 text-xs leading-6 text-[#77817b]">{stat.note}</p>
          </Card>
        ))}
      </div>

      {completedCount === 0 && !hasAttempts && (
        <Card className="flex flex-col gap-5 bg-[#f1f5ee] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#285b46]">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-[#285b46]">
                最初の一歩を、ここから。
              </h2>
              <p className="mt-1 text-sm leading-7 text-[#68746c]">
                最初のレッスンを終えると、あなたの学習記録が増えていきます。
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/lessons/${lessons[0]?.id ?? "sounds-and-letters"}`}>
              学習をはじめる
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      )}

      <StudyInsights />
      <section aria-labelledby="lesson-progress-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">LESSON RECORDS</p>
            <h2 id="lesson-progress-heading" className="section-heading">
              レッスンごとの記録
            </h2>
          </div>
          <span className="text-sm text-[#77817b]">
            {completedCount} / {lessons.length} レッスン完了
          </span>
        </div>

        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-[#edf0ea]">
            {lessons.map((lesson) => {
              const record = progress.lessons[lesson.id];
              const completed = Boolean(record?.completedAt);
              const unlocked = isLessonUnlocked(progress, lesson);
              const studied = Boolean(record);
              const neededLessons = lessons.filter(
                (item) =>
                  lesson.prerequisites.includes(item.id) &&
                  !progress.lessons[item.id]?.completedAt,
              );

              return (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${completed ? "bg-[#eaf2eb] text-[#285b46]" : unlocked ? "bg-[#f4f5ef] text-[#69715d]" : "bg-[#f4f5f3] text-[#99a29a]"}`}
                  >
                    {completed ? (
                      <Check className="h-5 w-5" aria-hidden="true" />
                    ) : !unlocked ? (
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      String(lesson.number).padStart(2, "0")
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-[55%]">
                    <h3
                      className={`text-sm font-semibold leading-7 ${unlocked ? "text-[#394a3f]" : "text-[#77817b]"}`}
                    >
                      {lesson.title}
                    </h3>
                    <p className="mt-0.5 text-xs leading-6 text-[#77817b]">
                      {completed
                        ? "完了"
                        : !unlocked
                          ? "未解放"
                          : studied
                            ? "復習が必要"
                            : "未学習"}
                      {studied &&
                        ` · 最高正答率 ${Math.round(record.bestScore)}% · ${record.attemptCount}回受講`}
                      {!unlocked &&
                        neededLessons.length > 0 &&
                        ` · 「${neededLessons.map((item) => item.title).join("」「")}」の完了後に学べます`}
                    </p>
                  </div>
                  {unlocked ? (
                    <Button
                      asChild
                      variant={completed ? "ghost" : "outline"}
                      size="sm"
                      className="min-h-11"
                    >
                      <Link href={`/lessons/${lesson.id}`}>
                        {completed
                          ? "復習する"
                          : studied
                            ? "もう一度学ぶ"
                            : "学習する"}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <span className="px-3 py-3 text-xs text-[#99a29a]">
                      前提レッスンを完了
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-[#e4e9e2] bg-white p-5 text-sm leading-7 text-[#77817b]">
        <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          XPは学習の積み重ね、正答率は理解度の目安です。再受講でXPは増えませんが、最高正答率を更新できます。記録はこのブラウザに保存され、別の端末には同期されません。
        </p>
      </div>
    </div>
  );
}

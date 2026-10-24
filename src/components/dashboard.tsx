"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Flame,
  GraduationCap,
  Leaf,
  MoveUpRight,
  Sparkles,
  Target,
} from "lucide-react";
import {
  courseLessons as lessons,
  getCourseChapter,
  getChapterLessons,
} from "@/data/course";
import { useLearning } from "@/components/learning-provider";
import { LessonCard } from "@/components/lesson-card";
import { ReviewSummary } from "@/components/review-summary";
import { toneDescriptions } from "@/components/tone-contour";
import { Button } from "@/components/ui/button";
import { getNextLesson, getStreak, getTotalXp } from "@/lib/progress";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Dashboard() {
  const { progress, ready } = useLearning();
  const completed = lessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completedAt,
  ).length;
  const next = getNextLesson(progress, lessons);
  const active = next ?? lessons[0];
  const activeChapter = getCourseChapter(active.chapterId)!;
  const chapterLessons = getChapterLessons(active.chapterId);
  const chapterCompleted = chapterLessons.filter(
    (entry) => progress.lessons[entry.id]?.completedAt,
  ).length;
  const xp = getTotalXp(progress);
  const preview = active.explore.find((item) => item.thai.length <= 8);
  const todayDone = ready && progress.studyDays.includes(dateKey(new Date()));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7) + index);
    return {
      label: weekdays[day.getDay()],
      done: ready && progress.studyDays.includes(dateKey(day)),
      today: ready && dateKey(day) === dateKey(new Date()),
    };
  });

  return (
    <>
      <div className="page-header dashboard-header">
        <div>
          <p className="eyebrow">
            <span className="thai" lang="th">
              สวัสดี
            </span>
          </p>
          <h1 className="page-title">今日も、タイ語にふれる。</h1>
        </div>
        <span className="beginner-pill">
          <Leaf size={14} /> はじめてのタイ語
        </span>
      </div>

      <section className="dashboard-hero-grid" aria-label="今日の学習">
        <div className="hero-card visual-next-lesson">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> {next ? "次のレッスン" : "全レッスンを完了しました"}
            </span>
            <h2>{next ? active.title : "学んだことを、もう一度。"}</h2>
            <div className="hero-lesson-tag">
              <BookOpen size={14} />
              <span>
                第{activeChapter.number}章 <span className="separator">/</span>{" "}
                レッスン {String(active.number).padStart(2, "0")}
              </span>
            </div>
            <Button size="lg" asChild={ready} disabled={!ready}>
              {ready ? (
                <Link href={next ? `/lessons/${next.id}` : "/roadmap"}>
                  {completed === lessons.length
                    ? "学んだことを復習する"
                    : completed
                      ? "学習をつづける"
                      : "学習をはじめる"}
                  <ArrowRight size={17} />
                </Link>
              ) : (
                <>進捗を読み込み中…</>
              )}
            </Button>
            <span className="hero-time">
              <Clock3 size={16} /> 約{active.durationMinutes}分
            </span>
          </div>
          <div className="next-lesson-visual" aria-hidden="true">
            <span className="next-visual-orbit" />
            <span className="next-visual-spark">
              <Sparkles size={28} />
            </span>
            <div className="next-visual-card">
              {preview ? (
                <span className="thai" lang="th">
                  {preview.thai}
                </span>
              ) : (
                <BookOpen size={76} strokeWidth={1.3} />
              )}
            </div>
            <span className="next-visual-number">
              {String(active.number).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="daily-card surface">
          <div className="daily-heading">
            <span className="mini-icon">
              <Target size={19} />
            </span>
            <span>今日の目標</span>
          </div>
          <div className={`daily-ring ${todayDone ? "is-done" : ""}`}>
            <div>
              <strong>
                {todayDone ? "1" : "0"}
                <span> / 1</span>
              </strong>
              <small>1レッスン</small>
            </div>
          </div>
          <p>
            {todayDone ? "今日の一歩、できました。" : "まずは1レッスンから。"}
          </p>
          <div className="weekdays" aria-label="今週の学習日">
            {week.map((day, index) => (
              <div key={index}>
                <span>{day.label}</span>
                <span
                  className={`weekday-dot ${day.done ? "done" : ""} ${day.today ? "today" : ""}`}
                  aria-label={`${day.label}曜日${day.done ? " 学習済み" : ""}`}
                >
                  {day.done ? <Check size={13} /> : <span />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="学習状況">
        <div>
          <span className="stat-symbol sage">
            <CheckCheck size={21} />
          </span>
          <div>
            <span>レッスン完了</span>
            <strong>
              {ready ? completed : "–"}
              <small> / {lessons.length}</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-symbol amber">
            <Sparkles size={21} />
          </span>
          <div>
            <span>経験値</span>
            <strong>
              {ready ? xp : "–"}
              <small> XP</small>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-symbol peach">
            <Flame size={21} />
          </span>
          <div>
            <span>続けた日数</span>
            <strong>
              {ready ? getStreak(progress) : "–"}
              <small> 日連続</small>
            </strong>
          </div>
        </div>
      </section>

      <ReviewSummary />
      <section className="chapter-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">第{activeChapter.number}章</p>
            <h2>{activeChapter.title}</h2>
          </div>
          <Link href="/roadmap" className="text-link">
            ロードマップを見る <ArrowRight size={15} />
          </Link>
        </div>
        <div className="chapter-progress">
          <span className="chapter-progress-icon">
            <GraduationCap size={18} />
          </span>
          <span>この章の進み具合</span>
          <strong>
            {ready ? chapterCompleted : "–"} / {chapterLessons.length}
          </strong>
          <div className="track">
            <span
              style={{
                width: `${ready ? (chapterCompleted / chapterLessons.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="lesson-grid">
          {chapterLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </section>

      <section className="discovery-grid" aria-label="学習のヒント">
        <Link className="discovery-note" href="/characters">
          <span className="discovery-label">
            <BookOpen size={15} /> 文字の小さな発見
          </span>
          <div className="discovery-equation thai" lang="th">
            <span>ก</span>
            <small>＋</small>
            <span>า</span>
            <small>＝</small>
            <span className="equation-answer">กา</span>
          </div>
          <p>子音と母音が出会うと、ひとつの音節に。</p>
          <span className="text-link">
            タイ文字ノートを開く <MoveUpRight size={14} />
          </span>
        </Link>
        <Link className="learning-note tone-discovery" href="/pronunciation">
          <div>
            <span className="discovery-label">
              <Target size={17} /> 声調ラボ
            </span>
            <div className="tone-discovery-art" aria-hidden="true">
              {Object.entries(toneDescriptions).map(([tone, info]) => (
                <svg key={tone} viewBox="0 0 220 150">
                  <path
                    d={info.path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                </svg>
              ))}
            </div>
            <span className="text-link">
              声調の仕組みをラボで確かめる <MoveUpRight size={15} />
            </span>
          </div>
        </Link>
      </section>
      <div className="content-status">
        <span>教材について</span>
        <p>
          教材は専門家レビュー前です。資料で照合した範囲と、未検証の内容を区別しています。
          <Link href="/characters#content-sources">
            出典と確認状況を見る <ArrowRight size={12} />
          </Link>
        </p>
      </div>
    </>
  );
}

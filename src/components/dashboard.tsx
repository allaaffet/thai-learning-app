"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  Clock3,
  Compass,
  Flame,
  GraduationCap,
  Leaf,
  MoveUpRight,
  Sparkles,
  Target,
} from "lucide-react";
import { lessons } from "@/data/curriculum";
import { useLearning } from "@/components/learning-provider";
import { LessonCard } from "@/components/lesson-card";
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
  const xp = getTotalXp(progress);
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
            </span>{" "}
            <span className="eyebrow-divider" /> HELLO, NEW WORLD
          </p>
          <h1 className="page-title">今日も、タイ語にふれる。</h1>
          <p className="page-description">
            小さな「わかった」を重ねて、ことばの世界を広げよう。
          </p>
        </div>
        <span className="beginner-pill">
          <Leaf size={14} /> はじめてのタイ語
        </span>
      </div>

      <section className="dashboard-hero-grid" aria-label="今日の学習">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> YOUR NEXT SMALL STEP
            </span>
            <h2>
              {completed === lessons.length ? (
                <>
                  はじめの一歩を、
                  <br />
                  確かな自信に。
                </>
              ) : (
                <>
                  読めると、
                  <br />
                  世界が少し広がる。
                </>
              )}
            </h2>
            <p>
              文字と音の仕組みから、ひとつずつ。
              <br />
              日本語でじっくり、タイ語をはじめよう。
            </p>
            <div className="hero-lesson-tag">
              <BookOpen size={14} />
              <span>
                第1章 <span className="separator">/</span> レッスン{" "}
                {String(active.number).padStart(2, "0")}
              </span>
            </div>
            <Button size="lg" asChild={ready} disabled={!ready}>
              {ready ? (
                <Link href={next ? `/lessons/${next.id}` : "/roadmap"}>
                  {completed === lessons.length
                    ? "第1章を復習する"
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
              <Clock3 size={13} /> 1回 約8〜12分。自分のペースで。
            </span>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <span className="art-dot dot-one" />
            <span className="art-dot dot-two" />
            <span className="floating-character char-one thai">ก</span>
            <span className="floating-character char-two thai">า</span>
            <span className="floating-character char-three thai">ข</span>
            <div className="art-main">
              <span className="thai">ก</span>
              <small>ここから、はじまる。</small>
            </div>
            <span className="art-spark spark-one">✦</span>
            <span className="art-spark spark-two">✧</span>
            <span className="art-label">a little, every day.</span>
          </div>
        </div>

        <div className="daily-card surface">
          <div className="daily-heading">
            <span className="mini-icon">
              <Target size={19} />
            </span>
            <span>今日の小さな目標</span>
          </div>
          <div className={`daily-ring ${todayDone ? "is-done" : ""}`}>
            <div>
              <strong>
                {todayDone ? "1" : "0"}
                <span> / 1</span>
              </strong>
              <small>レッスンに取り組む</small>
            </div>
          </div>
          <p>
            {todayDone ? "今日の一歩、できました。" : "まずは1レッスンから。"}
          </p>
          <span className="daily-encouragement">
            {todayDone
              ? "わかったことを、大切に。"
              : "がんばりすぎず、少しずつ。"}
          </span>
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
            <span>完了したレッスン</span>
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
            <span>積み重ねた経験</span>
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

      <section className="chapter-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LEARNING PATH</p>
            <h2>タイ語の、はじめの一歩。</h2>
            <p>第1章 · タイ語の文字と発音の基礎</p>
          </div>
          <Link href="/roadmap" className="text-link">
            ロードマップを見る <ArrowRight size={15} />
          </Link>
        </div>
        <div className="chapter-progress">
          <span className="chapter-progress-icon">
            <GraduationCap size={18} />
          </span>
          <span>音を知る。文字に出会う。少しずつ、読める。</span>
          <strong>{ready ? completed : "–"} / 6</strong>
          <div className="track">
            <span
              style={{
                width: `${ready ? (completed / lessons.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="lesson-grid">
          {lessons.map((lesson) => (
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
        <div className="learning-note">
          <span className="mini-icon">
            <Compass size={21} />
          </span>
          <div>
            <h2>「なぜ？」がわかると、学びは楽しい。</h2>
            <p>
              答えを覚えるだけでなく、その理由まで。
              <br />
              まちがいも、理解につながる大切な一歩です。
            </p>
            <span className="note-foot">
              <Leaf size={13} /> ハートや時間制限はありません
            </span>
          </div>
        </div>
      </section>
      <div className="content-status">
        <span>教材について</span>
        <p>
          この第1章は専門家レビュー前の教材案です。文字名など資料で照合できた範囲と、発音・語義など未検証の内容を区別しています。
          <Link href="/characters#content-sources">
            出典と確認状況を見る <ArrowRight size={12} />
          </Link>
        </p>
      </div>
    </>
  );
}

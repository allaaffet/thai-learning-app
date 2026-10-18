"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Info,
  LockKeyhole,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { characters, chapter, lessons, sources } from "@/data/curriculum";
import type { ConsonantClass } from "@/lib/content-types";
import {
  getAccuracy,
  getStreak,
  getTotalXp,
  isLessonUnlocked,
} from "@/lib/progress";
import { useLearning } from "@/components/learning-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const classNames: Record<ConsonantClass, string> = {
  mid: "中子音",
  high: "高子音",
  low: "低子音",
};

const characterFilters: { id: "all" | ConsonantClass; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "mid", label: "中子音" },
  { id: "high", label: "高子音" },
  { id: "low", label: "低子音" },
];

export function CharactersPage() {
  const [filter, setFilter] = useState<"all" | ConsonantClass>("all");
  const [selectedId, setSelectedId] = useState(characters[0]?.id ?? "");
  const visibleCharacters = characters.filter(
    (character) => filter === "all" || character.consonantClass === filter,
  );
  const selected =
    visibleCharacters.find((character) => character.id === selectedId) ??
    visibleCharacters[0];
  const selectedSources = selected
    ? sources.filter((source) => selected.sourceIds.includes(source.id))
    : [];

  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">CHARACTER LIBRARY</p>
        <h1 className="page-title">文字を、ひとつずつ。</h1>
        <p className="page-description">
          第1章で出会う{characters.length}
          の子音。形と音を見比べて、少しずつ親しんでいきましょう。
        </p>
      </header>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="子音クラスで絞り込む"
      >
        {characterFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`min-h-11 rounded-full border px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#285b46] ${
              filter === item.id
                ? "border-[#285b46] bg-[#285b46] text-white"
                : "border-[#e0e5df] bg-white text-[#58645c] hover:border-[#285b46] hover:bg-[#f0f5ef]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="character-grid-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="character-grid-heading" className="section-heading">
              基本の子音
            </h2>
            <span className="text-sm text-[#77817b]">
              {visibleCharacters.length}文字
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-3">
            {visibleCharacters.map((character) => {
              const isSelected = selected?.id === character.id;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setSelectedId(character.id)}
                  aria-pressed={isSelected}
                  aria-controls="character-detail"
                  aria-label={`${character.thai}、${classNames[character.consonantClass]}の詳細`}
                  className={`flex min-h-36 flex-col items-center justify-center rounded-2xl border px-2 py-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#285b46] ${
                    isSelected
                      ? "border-[#285b46] bg-[#eaf2eb] shadow-[inset_0_0_0_1px_#285b46]"
                      : "border-[#e4e9e2] bg-white hover:border-[#9eb69f] hover:bg-[#f6f8f3]"
                  }`}
                >
                  <span
                    lang="th"
                    className="thai text-5xl leading-[1.65] text-[#285b46]"
                  >
                    {character.thai}
                  </span>
                  <span className="text-xs text-[#77817b]">
                    {classNames[character.consonantClass]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-start gap-2.5 text-sm leading-7 text-[#68746c]">
            <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              子音クラスは声調を読むための分類です。ここでは分類名に親しみ、詳しい規則は後の章で学びます。
            </p>
          </div>
        </section>

        {selected && (
          <Card
            id="character-detail"
            className="overflow-hidden p-0"
            aria-labelledby="character-detail-heading"
          >
            <div className="border-b border-[#e4e9e2] bg-[#f0f5ed] px-6 py-6 text-center sm:px-8">
              <div className="flex justify-center">
                <span className="badge">
                  {classNames[selected.consonantClass]}
                </span>
              </div>
              <span
                lang="th"
                className="thai block text-8xl leading-[1.6] text-[#285b46]"
              >
                {selected.thai}
              </span>
              <h2
                id="character-detail-heading"
                lang="th"
                className="thai text-2xl leading-[1.8] text-[#264a37]"
              >
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-[#68746c]">{selected.meaning}</p>
            </div>
            <div className="space-y-6 p-6 sm:p-8">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-[#77817b]">
                    初頭の音 / IPA
                  </dt>
                  <dd className="mt-2 text-lg font-medium text-[#285b46]">
                    {selected.initialIpa}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[#77817b]">
                    末子音の音 / IPA
                  </dt>
                  <dd className="mt-2 text-lg font-medium text-[#285b46]">
                    {selected.finalIpa ?? "この章では未導入"}
                  </dd>
                </div>
              </dl>
              <div className="rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm leading-7 text-[#68746c]">
                字母名の最初の音節：
                <span className="font-medium text-[#285b46]">
                  {selected.ipa}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#394a3f]">
                  この文字が使われる言葉
                </h3>
                <p
                  lang="th"
                  className="thai mt-2 text-3xl leading-[1.8] text-[#285b46]"
                >
                  {selected.example.thai}
                </p>
                <p className="text-sm text-[#77817b]">{selected.example.ipa}</p>
                <p className="mt-2 text-sm text-[#394a3f]">
                  {selected.example.meaning}
                </p>
                {selected.example.note && (
                  <p className="mt-2 text-xs leading-6 text-[#77817b]">
                    {selected.example.note}
                  </p>
                )}
              </div>
              <div
                id="content-sources"
                className="scroll-mt-6 border-t border-[#e4e9e2] pt-4 text-xs leading-6 text-[#77817b]"
              >
                <p className="font-medium text-[#57665c]">
                  {selected.verification === "source-checked"
                    ? "資料との照合済み"
                    : "教材案・未検証"}
                </p>
                <p>
                  資料との照合は、専門家による監修を意味しません。音声・筆順の機能は今後の開発対象です。
                </p>
                {selectedSources.length > 0 && (
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-2 text-[#285b46] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b46]">
                      教材の出典を見る
                    </summary>
                    <ul className="space-y-2 pl-4">
                      {selectedSources.map((source) => (
                        <li key={source.id}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-words underline decoration-[#aac0ab] underline-offset-4"
                          >
                            {source.title}（{source.publisher}
                            ・別タブで開きます）
                          </a>
                          <p>{source.scope}</p>
                          {source.access === "blocked" && (
                            <p>
                              この環境からは資料の閲覧を確認できていません。
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#eaf2eb] px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3">
          <BookOpen
            className="h-5 w-5 shrink-0 text-[#285b46]"
            aria-hidden="true"
          />
          <p className="text-sm leading-6 text-[#3e5b48]">
            文字の仕組みを、レッスンで確かめてみましょう。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/roadmap">
            ロードマップへ
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

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

      <section aria-labelledby="lesson-progress-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">
              CHAPTER {String(chapter.number).padStart(2, "0")}
            </p>
            <h2 id="lesson-progress-heading" className="section-heading">
              {chapter.title}
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

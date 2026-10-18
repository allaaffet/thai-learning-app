"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  LockKeyhole,
  Plus,
  Search,
} from "lucide-react";
import {
  languageSources,
  vocabularyCategories,
  vocabularyEntries,
} from "@/data/language";
import { courseLessons } from "@/data/course";
import { isLessonUnlocked } from "@/lib/progress";
import { useLearning } from "@/components/learning-provider";
import { useReview } from "@/components/review-provider";
import { SpeakButton } from "@/components/speech-practice";
import { Button } from "@/components/ui/button";

export function LanguageSources({
  sourceIds,
}: {
  sourceIds: readonly string[];
}) {
  const sources = languageSources.filter((source) =>
    sourceIds.includes(source.id),
  );
  return (
    <details className="language-sources">
      <summary>出典と確認範囲</summary>
      <p>
        教材案・専門家監修前です。出典との照合範囲は以下の記録をご確認ください。
      </p>
      {sources.map((source) => (
        <p key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title}（別タブ）
          </a>
          <br />
          {source.scope}
          {source.access === "blocked" &&
            " 本文を取得できず、教材の確認根拠にはしていません。"}
        </p>
      ))}
    </details>
  );
}

export function RelatedLanguageLessons({
  lessonIds,
}: {
  lessonIds: readonly string[];
}) {
  const { progress, ready } = useLearning();
  const lessons = courseLessons.filter((lesson) =>
    lessonIds.includes(lesson.id),
  );
  if (!lessons.length) return null;
  return (
    <div className="language-related">
      <h4>関連レッスン</h4>
      <ul>
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            {ready && isLessonUnlocked(progress, lesson) ? (
              <Link href={`/lessons/${lesson.id}`}>
                <BookOpen size={14} aria-hidden="true" />
                {lesson.title}
              </Link>
            ) : (
              <span>
                <LockKeyhole size={13} aria-hidden="true" />
                {lesson.title} · 前提レッスンの完了後に学べます
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link href="/roadmap">
        学習順序をロードマップで確認する{" "}
        <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function VocabularyPage() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const { state, ready, storageMessage, addCard } = useReview();
  const [notice, setNotice] = useState("");
  const search = query.trim().toLocaleLowerCase("ja");
  const entries = vocabularyEntries.filter(
    (entry) =>
      (categoryId === "all" || entry.categoryId === categoryId) &&
      [
        entry.thai,
        entry.meaning,
        entry.ipa,
        entry.example.thai,
        entry.example.meaning,
      ].some((value) => value.toLocaleLowerCase("ja").includes(search)),
  );

  return (
    <div className="language-page">
      <header className="page-header language-page-header">
        <div>
          <p className="eyebrow">WORDS IN CONTEXT</p>
          <h1 className="page-title">ことばを、少しずつ。</h1>
          <p className="page-description">
            文字から意味へ、意味からひとことへ。気になる単語を、例文と一緒に確かめましょう。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/review">
            単語の復習へ <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <div className="language-disclosure">
        <strong>
          基本語彙 {vocabularyEntries.length}語 · 教材案・専門家監修前
        </strong>
        <p>
          IPA・語義・例文は専門家の監修前です。音声は端末の合成音声（未監修）で、提供元への通信が発生する場合があります。タイ語の声がない端末では再生できません。
        </p>
      </div>

      <div className="language-toolbar surface">
        <div className="language-search">
          <label htmlFor="vocabulary-search">単語を検索</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="vocabulary-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="タイ語・日本語・IPA"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="language-filter">
          <label htmlFor="vocabulary-category">カテゴリー</label>
          <select
            id="vocabulary-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="all">すべてのカテゴリー</option>
            {vocabularyCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <p className="language-result-count" role="status">
          {entries.length}語を表示
        </p>
      </div>

      {storageMessage && (
        <p className="language-storage-notice" role="status">
          {storageMessage}
        </p>
      )}
      {notice && (
        <p className="language-notice" role="status">
          {notice}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="surface language-empty">
          <Search size={28} aria-hidden="true" />
          <h2>該当する単語がありません</h2>
          <p>検索する文字を短くするか、カテゴリーを変えてお試しください。</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setCategoryId("all");
            }}
          >
            検索条件をリセット
          </Button>
        </div>
      ) : (
        <div className="vocabulary-grid">
          {entries.map((entry) => {
            const registered = Boolean(state.cards[entry.id]);
            const category = vocabularyCategories.find(
              (item) => item.id === entry.categoryId,
            );
            return (
              <article
                key={entry.id}
                id={entry.id}
                className="surface vocabulary-card"
                aria-labelledby={`vocabulary-${entry.id}`}
              >
                <div className="vocabulary-card-meta">
                  <span>{category?.label ?? "基本語彙"}</span>
                  <span>A1</span>
                </div>
                <h2 className="thai" lang="th" id={`vocabulary-${entry.id}`}>
                  {entry.thai}
                </h2>
                <p className="language-ipa">{entry.ipa}</p>
                <p className="vocabulary-meaning">{entry.meaning}</p>
                <p className="vocabulary-syllables">
                  音節：
                  {entry.syllables.map((syllable, index) => (
                    <span key={`${entry.id}-${index}`}>
                      <span className="thai" lang="th">
                        {syllable}
                      </span>
                      {index < entry.syllables.length - 1 && " / "}
                    </span>
                  ))}
                </p>
                <div className="vocabulary-example">
                  <p className="thai" lang="th">
                    {entry.example.thai}
                  </p>
                  <p className="language-ipa">{entry.example.ipa}</p>
                  <p>{entry.example.meaning}</p>
                  {entry.example.note && (
                    <p className="language-muted">{entry.example.note}</p>
                  )}
                </div>
                {entry.note && (
                  <p className="vocabulary-word-note">{entry.note}</p>
                )}
                <div className="vocabulary-actions">
                  <SpeakButton text={entry.thai} compact />
                  <Button
                    variant={registered ? "secondary" : "outline"}
                    size="sm"
                    disabled={!ready || registered}
                    aria-label={
                      registered
                        ? `${entry.thai} は登録済み`
                        : `${entry.thai} を復習に追加`
                    }
                    onClick={() => {
                      if (addCard(entry.id))
                        setNotice(
                          `「${entry.thai}」を復習に追加しました。単語の復習から練習できます。`,
                        );
                    }}
                  >
                    {registered ? (
                      <Check size={15} aria-hidden="true" />
                    ) : (
                      <Plus size={15} aria-hidden="true" />
                    )}
                    {registered ? "登録済み" : "復習に追加"}
                  </Button>
                </div>
                <details className="vocabulary-more">
                  <summary>関連する学び・出典</summary>
                  <RelatedLanguageLessons lessonIds={entry.relatedLessonIds} />
                  <LanguageSources sourceIds={entry.sourceIds} />
                </details>
              </article>
            );
          })}
        </div>
      )}
      <p className="language-bottom-note">
        復習に追加する単語は自分で選べます。登録や自己評価でXPは増えず、レッスンの前提条件も変わりません。カードはこのブラウザに保存されます。
      </p>
    </div>
  );
}

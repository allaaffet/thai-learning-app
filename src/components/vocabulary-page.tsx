"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  Clock3,
  Hash,
  Info,
  LockKeyhole,
  MessageCircle,
  MoveUpRight,
  Plus,
  Search,
  Shapes,
  Users,
  Volume2,
  type LucideIcon,
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

const categoryIcons: Record<string, LucideIcon> = {
  pronouns: Users,
  verbs: MoveUpRight,
  nouns: Boxes,
  qualities: Shapes,
  particles: MessageCircle,
  quantity: Hash,
  connections: Clock3,
};

export function LanguageDisclosure({
  count,
  kind,
}: {
  count: number;
  kind: "vocabulary" | "grammar";
}) {
  return (
    <div className="language-disclosure reference-disclosure">
      <div className="reference-disclosure-overview">
        <span className="reference-disclosure-badge">
          <Info size={16} aria-hidden="true" />
          教材案・専門家監修前
        </span>
        <span>
          {kind === "vocabulary"
            ? `基本語彙 ${count}語`
            : `基本文法 ${count}項目`}
        </span>
      </div>
      <p className="reference-audio-notice">
        <Volume2 size={15} aria-hidden="true" />
        合成音声は未監修・提供元へ通信する場合があります。
      </p>
      <details>
        <summary>教材と音声について</summary>
        <p>
          説明・IPA・語義・例文は専門家の監修前です。出典ごとの照合範囲は各項目から確認できます。
          音声は端末に依存し、タイ語の声がない端末では再生できません。
        </p>
      </details>
    </div>
  );
}

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
    <div className="language-page visual-reference-page">
      <header className="page-header language-page-header">
        <div>
          <p className="eyebrow">WORDS IN CONTEXT</p>
          <h1 className="page-title">ことばを、少しずつ。</h1>
          <p className="page-description">気になることばを、例文と一緒に。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/review">
            単語の復習へ <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <LanguageDisclosure count={vocabularyEntries.length} kind="vocabulary" />

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
            const CategoryIcon = categoryIcons[entry.categoryId] ?? BookOpen;
            return (
              <article
                key={entry.id}
                id={entry.id}
                className={`surface vocabulary-card vocabulary-visual-card category-${entry.categoryId}`}
                aria-labelledby={`vocabulary-${entry.id}`}
              >
                <div className="vocabulary-card-meta">
                  <span>
                    <CategoryIcon size={17} aria-hidden="true" />
                    {category?.label ?? "基本語彙"}
                  </span>
                  <span>A1</span>
                </div>
                <div className="vocabulary-word-visual">
                  <div>
                    <h2
                      className="thai"
                      lang="th"
                      id={`vocabulary-${entry.id}`}
                    >
                      {entry.thai}
                    </h2>
                    <p className="vocabulary-meaning">{entry.meaning}</p>
                    <p className="language-ipa">{entry.ipa}</p>
                  </div>
                  <span
                    className="vocabulary-category-visual"
                    aria-hidden="true"
                  >
                    <CategoryIcon size={42} strokeWidth={1.4} />
                  </span>
                </div>
                <div className="vocabulary-example">
                  <span className="reference-example-label">
                    <MessageCircle size={15} aria-hidden="true" />
                    ひとこと
                  </span>
                  <p className="thai" lang="th">
                    {entry.example.thai}
                  </p>
                  <p>{entry.example.meaning}</p>
                </div>
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
                <details className="vocabulary-more vocabulary-pronunciation-details">
                  <summary>音節・発音・補足</summary>
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
                  <p className="language-ipa">例文のIPA：{entry.example.ipa}</p>
                  {entry.note && (
                    <p className="vocabulary-word-note">{entry.note}</p>
                  )}
                  {entry.example.note && (
                    <p className="language-muted">{entry.example.note}</p>
                  )}
                </details>
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
      <details className="language-bottom-note reference-bottom-details">
        <summary>復習カードの保存について</summary>
        <p>
          復習に追加する単語は自分で選べます。登録や自己評価でXPは増えず、レッスンの前提条件も変わりません。カードはこのブラウザに保存されます。
        </p>
      </details>
    </div>
  );
}

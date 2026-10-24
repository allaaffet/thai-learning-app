"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, MessageCircle, Search } from "lucide-react";
import { grammarPoints, getVocabularyEntry } from "@/data/language";
import {
  LanguageSources,
  LanguageDisclosure,
  RelatedLanguageLessons,
} from "@/components/vocabulary-page";
import { SpeakButton } from "@/components/speech-practice";
import { Button } from "@/components/ui/button";

export function GrammarPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(grammarPoints[0]?.id ?? "");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const search = query.trim().toLocaleLowerCase("ja");
  const points = grammarPoints.filter((point) =>
    [point.title, point.summary, point.pattern, ...point.explanation].some(
      (value) => value.toLocaleLowerCase("ja").includes(search),
    ),
  );
  const selected = points.find((point) => point.id === selectedId) ?? points[0];

  useEffect(() => {
    let mounted = true;
    function readHash() {
      let id = "";
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (grammarPoints.some((point) => point.id === id)) {
        queueMicrotask(() => {
          if (mounted) {
            setSelectedId(id);
            setQuery("");
          }
        });
      }
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => {
      mounted = false;
      window.removeEventListener("hashchange", readHash);
    };
  }, []);

  function selectPoint(id: string) {
    setSelectedId(id);
    window.history.replaceState(
      window.history.state,
      "",
      `#${encodeURIComponent(id)}`,
    );
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => {
        detailHeading.current?.focus({ preventScroll: true });
        detailHeading.current?.scrollIntoView({ block: "start" });
      });
    }
  }

  return (
    <div className="language-page visual-reference-page">
      <header className="page-header">
        <p className="eyebrow">GRAMMAR REFERENCE</p>
        <h1 className="page-title">文の仕組みを、つかむ。</h1>
        <p className="page-description">語順を見つけると、ことばがつながる。</p>
      </header>
      <LanguageDisclosure count={grammarPoints.length} kind="grammar" />
      <div className="grammar-layout">
        <aside className="surface grammar-navigation" aria-label="文法項目">
          <div className="language-search">
            <label htmlFor="grammar-search">文法を検索</label>
            <div>
              <Search size={17} aria-hidden="true" />
              <input
                id="grammar-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="語順・否定・疑問など"
              />
            </div>
          </div>
          <p className="grammar-result-count" role="status">
            {points.length}項目を表示
          </p>
          <ul>
            {points.map((point, index) => (
              <li key={point.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === point.id}
                  aria-controls="grammar-detail"
                  onClick={() => selectPoint(point.id)}
                >
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{point.title}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <Link href="/roadmap" className="grammar-roadmap-link">
            <BookOpen size={15} aria-hidden="true" />
            順番に学ぶ
          </Link>
        </aside>

        {selected ? (
          <article
            className="surface grammar-detail"
            id="grammar-detail"
            aria-labelledby="grammar-detail-heading"
            key={selected.id}
          >
            <p className="eyebrow">UNDERSTAND THE PATTERN</p>
            <h2 id="grammar-detail-heading" tabIndex={-1} ref={detailHeading}>
              {selected.title}
            </h2>
            <p className="grammar-summary">{selected.summary}</p>
            <section
              className="grammar-pattern"
              aria-labelledby="grammar-pattern-heading"
            >
              <h3 id="grammar-pattern-heading">文の組み立て</h3>
              <div className="grammar-pattern-visual">
                {selected.pattern.split(" ／ ").map((pattern, patternIndex) => (
                  <div
                    className="grammar-pattern-alternative"
                    key={`${selected.id}-pattern-${patternIndex}`}
                  >
                    {patternIndex > 0 && (
                      <span className="grammar-pattern-separator">／</span>
                    )}
                    <div className="grammar-pattern-row">
                      {pattern.split(" ＋ ").map((part, partIndex) => (
                        <span
                          className="grammar-pattern-step"
                          key={`${selected.id}-pattern-${patternIndex}-${partIndex}`}
                        >
                          {partIndex > 0 && (
                            <ArrowRight size={17} aria-hidden="true" />
                          )}
                          <span>{part}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <details
              className="grammar-explanation"
              aria-labelledby="grammar-explanation-heading"
            >
              <summary>
                <h3 id="grammar-explanation-heading">日本語との違い・考え方</h3>
              </summary>
              {selected.explanation.map((paragraph, index) => (
                <p key={`${selected.id}-explanation-${index}`}>{paragraph}</p>
              ))}
            </details>
            <section
              className="grammar-examples"
              aria-labelledby="grammar-examples-heading"
            >
              <h3 id="grammar-examples-heading">例文で確かめる</h3>
              {selected.examples.map((example, index) => (
                <div
                  className="grammar-example"
                  key={`${selected.id}-example-${index}`}
                >
                  <span className="reference-example-label">
                    <MessageCircle size={15} aria-hidden="true" />
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="thai grammar-example-thai" lang="th">
                    {example.thai}
                  </p>
                  <p className="grammar-example-meaning">{example.meaning}</p>
                  <dl className="grammar-segments" aria-label="語句の役割">
                    {example.segments.map((segment, segmentIndex) => (
                      <div
                        key={`${selected.id}-${index}-segment-${segmentIndex}`}
                      >
                        <dt className="thai" lang="th">
                          {segment.thai}
                        </dt>
                        <dd>
                          <span
                            className="grammar-role-number"
                            aria-hidden="true"
                          >
                            {segmentIndex + 1}
                          </span>
                          {segment.role}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <SpeakButton text={example.thai} compact />
                  <details className="grammar-example-details">
                    <summary>発音・補足を確認</summary>
                    <p className="language-ipa">{example.ipa}</p>
                    {example.note && (
                      <p className="language-muted">{example.note}</p>
                    )}
                  </details>
                </div>
              ))}
            </section>
            <section
              className="grammar-vocabulary"
              aria-labelledby="grammar-vocabulary-heading"
            >
              <h3 id="grammar-vocabulary-heading">一緒に覚えたい単語</h3>
              <div>
                {selected.vocabularyIds.map((id) => {
                  const entry = getVocabularyEntry(id);
                  return entry ? (
                    <Link
                      key={id}
                      href={`/vocabulary#${encodeURIComponent(id)}`}
                    >
                      <span className="thai" lang="th">
                        {entry.thai}
                      </span>
                      <span>{entry.meaning}</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  ) : null;
                })}
              </div>
            </section>
            <RelatedLanguageLessons lessonIds={selected.relatedLessonIds} />
            <LanguageSources sourceIds={selected.sourceIds} />
          </article>
        ) : (
          <div className="surface language-empty">
            <Search size={28} aria-hidden="true" />
            <h2>該当する文法項目がありません</h2>
            <p>「語順」「否定」など、短いことばでお試しください。</p>
            <Button variant="outline" onClick={() => setQuery("")}>
              検索条件をリセット
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Info, PencilLine, Search } from "lucide-react";
import { alphabetCharacters, vowelPatterns } from "@/data/alphabet";
import { courseSources } from "@/data/course";
import type { ConsonantClass } from "@/lib/content-types";
import type { VowelPattern } from "@/lib/alphabet-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const classes: Record<ConsonantClass, string> = {
  mid: "中子音",
  high: "高子音",
  low: "低子音",
};
const lengths: Record<VowelPattern["length"], string> = {
  short: "短母音",
  long: "長母音",
  special: "特殊・変化形",
};
const positions: Record<VowelPattern["position"], string> = {
  above: "子音の上",
  below: "子音の下",
  before: "子音の前",
  after: "子音の後",
  surround: "子音の周囲",
};

function SourceNotice({
  sourceIds,
  all = false,
}: {
  sourceIds: string[];
  all?: boolean;
}) {
  return (
    <div id={all ? "content-sources" : undefined} className="source-note">
      <strong>教材案・専門家監修前</strong>
      <p>
        Unicode資料との照合は文字の識別・名前に限ります。発音・語義・用例は専門家による検証前です。録音音声は未収録です。
      </p>
      <details>
        <summary>出典と確認範囲を見る</summary>
        {courseSources
          .filter((source) => sourceIds.includes(source.id))
          .map((source) => (
            <p key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}（別タブ）
              </a>
              <br />
              {source.scope}
              {source.access === "blocked" &&
                " この環境から本文を取得できず、教材の確認根拠にはしていません。"}
            </p>
          ))}
      </details>
    </div>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function CharactersPage() {
  const [kind, setKind] = useState<"consonant" | "vowel">("consonant");
  const [query, setQuery] = useState("");
  const [consonantClass, setClass] = useState<"all" | ConsonantClass>("all");
  const [length, setLength] = useState<"all" | VowelPattern["length"]>("all");
  const [characterId, setCharacterId] = useState(alphabetCharacters[0].id);
  const [vowelId, setVowelId] = useState(vowelPatterns[0].id);
  const search = query.trim().toLocaleLowerCase("ja");
  const characters = alphabetCharacters.filter(
    (entry) =>
      (consonantClass === "all" || entry.consonantClass === consonantClass) &&
      [
        entry.thai,
        entry.name,
        entry.meaning,
        entry.initialIpa,
        entry.example.thai,
        entry.example.meaning,
      ].some((text) => text.toLocaleLowerCase("ja").includes(search)),
  );
  const vowels = vowelPatterns.filter(
    (entry) =>
      (length === "all" || entry.length === length) &&
      [
        entry.pattern,
        entry.ipa,
        entry.example.thai,
        entry.example.meaning,
      ].some((text) => text.toLocaleLowerCase("ja").includes(search)),
  );
  const selected =
    characters.find((entry) => entry.id === characterId) ?? characters[0];
  const vowel = vowels.find((entry) => entry.id === vowelId) ?? vowels[0];
  const pair = vowelPatterns.find((entry) => entry.id === vowel?.pairId);
  function revealDetail(id: string) {
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => {
        const detail = document.getElementById(id);
        detail?.querySelector("h2")?.focus({ preventScroll: true });
        detail?.scrollIntoView({ block: "start" });
      });
    }
  }
  function changeKind(value: "consonant" | "vowel") {
    setKind(value);
    setQuery("");
  }

  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">CHARACTER LIBRARY</p>
        <h1 className="page-title">文字を、ひとつずつ。</h1>
        <p className="page-description">
          44の子音と、32の母音パターン。形・音・意味を結び付ける、あなたの文字ノート。
        </p>
      </header>
      <div className="library-toolbar">
        <div className="filter-row" role="group" aria-label="文字の種類">
          <FilterButton
            active={kind === "consonant"}
            onClick={() => changeKind("consonant")}
          >
            子音44文字
          </FilterButton>
          <FilterButton
            active={kind === "vowel"}
            onClick={() => changeKind("vowel")}
          >
            母音32パターン
          </FilterButton>
        </div>
        <label className="library-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">文字・名前・意味を検索</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="文字・名前・意味で探す"
          />
        </label>
      </div>
      {kind === "consonant" ? (
        <>
          <div
            className="filter-row"
            role="group"
            aria-label="子音クラスで絞り込む"
          >
            <FilterButton
              active={consonantClass === "all"}
              onClick={() => setClass("all")}
            >
              すべて
            </FilterButton>
            {Object.entries(classes).map(([value, label]) => (
              <FilterButton
                key={value}
                active={consonantClass === value}
                onClick={() => setClass(value as ConsonantClass)}
              >
                {label}
              </FilterButton>
            ))}
          </div>
          <div className="library-layout">
            <section aria-labelledby="character-grid-heading">
              <div className="library-grid-heading">
                <h2 id="character-grid-heading">子音の一覧</h2>
                <span role="status">{characters.length}文字</span>
              </div>
              <div className="alphabet-grid">
                {characters.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className="alphabet-tile"
                    aria-pressed={selected?.id === entry.id}
                    aria-controls="character-detail"
                    aria-label={`${entry.thai}、${classes[entry.consonantClass]}の詳細`}
                    onClick={() => {
                      setCharacterId(entry.id);
                      revealDetail("character-detail");
                    }}
                  >
                    <span className="thai" lang="th">
                      {entry.thai}
                    </span>
                    <small>{classes[entry.consonantClass]}</small>
                    {entry.usage === "obsolete" && (
                      <small className="obsolete-label">廃用字</small>
                    )}
                  </button>
                ))}
              </div>
              {!characters.length && (
                <p className="surface p-6">
                  一致する文字がありません。検索語や分類を変えてみましょう。
                </p>
              )}
              <p className="library-help">
                <Info size={17} />
                クラスは声調を読むための分類です。字形の似た文字も、音とクラスを一緒に確かめましょう。
              </p>
            </section>
            {selected && (
              <Card
                id="character-detail"
                className="alphabet-detail"
                aria-labelledby="character-detail-heading"
              >
                <div className="alphabet-detail-head">
                  <span className="badge">
                    {classes[selected.consonantClass]}
                  </span>
                  {selected.usage === "obsolete" && (
                    <span className="badge neutral">
                      現在は通常使わない文字
                    </span>
                  )}
                  <span className="thai detail-glyph" lang="th">
                    {selected.thai}
                  </span>
                  <h2
                    id="character-detail-heading"
                    tabIndex={-1}
                    className="thai"
                    lang="th"
                  >
                    {selected.name}
                  </h2>
                  <p>{selected.meaning}</p>
                </div>
                <div className="alphabet-detail-body">
                  <a
                    className="text-link mobile-detail-back"
                    href="#character-grid-heading"
                  >
                    ↑ 子音の一覧に戻る
                  </a>
                  <dl className="sound-grid">
                    <div>
                      <dt>初頭の音 / IPA</dt>
                      <dd>
                        {selected.initialIpa}
                        {selected.alternateInitialIpa?.map((ipa) => (
                          <span key={ipa}>・{ipa}</span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt>末子音の音 / IPA</dt>
                      <dd>{selected.finalIpa ?? "通常は使いません"}</dd>
                    </div>
                  </dl>
                  <p className="subtle-note">
                    字母名の最初の音節：{selected.ipa}
                  </p>
                  {selected.note && (
                    <p className="subtle-note">{selected.note}</p>
                  )}
                  <div>
                    <h3>この文字が使われる言葉</h3>
                    <p className="thai example-thai" lang="th">
                      {selected.example.thai}
                    </p>
                    <p>{selected.example.ipa}</p>
                    <p>{selected.example.meaning}</p>
                    {selected.example.note && (
                      <p className="muted">{selected.example.note}</p>
                    )}
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/writing?character=${selected.id}`}>
                      <PencilLine size={16} />
                      この文字を書いてみる
                    </Link>
                  </Button>
                  <SourceNotice sourceIds={selected.sourceIds} />
                </div>
              </Card>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            className="filter-row"
            role="group"
            aria-label="母音の長さで絞り込む"
          >
            <FilterButton
              active={length === "all"}
              onClick={() => setLength("all")}
            >
              すべて
            </FilterButton>
            {Object.entries(lengths).map(([value, label]) => (
              <FilterButton
                key={value}
                active={length === value}
                onClick={() => setLength(value as VowelPattern["length"])}
              >
                {label}
              </FilterButton>
            ))}
          </div>
          <p className="subtle-note">
            「-」は子音を置く位置です。基本形と代表的な変化形を収録しており、すべての綴り・例外を網羅する一覧ではありません。
          </p>
          <div className="library-layout">
            <section aria-labelledby="vowel-grid-heading">
              <div className="library-grid-heading">
                <h2 id="vowel-grid-heading">母音パターン</h2>
                <span role="status">{vowels.length}パターン</span>
              </div>
              <div className="alphabet-grid vowel-grid">
                {vowels.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    className="alphabet-tile"
                    aria-label={`${entry.pattern}、${lengths[entry.length]}の詳細`}
                    aria-pressed={vowel?.id === entry.id}
                    aria-controls="vowel-detail"
                    onClick={() => {
                      setVowelId(entry.id);
                      revealDetail("vowel-detail");
                    }}
                  >
                    <span className="thai" lang="th">
                      {entry.pattern}
                    </span>
                    <small>{entry.ipa}</small>
                    <small>{lengths[entry.length]}</small>
                  </button>
                ))}
              </div>
              {!vowels.length && (
                <p className="surface p-6">一致するパターンがありません。</p>
              )}
            </section>
            {vowel && (
              <Card
                id="vowel-detail"
                className="alphabet-detail"
                aria-labelledby="vowel-detail-heading"
              >
                <div className="alphabet-detail-head">
                  <span className="badge">{lengths[vowel.length]}</span>
                  <h2
                    id="vowel-detail-heading"
                    tabIndex={-1}
                    className="thai detail-glyph vowel-pattern"
                    lang="th"
                  >
                    {vowel.pattern}
                  </h2>
                  <p>
                    {vowel.ipa} · {positions[vowel.position]}
                  </p>
                </div>
                <div className="alphabet-detail-body">
                  <a
                    className="text-link mobile-detail-back"
                    href="#vowel-grid-heading"
                  >
                    ↑ 母音の一覧に戻る
                  </a>
                  <p>{vowel.note}</p>
                  {pair && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setLength("all");
                        setQuery("");
                        setVowelId(pair.id);
                      }}
                    >
                      長短の対を見る{" "}
                      <span className="thai" lang="th">
                        {pair.pattern}
                      </span>
                    </Button>
                  )}
                  <div>
                    <h3>用例</h3>
                    <p className="thai example-thai" lang="th">
                      {vowel.example.thai}
                    </p>
                    <p>{vowel.example.ipa}</p>
                    <p>{vowel.example.meaning}</p>
                    {vowel.example.note && (
                      <p className="muted">{vowel.example.note}</p>
                    )}
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/writing?vowel=${vowel.id}`}>
                      <PencilLine size={16} />
                      この用例を書いてみる
                    </Link>
                  </Button>
                  <SourceNotice sourceIds={vowel.sourceIds} />
                </div>
              </Card>
            )}
          </div>
        </>
      )}
      <section className="surface p-6" aria-label="教材全体の出典">
        <h2 className="mb-3 font-semibold">出典と教材の確認状況</h2>
        <SourceNotice
          all
          sourceIds={courseSources.map((source) => source.id)}
        />
      </section>
      <div className="library-bottom surface">
        <p>文字の仕組みを、レッスンで確かめてみましょう。</p>
        <Button asChild variant="outline">
          <Link href="/roadmap">
            ロードマップへ
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  analyzeEntry,
  lookupSyllable,
  syllableEntries,
  toneSources,
} from "@/data/syllables";
import { determineTone } from "@/lib/tone-engine";
import type { SyllableAnalysis, Tone } from "@/lib/tone-types";
import { SpeakButton, SpeechPractice } from "@/components/speech-practice";
import { Button } from "@/components/ui/button";
import { ToneContour, toneDescriptions } from "@/components/tone-contour";

const tones: Tone[] = ["mid", "low", "falling", "high", "rising"];
const classLabels = { mid: "中子音", high: "高子音", low: "低子音" };
const initialAnalysis: SyllableAnalysis = {
  consonantClass: "mid",
  vowelLength: "long",
  codaType: "none",
  toneMark: "none",
  onsetRule: "single",
};

function RuleResult({ result }: { result: ReturnType<typeof determineTone> }) {
  if (result.status === "unknown") {
    return (
      <div className="pronunciation-unknown" role="status">
        <CircleHelp size={22} aria-hidden="true" />
        <div>
          <h3>この条件では判定できません</h3>
          <p>{result.reason}</p>
          {result.steps.length > 0 && (
            <ol>
              {result.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }
  const tone = toneDescriptions[result.tone];
  return (
    <div className="pronunciation-rule-result">
      <div className="pronunciation-tone-answer">
        <div>
          <p className="eyebrow">
            {result.method === "dictionary"
              ? "辞書情報による補完"
              : "声調規則から"}
          </p>
          <h3>
            {tone.label}
            <span>{tone.ipa}</span>
          </h3>
          <p>{tone.description}</p>
        </div>
        <ToneContour tone={result.tone} compact />
      </div>
      <div className="pronunciation-result-tags">
        <span>{classLabels[result.effectiveClass]}</span>
        <span>{result.syllableType === "live" ? "生音節" : "死音節"}</span>
      </div>
      <ol className="pronunciation-rule-steps" aria-label="判定の理由">
        {result.steps.map((step, index) => (
          <li key={index}>
            <span aria-hidden="true">{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ManualConditions() {
  const [analysis, setAnalysis] = useState<SyllableAnalysis>(initialAnalysis);
  const result = determineTone(analysis);
  return (
    <details className="surface pronunciation-manual">
      <summary>
        <SlidersHorizontal size={19} aria-hidden="true" />
        条件を変えて試す
      </summary>
      <p className="pronunciation-manual-intro">
        自分で指定した条件から、声調規則の働きを確認できます。タイ文字を自動で読み取る機能ではありません。綴りの例外や複数音節の語には、この条件だけを当てはめないでください。
      </p>
      <div className="pronunciation-manual-fields">
        <label>
          初頭子音のクラス
          <select
            value={analysis.consonantClass}
            onChange={(event) => {
              const value = ["mid", "high", "low"].find(
                (item) => item === event.target.value,
              );
              if (value === "mid" || value === "high" || value === "low")
                setAnalysis({ ...analysis, consonantClass: value });
            }}
          >
            <option value="mid">中子音</option>
            <option value="high">高子音</option>
            <option value="low">低子音</option>
          </select>
        </label>
        <label>
          母音の長さ
          <select
            value={analysis.vowelLength}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "short" || value === "long")
                setAnalysis({ ...analysis, vowelLength: value });
            }}
          >
            <option value="short">短母音</option>
            <option value="long">長母音</option>
          </select>
        </label>
        <label>
          末子音の種類
          <select
            value={analysis.codaType}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "none" || value === "sonorant" || value === "stop")
                setAnalysis({ ...analysis, codaType: value });
            }}
          >
            <option value="none">なし（開音節）</option>
            <option value="sonorant">鼻音・接近音 /m n ŋ j w/</option>
            <option value="stop">閉鎖音 /p t k/</option>
          </select>
        </label>
        <label>
          声調記号
          <select
            value={analysis.toneMark}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "none" ||
                value === "mai-ek" ||
                value === "mai-tho" ||
                value === "mai-tri" ||
                value === "mai-chattawa"
              )
                setAnalysis({ ...analysis, toneMark: value });
            }}
          >
            <option value="none">記号なし</option>
            <option value="mai-ek">◌่ マーイエーク</option>
            <option value="mai-tho">◌้ マーイトー</option>
            <option value="mai-tri">◌๊ マーイトリー</option>
            <option value="mai-chattawa">◌๋ マーイチャッタワー</option>
          </select>
        </label>
        <label>
          初頭子音の扱い
          <select
            value={analysis.onsetRule}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "single" ||
                value === "true-cluster" ||
                value === "ho-nam" ||
                value === "o-nam"
              )
                setAnalysis({ ...analysis, onsetRule: value });
            }}
          >
            <option value="single">単子音</option>
            <option value="true-cluster">真正子音連続（先頭のクラス）</option>
            <option value="ho-nam">ห นำ（高子音として扱う）</option>
            <option value="o-nam">อ นำ（中子音として扱う）</option>
          </select>
        </label>
      </div>
      <section
        className="pronunciation-manual-result"
        aria-label="条件からの判定結果"
        aria-live="polite"
      >
        <RuleResult result={result} />
      </section>
    </details>
  );
}

export function ToneLab() {
  const [entryId, setEntryId] = useState(
    syllableEntries.find((entry) => entry.thai === "กา")?.id ??
      syllableEntries[0].id,
  );
  const [query, setQuery] = useState("");
  const [searchedWord, setSearchedWord] = useState<string | null>(null);
  const [comparisonTone, setComparisonTone] = useState<Tone>("mid");
  const entry =
    searchedWord === null
      ? syllableEntries.find((item) => item.id === entryId)
      : lookupSyllable(searchedWord);
  const result = entry ? analyzeEntry(entry) : undefined;
  const toneInfo = toneDescriptions[comparisonTone];
  const comparisonEntry = syllableEntries.find(
    (item) => item.expectedTone === comparisonTone,
  );

  function selectEntry(id: string) {
    setEntryId(id);
    setSearchedWord(null);
    setQuery("");
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) setSearchedWord(query.trim());
  }

  return (
    <div className="space-y-8 pronunciation-lab">
      <header className="page-header">
        <p className="eyebrow">PRONUNCIATION LAB</p>
        <h1 className="page-title">声調を、仕組みから。</h1>
        <p className="page-description">
          文字の組み合わせをほどいて、「なぜ、この音になるのか」を確かめましょう。
        </p>
      </header>

      <div className="pronunciation-lab-grid">
        <section
          className="surface pronunciation-explorer"
          aria-labelledby="syllable-explorer-heading"
        >
          <div className="pronunciation-section-heading">
            <span className="eyebrow">01 · EXPLORE</span>
            <span className="pronunciation-small-tag">登録済みの1音節</span>
          </div>
          <h2 id="syllable-explorer-heading">ひとつの音節を、分けてみる</h2>
          <label className="pronunciation-field" htmlFor="syllable-select">
            単語を選ぶ
            <select
              id="syllable-select"
              value={entry?.id ?? ""}
              onChange={(event) => selectEntry(event.target.value)}
            >
              <option value="" disabled>
                単語を選んでください
              </option>
              {syllableEntries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.thai} · {item.meaning}
                </option>
              ))}
            </select>
          </label>
          <form className="pronunciation-search" onSubmit={search}>
            <label htmlFor="syllable-search">タイ語の語を確認</label>
            <div>
              <span className="pronunciation-search-input">
                <Search size={18} aria-hidden="true" />
                <input
                  id="syllable-search"
                  className="thai"
                  lang="th"
                  type="search"
                  value={query}
                  maxLength={80}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例：กา、หมา"
                />
              </span>
              <Button type="submit" variant="outline" disabled={!query.trim()}>
                読み方を確認
              </Button>
            </div>
          </form>

          {entry ? (
            <section
              className="pronunciation-syllable"
              aria-label="音節の解析結果"
              data-testid="syllable-analysis-result"
            >
              <p className="sr-only" role="status" aria-atomic="true">
                登録語 {entry.thai}。
                {result?.status === "determined"
                  ? `声調は${toneDescriptions[result.tone].label}です。`
                  : "解析情報を確認中です。"}{" "}
                教材は専門家監修前です。
              </p>
              <div className="pronunciation-word">
                <span className="thai" lang="th">
                  {entry.thai}
                </span>
                <div>
                  <p className="pronunciation-ipa">
                    {result?.status === "determined"
                      ? entry.ipa
                      : "発音情報は確認中です"}
                  </p>
                  <p>{entry.meaning}</p>
                </div>
              </div>
              <dl className="pronunciation-decomposition">
                <div>
                  <dt>初頭子音の綴り</dt>
                  <dd className="thai" lang="th">
                    {entry.onset || "—"}
                  </dd>
                </div>
                <div>
                  <dt>母音の形</dt>
                  <dd className="thai" lang="th">
                    {entry.vowel || "—"}
                  </dd>
                </div>
                <div>
                  <dt>末子音字</dt>
                  <dd className="thai" lang="th">
                    {entry.coda || "なし"}
                  </dd>
                </div>
              </dl>
              <p className="pronunciation-decomposition-note">
                文字の構成を示しています。母音は子音の前・上・下にも置かれます。末子音字がなくても、母音の綴りに含まれる末音や、短母音末の
                /ʔ/ が生死音節に関わります。
              </p>
              {entry.note && (
                <p className="pronunciation-entry-note">{entry.note}</p>
              )}
              {result?.status === "determined" && (
                <SpeakButton key={entry.id} text={entry.thai} />
              )}
              {result && <RuleResult result={result} />}
              <details className="source-note pronunciation-sources">
                <summary>出典と確認範囲</summary>
                <p>
                  {entry.verification === "source-checked"
                    ? "記載資料と照合した教材です。専門家による監修・正確性の保証を表すものではありません。"
                    : "教材案・専門家監修前です。規則と語の情報を、以下の資料に照らして確認します。"}
                </p>
                {toneSources
                  .filter((source) => entry.sourceIds.includes(source.id))
                  .map((source) => (
                    <p key={source.id}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}（別タブ）
                      </a>
                      <br />
                      {source.scope}
                      {source.access === "blocked" &&
                        " この環境から本文を確認できず、照合済みの根拠にはしていません。"}
                    </p>
                  ))}
              </details>
            </section>
          ) : (
            <div
              className="pronunciation-unknown pronunciation-search-unknown"
              role="status"
            >
              <CircleHelp size={25} aria-hidden="true" />
              <div>
                <h3>この語はまだ解析できません</h3>
                <p>
                  現在は、登録済みの1音節だけを扱います。未登録の語や複数音節の語について、発音や声調を推測して表示しません。上の一覧から、別の語を選んでください。
                </p>
              </div>
            </div>
          )}
        </section>

        <section
          className="surface pronunciation-comparison"
          aria-labelledby="tone-comparison-heading"
        >
          <p className="eyebrow">02 · COMPARE</p>
          <h2 id="tone-comparison-heading">5つの、高さの動き</h2>
          <p className="pronunciation-section-copy">
            ひとつずつ選んで、声調の形を比べましょう。
          </p>
          <div
            className="pronunciation-tone-options"
            role="group"
            aria-label="比較する声調"
          >
            {tones.map((tone) => (
              <button
                key={tone}
                type="button"
                className={`pronunciation-tone-option${tone === comparisonTone ? " active" : ""}`}
                aria-pressed={tone === comparisonTone}
                aria-label={`${toneDescriptions[tone].label}を表示`}
                onClick={() => setComparisonTone(tone)}
              >
                <ToneContour tone={tone} compact />
                <span>{toneDescriptions[tone].label}</span>
              </button>
            ))}
          </div>
          <div className="pronunciation-selected-tone" aria-live="polite">
            <div className="pronunciation-tone-title">
              <h3>{toneInfo.label}</h3>
              <span>{toneInfo.ipa}</span>
            </div>
            <ToneContour tone={comparisonTone} />
            <p>{toneInfo.description}</p>
            <small>Chao五度式：{toneInfo.chao}（1＝低い、5＝高い）</small>
            {comparisonEntry && (
              <button
                type="button"
                className="pronunciation-example-link"
                onClick={() => selectEntry(comparisonEntry.id)}
              >
                <span className="thai" lang="th">
                  {comparisonEntry.thai}
                </span>
                <span>
                  {comparisonEntry.meaning}
                  <br />
                  <small>この語を解析する</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="pronunciation-chart-note">
            曲線とIPAは高さの動きの概略です。録音の音高を計測したグラフではありません。実際の高さは話者・文脈によって変わります。
          </p>
        </section>
      </div>

      <ManualConditions />
      <SpeechPractice />

      <div className="pronunciation-next-note surface">
        <BookOpen size={24} aria-hidden="true" />
        <div>
          <h2>順番に学ぶと、規則がつながる。</h2>
          <p>
            生音節・死音節、子音クラス、声調記号。レッスンでは、ひとつずつ練習できます。このラボの操作によるXP加算はありません。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/roadmap">
            学習マップへ
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

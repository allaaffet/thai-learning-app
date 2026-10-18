"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Info, PencilLine } from "lucide-react";
import { alphabetCharacters, vowelPatterns } from "@/data/alphabet";
import { getReferenceStrokeGuide } from "@/data/stroke-guides";
import { HandwritingPad } from "@/components/handwriting-pad";
import { Button } from "@/components/ui/button";

export function WritingPage({
  initialCharacterId,
  initialVowelId,
}: {
  initialCharacterId: string;
  initialVowelId?: string;
}) {
  const [kind, setKind] = useState<"consonant" | "vowel">(
    initialVowelId ? "vowel" : "consonant",
  );
  const [characterId, setCharacterId] = useState(initialCharacterId);
  const [vowelId, setVowelId] = useState(initialVowelId ?? vowelPatterns[0].id);
  const character =
    alphabetCharacters.find((entry) => entry.id === characterId) ??
    alphabetCharacters[0];
  const vowel =
    vowelPatterns.find((entry) => entry.id === vowelId) ?? vowelPatterns[0];
  const thai = kind === "consonant" ? character.thai : vowel.example.thai;
  const characterName =
    kind === "consonant" ? character.name : vowel.example.meaning;
  return (
    <div className="space-y-8">
      <header className="page-header">
        <p className="eyebrow">WRITING STUDIO</p>
        <h1 className="page-title">手を動かすと、形が見えてくる。</h1>
        <p className="page-description">
          指でも、マウスでも。ゆっくりなぞって、タイ文字に親しみましょう。
        </p>
      </header>
      <div className="writing-layout">
        <section
          className="surface writing-selector"
          aria-labelledby="writing-selection-heading"
        >
          <span className="mini-icon">
            <PencilLine size={21} />
          </span>
          <h2 id="writing-selection-heading">今日の一文字</h2>
          <div className="filter-row" role="group" aria-label="書き取りの種類">
            <Button
              variant={kind === "consonant" ? "default" : "outline"}
              aria-pressed={kind === "consonant"}
              onClick={() => setKind("consonant")}
            >
              子音
            </Button>
            <Button
              variant={kind === "vowel" ? "default" : "outline"}
              aria-pressed={kind === "vowel"}
              onClick={() => setKind("vowel")}
            >
              母音の用例
            </Button>
          </div>
          {kind === "consonant" ? (
            <>
              <label
                className="writing-select-label"
                htmlFor="writing-character"
              >
                練習する子音
              </label>
              <select
                className="writing-select thai"
                id="writing-character"
                value={character.id}
                onChange={(event) => setCharacterId(event.target.value)}
              >
                {alphabetCharacters.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.usage === "obsolete" ? "（廃用字）" : ""}
                  </option>
                ))}
              </select>
              <p className="writing-preview thai" lang="th">
                {character.thai}
              </p>
              <p>{character.meaning}</p>
              <p className="muted">初頭音 {character.initialIpa}</p>
              {character.note && (
                <p className="subtle-note">{character.note}</p>
              )}
            </>
          ) : (
            <>
              <label className="writing-select-label" htmlFor="writing-vowel">
                練習する母音の用例
              </label>
              <select
                className="writing-select thai"
                id="writing-vowel"
                value={vowel.id}
                onChange={(event) => setVowelId(event.target.value)}
              >
                {vowelPatterns.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.pattern} · {entry.example.thai}
                  </option>
                ))}
              </select>
              <p className="writing-preview thai" lang="th">
                {vowel.pattern}
              </p>
              <p>{vowel.ipa}</p>
              <p className="subtle-note">
                母音記号の位置がわかるよう、用例「
                <span className="thai" lang="th">
                  {vowel.example.thai}
                </span>
                」全体を練習します。{vowel.example.meaning}。
                {vowel.example.note}
              </p>
            </>
          )}
          <details className="source-note writing-notes">
            <summary>手本と保存について</summary>
            <Info size={17} />
            <p>
              形を覚える練習です。手本は標準のループあり字体に固定しています。発音・用例は専門家監修前です。
            </p>
            <p>
              描いた線は保存されません。文字の変更や画面を離れると消えます。自動採点・XP加算はありません。
            </p>
          </details>
          <Button asChild variant="outline">
            <Link href="/characters">
              <ArrowLeft size={16} />
              文字ノートへ
            </Link>
          </Button>
        </section>
        <section aria-label="書き取りの練習">
          <HandwritingPad
            key={`${kind}-${kind === "consonant" ? character.id : vowel.id}`}
            thai={thai}
            characterName={characterName}
            strokeGuide={
              kind === "consonant"
                ? getReferenceStrokeGuide(character.id)
                : undefined
            }
          />
        </section>
      </div>
      <div className="content-status">
        <span>運筆例について</span>
        <p>
          出典の記録軌跡を確認できた ก・ง・จ・ม
          の4文字に、参考の運筆アニメーションを用意しました。標準筆順の正しさは未検証です。ほかの文字には未確認の筆順を表示しません。
          <a
            href="/licenses/ThaiWritingPractice-MIT.txt"
            target="_blank"
            rel="noreferrer"
          >
            データのMITライセンス（別タブ）
          </a>
        </p>
      </div>
    </div>
  );
}

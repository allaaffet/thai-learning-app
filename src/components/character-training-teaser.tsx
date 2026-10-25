import Link from "next/link";
import { ArrowRight, Headphones } from "lucide-react";

export function CharacterTrainingTeaser() {
  return (
    <section
      className="character-training-teaser"
      aria-label="タイ文字を覚える練習"
    >
      <div className="character-training-teaser-letters" aria-hidden="true">
        {["ก", "ม", "น", "ง"].map((letter) => (
          <span className="thai" lang="th" key={letter}>
            {letter}
          </span>
        ))}
      </div>
      <div className="character-training-teaser-copy">
        <span>
          <Headphones size={17} aria-hidden="true" /> 文字の読み方を、音から
        </span>
        <h2>4文字から、聞いて覚えよう。</h2>
        <p>名前を聞く → 8問チャレンジ → 聞き直す。</p>
      </div>
      <Link
        className="character-training-teaser-link"
        href="/character-practice"
      >
        文字をゲームで覚える <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

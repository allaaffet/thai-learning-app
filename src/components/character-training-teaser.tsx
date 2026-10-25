import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";

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
          <Link2 size={17} aria-hidden="true" /> 音と文字のペアを見つけよう
        </span>
        <h2>つなげるたび、文字がわかる。</h2>
        <p>ペアさがし → 並べ替えてもう1周 → 8問で確認。</p>
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

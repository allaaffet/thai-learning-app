import Link from "next/link";
import { ArrowRight, Gamepad2 } from "lucide-react";

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
          <Gamepad2 size={17} aria-hidden="true" /> 文字が苦手なら、ここから
        </span>
        <h2>4文字から、覚える楽しさを。</h2>
        <p>見て覚える → 8問チャレンジ → もう一度。</p>
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

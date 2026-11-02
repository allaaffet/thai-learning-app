import Link from "next/link";
import { ArrowRight, Heart, MessagesSquare } from "lucide-react";
import { romanceCharacters } from "@/data/romance";
import { RomancePortrait } from "@/components/romance-portrait";
import { Button } from "@/components/ui/button";

export function RomanceTeaser() {
  return (
    <section
      className="romance-teaser surface"
      aria-label="恋するタイ語の実践コース"
    >
      <div className="romance-teaser-copy">
        <p className="eyebrow">
          <Heart size={17} aria-hidden="true" />
          実践編・恋するタイ語
        </p>
        <h2>会話をつないで、ふたりの物語へ。</h2>
        <p>
          選んだ道で、表情も思い出も変わる。挨拶から一歩ずつ、6人の登場人物とタイ語を使ってみよう。
        </p>
        <Button asChild variant="outline">
          <Link href="/romance">
            <MessagesSquare size={17} aria-hidden="true" />
            物語をはじめる
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </Button>
        <small>
          成人キャラクターのフィクションです。好感度は物語の進行を表します。
        </small>
      </div>
      <div className="romance-teaser-cast" aria-hidden="true">
        {romanceCharacters
          .filter(
            (character) => character.id === "mali" || character.id === "arun",
          )
          .map((character) => (
            <RomancePortrait character={character} key={character.id} />
          ))}
      </div>
    </section>
  );
}

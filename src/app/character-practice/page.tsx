import type { Metadata } from "next";
import { CharacterTraining } from "@/components/character-training";
import { alphabetCharacters } from "@/data/alphabet";

export const metadata: Metadata = {
  title: "文字トレーニング",
  description:
    "音や読み方とタイ文字をつなぐペアさがしと、8問チャレンジで読み方を繰り返し覚えます。",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialFocus =
    typeof params.focus === "string" &&
    alphabetCharacters.some((entry) => entry.id === params.focus)
      ? params.focus
      : undefined;
  return (
    <CharacterTraining
      key={initialFocus ?? "saved"}
      initialFocus={initialFocus}
    />
  );
}

import type { Metadata } from "next";
import { CharacterTraining } from "@/components/character-training";
import { alphabetCharacters } from "@/data/alphabet";

export const metadata: Metadata = {
  title: "文字トレーニング",
  description:
    "タイ文字の名前と例語を聞き、音声から文字を選ぶ8問の練習で読み方を覚えます。",
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

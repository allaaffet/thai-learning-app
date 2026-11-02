import type { Metadata } from "next";
import { RomanceCourse } from "@/components/romance-course";

export const metadata: Metadata = {
  title: "恋するタイ語 — 実践編",
  description:
    "架空の成人キャラクターとの短い会話でタイ語を学ぶ、台本付きの恋愛シミュレーション。挨拶、カフェ、好きなもの、買い物、街歩きの5つの場面を楽しめます。",
};

export default async function RomancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  return <RomanceCourse classic={view === "classic"} />;
}

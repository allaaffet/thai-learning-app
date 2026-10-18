import type { Metadata } from "next";
import { CharactersPage } from "@/components/library-pages";

export const metadata: Metadata = {
  title: "文字ライブラリ",
  description:
    "第1章で学ぶタイ文字の形、子音クラス、音価、例語を確認できます。",
};

export default function Page() {
  return <CharactersPage />;
}

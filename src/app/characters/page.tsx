import type { Metadata } from "next";
import { CharactersPage } from "@/components/alphabet-library";

export const metadata: Metadata = {
  title: "文字ライブラリ",
  description:
    "44子音と32母音パターンの形、音価、用例を確認し、書き取りを練習できます。",
};

export default function Page() {
  return <CharactersPage />;
}

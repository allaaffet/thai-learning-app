import type { Metadata } from "next";
import { GrammarPage } from "@/components/grammar-page";

export const metadata: Metadata = {
  title: "文法リファレンス",
  description:
    "タイ語の基本的な文の組み立てを、日本語との比較と例文で調べられます。",
};

export default function Page() {
  return <GrammarPage />;
}

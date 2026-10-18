import type { Metadata } from "next";
import { VocabularyPage } from "@/components/vocabulary-page";

export const metadata: Metadata = {
  title: "単語帳",
  description:
    "タイ語の基本語彙を意味・IPA・例文で確かめ、自分の復習カードに追加できます。",
};

export default function Page() {
  return <VocabularyPage />;
}

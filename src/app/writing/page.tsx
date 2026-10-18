import type { Metadata } from "next";
import { WritingPage } from "@/components/writing-page";
import { alphabetCharacters, vowelPatterns } from "@/data/alphabet";

export const metadata: Metadata = {
  title: "書き取り練習",
  description: "タイ文字と母音の用例を、指やマウスでなぞって練習できます。",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ character?: string; vowel?: string }>;
}) {
  const params = await searchParams;
  const vowel = vowelPatterns.find((entry) => entry.id === params.vowel);
  const character =
    alphabetCharacters.find((entry) => entry.id === params.character) ??
    alphabetCharacters[0];
  return (
    <WritingPage
      key={vowel?.id ?? character.id}
      initialCharacterId={character.id}
      initialVowelId={vowel?.id}
    />
  );
}

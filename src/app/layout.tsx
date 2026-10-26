import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";
import "./visual-refresh.css";
import "./gamification.css";
import "./character-training.css";
import "./character-training-entry.css";
import "./character-pairs.css";
import "./lesson-games.css";
import "./lesson-journey.css";
import { AppShell } from "@/components/app-shell";
import { LearningProvider } from "@/components/learning-provider";
import { ReviewProvider } from "@/components/review-provider";
import { vocabularyEntries } from "@/data/language";
import { SoundEffectsProvider } from "@/components/sound-effects-provider";

export const metadata: Metadata = {
  title: {
    default: "Thai Learning — タイ語を、ひとつずつ。",
    template: "%s | Thai Learning",
  },
  description:
    "日本語で、文字と発音の仕組みから学ぶタイ語。44子音・母音と声調の仕組みを、短いレッスン・書き取り・声調ラボで学べます。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" data-thai-font="looped">
      <body>
        <LearningProvider>
          <ReviewProvider
            vocabularyIds={vocabularyEntries.map((entry) => entry.id)}
          >
            <SoundEffectsProvider>
              <AppShell>{children}</AppShell>
            </SoundEffectsProvider>
          </ReviewProvider>
        </LearningProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { LearningProvider } from "@/components/learning-provider";

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
          <AppShell>{children}</AppShell>
        </LearningProvider>
      </body>
    </html>
  );
}

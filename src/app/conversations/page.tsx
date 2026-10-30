import type { Metadata } from "next";
import { ConversationPractice } from "@/components/conversation-practice";

export const metadata: Metadata = {
  title: "会話ミッション",
  description:
    "あいさつ、カフェ、買い物、道案内。短いやりとりで、場面に合うタイ語の返答を練習します。",
};

export default function ConversationsPage() {
  return <ConversationPractice />;
}

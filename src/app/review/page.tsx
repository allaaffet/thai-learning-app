import type { Metadata } from "next";
import { ReviewPage } from "@/components/review-page";

export const metadata: Metadata = {
  title: "単語の復習",
  description:
    "登録したタイ語の単語を、間隔を空けながらフラッシュカードで復習します。",
};

export default function Page() {
  return <ReviewPage />;
}

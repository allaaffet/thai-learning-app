import type { Metadata } from "next";
import { RomanceCourse } from "@/components/romance-course";

export const metadata: Metadata = {
  title: "キャンパス恋愛編 — 恋するタイ語",
  description:
    "大学の社会人向け夜間講座を舞台に、成人の同級生との分岐ストーリーと段階的な会話練習でタイ語を使うコース。",
};

export default function CampusRomancePage() {
  return <RomanceCourse key="campus" setting="campus" />;
}

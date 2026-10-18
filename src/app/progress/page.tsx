import type { Metadata } from "next";
import { ProgressPage } from "@/components/library-pages";

export const metadata: Metadata = {
  title: "学習の記録",
  description: "レッスンの完了状況、XP、正答率、学習日数を振り返ります。",
};

export default function Page() {
  return <ProgressPage />;
}

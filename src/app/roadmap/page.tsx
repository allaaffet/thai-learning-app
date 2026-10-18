import type { Metadata } from "next";
import { Roadmap } from "@/components/roadmap";

export const metadata: Metadata = { title: "学習ロードマップ" };

export default function RoadmapPage() {
  return <Roadmap />;
}

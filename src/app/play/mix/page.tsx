import type { Metadata } from "next";
import { CourseMissionPlayer } from "@/components/course-mission-player";

export const metadata: Metadata = { title: "おまかせミックス" };
export default function MixedPracticePage() {
  return <CourseMissionPlayer />;
}

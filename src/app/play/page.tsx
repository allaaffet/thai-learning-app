import type { Metadata } from "next";
import { MissionHub } from "@/components/mission-hub";

export const metadata: Metadata = { title: "タイ語の冒険" };

export default function PlayPage() {
  return <MissionHub />;
}

import type { Metadata } from "next";
import { ToneLab } from "@/components/tone-lab";

export const metadata: Metadata = {
  title: "発音・声調ラボ",
  description:
    "タイ語の音節を子音・母音・末子音に分け、声調が決まる理由を順に確認します。",
};

export default function Page() {
  return <ToneLab />;
}

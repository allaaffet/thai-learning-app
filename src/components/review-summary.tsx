"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useReview } from "@/components/review-provider";
import { getReviewStats } from "@/lib/review";
import { Button } from "@/components/ui/button";

export function useLocalClock() {
  const [now, setNow] = useState<Date>();
  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (mounted) setNow(new Date());
    };
    queueMicrotask(update);
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

export function ReviewSummary() {
  const { state, ready, storageMessage } = useReview();
  const now = useLocalClock();
  const stats = ready && now ? getReviewStats(state, now) : undefined;
  return (
    <section
      className="surface phase4-review-summary"
      aria-label="今日の単語復習"
    >
      <div>
        <p className="eyebrow">A LITTLE, AGAIN</p>
        <h2>
          <RotateCcw size={20} aria-hidden="true" />
          今日の復習
        </h2>
        <p>
          {stats
            ? `${stats.dueCount}語が復習のタイミングです。登録した単語は${stats.totalCards}語。`
            : "復習予定を読み込み中…"}
        </p>
        <p className="muted text-sm">
          思い出すたび、少しずつ。自己評価の復習はXPと分けて記録します。
        </p>
        {storageMessage && (
          <p role="status" className="storage-notice">
            {storageMessage}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant={stats?.dueCount ? "default" : "outline"}>
          <Link href="/review">
            単語を復習する
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/vocabulary">
            単語帳を開く
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/grammar">
            文法を確かめる
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

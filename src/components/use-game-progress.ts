"use client";

import { useEffect, useMemo, useState } from "react";
import { courseChapters, courseLessons } from "@/data/course";
import { getGameProgress } from "@/lib/gamification";
import { useLearning } from "@/components/learning-provider";
import { useReview } from "@/components/review-provider";

/** Read existing records without persisting a second achievement state. */
export function useGameProgress() {
  const { progress, ready: learningReady } = useLearning();
  const { state: review, ready: reviewReady } = useReview();
  const [now, setNow] = useState<Date>();

  useEffect(() => {
    let active = true;
    // A just-saved answer must count immediately, even between clock ticks.
    const refresh = () => {
      if (active) setNow(new Date());
    };
    queueMicrotask(refresh);
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [progress, review]);

  const game = useMemo(() => {
    if (!learningReady || !reviewReady || !now) return undefined;
    return getGameProgress({
      progress,
      review,
      lessons: courseLessons,
      chapters: courseChapters,
      now,
    });
  }, [progress, review, learningReady, reviewReady, now]);

  return { game, ready: Boolean(game) };
}

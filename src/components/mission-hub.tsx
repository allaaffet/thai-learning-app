"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Flag,
  Gamepad2,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import {
  courseChapters,
  courseLessons,
  getChapterLessons,
} from "@/data/course";
import { useLearning } from "@/components/learning-provider";
import { Button } from "@/components/ui/button";
import { getNextLesson, isLessonUnlocked } from "@/lib/progress";
import { cn } from "@/lib/utils";

/** The path is a view of the existing curriculum, never a separate progression. */
export function MissionHub() {
  const { progress, ready } = useLearning();
  const next = getNextLesson(progress, courseLessons);
  const completed = courseLessons.filter(
    (lesson) => progress.lessons[lesson.id]?.completedAt,
  ).length;
  const activeChapterId = next?.chapterId ?? courseChapters[0]?.id;

  return (
    <div className="mh-hub">
      <header className="page-header mh-page-header">
        <div>
          <p className="eyebrow">A LITTLE EVERY DAY</p>
          <h1 className="page-title">タイ語の冒険へ。</h1>
          <p className="page-description">
            発見して、ためして、また出会う。ひとつずつ、ことばを自分のものに。
          </p>
        </div>
        <Link className="text-link" href="/roadmap">
          <BookOpen size={17} aria-hidden="true" /> 教科書・カリキュラム
        </Link>
      </header>

      <section className="mh-start" aria-labelledby="mh-start-heading">
        <div className="mh-start-copy">
          <span className="mh-kicker">
            <Gamepad2 size={18} aria-hidden="true" />
            {next ? "次のミッション" : "もう一度、つないでみよう"}
          </span>
          <h2 id="mh-start-heading">
            {next ? next.title : "学んだことをミックス！"}
          </h2>
          <p>
            {next
              ? "新しい発見と、おさらいをひとつのコースで。"
              : "文字・音・ことば。いろいろな問題で思い出そう。"}
          </p>
          <Button size="lg" asChild={ready} disabled={!ready}>
            {ready ? (
              <Link href={next ? `/play/${next.id}` : "/play/mix"}>
                {completed ? "つづきから遊ぶ" : "冒険をはじめる"}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <>記録を読み込み中…</>
            )}
          </Button>
        </div>
        <div className="mh-loop" aria-label="発見、チャレンジ、おさらい">
          <span>
            <Sparkles size={25} aria-hidden="true" />
            発見
          </span>
          <ArrowRight size={18} aria-hidden="true" />
          <span>
            <Star size={25} aria-hidden="true" />
            チャレンジ
          </span>
          <ArrowRight size={18} aria-hidden="true" />
          <span>
            <RotateCcw size={25} aria-hidden="true" />
            おさらい
          </span>
        </div>
      </section>

      <section
        className="mh-replay surface"
        aria-labelledby="mh-replay-heading"
      >
        <span className="mh-replay-icon" aria-hidden="true">
          <RotateCcw size={26} />
        </span>
        <div>
          <h2 id="mh-replay-heading">おさらいミックス</h2>
          <p>
            {completed
              ? "学んだ問題から最大6問。まちがえた問題も、もう一度。"
              : "最初のミッションをクリアすると、ここでも遊べます。"}
          </p>
          <small>復習はXP加算なし。単語の復習予定も変わりません。</small>
        </div>
        <Button
          variant="outline"
          asChild={ready && completed > 0}
          disabled={!ready || completed === 0}
        >
          {ready && completed > 0 ? (
            <Link href="/play/mix">
              ミックスで遊ぶ <ArrowRight size={17} aria-hidden="true" />
            </Link>
          ) : (
            <>クリア後にオープン</>
          )}
        </Button>
      </section>

      <section className="mh-path" aria-labelledby="mh-path-heading">
        <div className="mh-path-head">
          <div>
            <p className="eyebrow">YOUR JOURNEY</p>
            <h2 id="mh-path-heading">次の一歩へ。</h2>
          </div>
          <span className="mh-progress-count">
            <Flag size={17} aria-hidden="true" />
            {ready ? completed : "–"} / {courseLessons.length} クリア
          </span>
        </div>

        {courseChapters.map((chapter) => {
          const chapterLessons = getChapterLessons(chapter.id);
          const chapterCompleted = chapterLessons.filter(
            (lesson) => progress.lessons[lesson.id]?.completedAt,
          ).length;
          return (
            <details
              className="mh-chapter surface"
              key={chapter.id}
              open={chapter.id === activeChapterId}
            >
              <summary>
                <span className="mh-chapter-mark" aria-hidden="true">
                  {ready && chapterCompleted === chapterLessons.length ? (
                    <Trophy size={22} />
                  ) : (
                    String(chapter.number).padStart(2, "0")
                  )}
                </span>
                <span className="mh-chapter-title">
                  <strong>{chapter.title}</strong>
                  <small>
                    {ready ? chapterCompleted : "–"} / {chapterLessons.length}{" "}
                    クリア
                  </small>
                </span>
                <ChevronDown
                  className="mh-chevron"
                  size={20}
                  aria-hidden="true"
                />
              </summary>
              <ol
                className="mh-nodes"
                aria-label={`${chapter.title}のミッション`}
              >
                {chapterLessons.map((lesson, index) => {
                  const done =
                    ready && Boolean(progress.lessons[lesson.id]?.completedAt);
                  const unlocked = ready && isLessonUnlocked(progress, lesson);
                  const current = ready && lesson.id === next?.id;
                  const status = done
                    ? "クリア・もう一度遊ぶ"
                    : current
                      ? "次のミッション"
                      : unlocked
                        ? "挑戦できます"
                        : "前のミッションから";
                  const contents = (
                    <>
                      <span className="mh-node-symbol" aria-hidden="true">
                        {done ? (
                          <Check size={28} />
                        ) : unlocked ? (
                          <Star size={28} />
                        ) : (
                          <LockKeyhole size={24} />
                        )}
                      </span>
                      <span className="mh-node-copy">
                        <small>{status}</small>
                        <strong>{lesson.title}</strong>
                        {current && (
                          <span className="mh-node-go">
                            ここから遊ぶ{" "}
                            <ArrowRight size={16} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={lesson.id}
                      className={cn(
                        "mh-node",
                        index % 2 === 1 && "mh-node-shift",
                      )}
                    >
                      {unlocked ? (
                        <Link
                          href={`/play/${lesson.id}`}
                          className={cn(
                            "mh-node-target",
                            done && "is-done",
                            current && "is-current",
                          )}
                          aria-label={`${lesson.title}：${status}`}
                          aria-current={current ? "step" : undefined}
                        >
                          {contents}
                        </Link>
                      ) : (
                        <div
                          className="mh-node-target is-locked"
                          aria-label={`${lesson.title}：${ready ? status : "記録を読み込み中"}`}
                        >
                          {contents}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </section>
      <p className="mh-bottom-note">
        進む順番は学んだ内容に合わせています。途中のカードや復習の答えは、この回の練習だけに使います。
      </p>
    </div>
  );
}

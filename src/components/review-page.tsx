"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Layers3,
  RotateCcw,
} from "lucide-react";
import { getVocabularyEntry } from "@/data/language";
import { getDueCards, type ReviewGrade } from "@/lib/review";
import { useReview } from "@/components/review-provider";
import { SpeakButton } from "@/components/speech-practice";
import { Button } from "@/components/ui/button";

interface ReviewSession {
  ids: string[];
  index: number;
  reviewed: number;
  revealed: boolean;
  grade: ReviewGrade | null;
  skipped: boolean;
  finished: boolean;
  id: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "予定を確認できません";
}

export function ReviewPage() {
  const { state, ready, storageMessage, rateCard } = useReview();
  const [now, setNow] = useState<Date | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const submitted = useRef(false);
  const cardHeading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    function refresh() {
      if (mounted) setNow(new Date());
    }
    queueMicrotask(refresh);
    const timer = window.setInterval(refresh, 60_000);
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const knownCards = Object.values(state.cards).filter((card) =>
    getVocabularyEntry(card.id),
  );
  const dueCards = now
    ? getDueCards(state, now).filter((card) => getVocabularyEntry(card.id))
    : [];
  const nextCard = now
    ? [...knownCards]
        .filter((card) => new Date(card.dueAt).getTime() > now.getTime())
        .sort(
          (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
        )[0]
    : undefined;
  const currentId = session?.ids[session.index];
  const entry = currentId ? getVocabularyEntry(currentId) : undefined;
  const currentCard = currentId ? state.cards[currentId] : undefined;

  function beginSession() {
    const currentTime = new Date();
    setNow(currentTime);
    const ids = getDueCards(state, currentTime)
      .filter((card) => getVocabularyEntry(card.id))
      .slice(0, 20)
      .map((card) => card.id);
    if (!ids.length) {
      setNotice("復習の予定が更新されました。次の予定を確認してください。");
      return;
    }
    submitted.current = false;
    setNotice("");
    setSession({
      ids,
      index: 0,
      reviewed: 0,
      revealed: false,
      grade: null,
      skipped: false,
      finished: false,
      id:
        globalThis.crypto?.randomUUID?.() ??
        `review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }

  function rate(grade: ReviewGrade) {
    if (
      !session ||
      !session.revealed ||
      session.grade ||
      session.skipped ||
      !entry ||
      submitted.current
    )
      return;
    submitted.current = true;
    const accepted = rateCard(
      entry.id,
      grade,
      `${session.id}-${session.index}`,
    );
    setNow(new Date());
    if (accepted) {
      setSession({ ...session, reviewed: session.reviewed + 1, grade });
      setNotice("");
    } else {
      setSession({ ...session, skipped: true });
      setNotice(
        "このカードは他の画面で更新されたか、まだ復習の時刻になっていません。重ねて記録せず、次へ進めます。",
      );
    }
  }

  function next() {
    if (!session || (!session.grade && !session.skipped && entry)) return;
    submitted.current = false;
    setNotice("");
    setNow(new Date());
    if (session.index >= session.ids.length - 1)
      setSession({ ...session, finished: true });
    else {
      setSession({
        ...session,
        index: session.index + 1,
        revealed: false,
        grade: null,
        skipped: false,
      });
      window.requestAnimationFrame(() =>
        cardHeading.current?.focus({ preventScroll: true }),
      );
    }
  }

  return (
    <div className="language-page review-page">
      <header className="page-header language-page-header">
        <div>
          <p className="eyebrow">A LITTLE, OFTEN</p>
          <h1 className="page-title">思い出して、定着させる。</h1>
          <p className="page-description">
            答えを見る前の、ひと呼吸。思い出す練習を、自分のペースで。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/vocabulary">
            単語を選ぶ <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>
      {storageMessage && (
        <p role="status" className="language-storage-notice">
          {storageMessage}
        </p>
      )}
      {notice && (
        <p role="status" className="language-notice">
          {notice}
        </p>
      )}

      {!ready || !now ? (
        <p role="status" className="language-muted">
          復習の記録を読み込んでいます…
        </p>
      ) : session?.finished ? (
        <section
          className="surface review-completion"
          aria-labelledby="review-completion-heading"
        >
          <div className="review-completion-icon">
            <Check size={28} aria-hidden="true" />
          </div>
          <p className="eyebrow">SMALL STEPS, LASTING WORDS</p>
          <h2 id="review-completion-heading">
            今日の復習、おつかれさまでした。
          </h2>
          <p>
            <strong>{session.reviewed}語</strong>の自己評価を記録しました。
          </p>
          <p>
            もう一度のカードは約10分後から。今回の自己評価に合わせて、次の復習時刻を調整しています。
          </p>
          {nextCard && (
            <p className="review-next-date">
              <CalendarClock size={18} aria-hidden="true" />
              次の予定：{formatDate(nextCard.dueAt)}
            </p>
          )}
          <div className="review-completion-actions">
            <Button
              onClick={() => {
                setSession(null);
                setNow(new Date());
              }}
            >
              復習の予定に戻る
            </Button>
            <Button asChild variant="outline">
              <Link href="/roadmap">
                レッスンを続ける <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      ) : session && entry ? (
        <section
          className="surface review-study"
          aria-labelledby="review-card-heading"
        >
          <div className="review-study-meta">
            <span>
              今回のカード {session.index + 1} / {session.ids.length}
            </span>
            <span>XP加算なし</span>
          </div>
          <div
            className="review-progress"
            role="progressbar"
            aria-label="今回の復習の進み具合"
            aria-valuemin={0}
            aria-valuemax={session.ids.length}
            aria-valuenow={
              session.index + (session.grade || session.skipped ? 1 : 0)
            }
          >
            <span
              style={{
                width: `${((session.index + (session.grade || session.skipped ? 1 : 0)) / session.ids.length) * 100}%`,
              }}
            />
          </div>
          <p className="review-prompt">意味を思い出してみましょう</p>
          <h2
            id="review-card-heading"
            className="thai review-card-word"
            lang="th"
            tabIndex={-1}
            ref={cardHeading}
          >
            {entry.thai}
          </h2>
          {!session.revealed ? (
            <div className="review-reveal">
              <p>声に出しても、心の中で答えても大丈夫です。</p>
              <Button
                onClick={() => setSession({ ...session, revealed: true })}
              >
                答えを表示
              </Button>
            </div>
          ) : (
            <>
              <div className="review-answer">
                <p className="language-ipa">{entry.ipa}</p>
                <h3>{entry.meaning}</h3>
                <div className="vocabulary-example">
                  <p className="thai" lang="th">
                    {entry.example.thai}
                  </p>
                  <p className="language-ipa">{entry.example.ipa}</p>
                  <p>{entry.example.meaning}</p>
                  {entry.example.note && (
                    <p className="language-muted">{entry.example.note}</p>
                  )}
                </div>
                <SpeakButton text={entry.thai} />
              </div>
              <fieldset
                className="review-rating"
                disabled={Boolean(session.grade) || session.skipped}
              >
                <legend>どのくらい思い出せましたか？</legend>
                <div>
                  <button
                    type="button"
                    onClick={() => rate("again")}
                    aria-label="もう一度"
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    <strong>もう一度</strong>
                    <span>約10分後</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rate("hard")}
                    aria-label="迷った"
                  >
                    <CalendarClock size={17} aria-hidden="true" />
                    <strong>迷った</strong>
                    <span>1日後</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rate("good")}
                    aria-label="思い出せた"
                  >
                    <Check size={17} aria-hidden="true" />
                    <strong>思い出せた</strong>
                    <span>間隔を広げる</span>
                  </button>
                </div>
              </fieldset>
              {(session.grade || session.skipped) && (
                <div className="review-recorded">
                  <p role="status">
                    {session.grade
                      ? `自己評価を記録しました。${currentCard ? `次回：${formatDate(currentCard.dueAt)}` : ""}`
                      : "今回は記録せず、次に進みます。"}
                  </p>
                  <Button onClick={next}>
                    {session.index === session.ids.length - 1
                      ? "復習を終える"
                      : "次のカード"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className="review-exit"
            onClick={() => {
              submitted.current = false;
              setSession(null);
              setNotice("");
              setNow(new Date());
            }}
          >
            ここまでにして予定へ戻る
          </button>
        </section>
      ) : session ? (
        <section className="surface language-empty">
          <h2>このカードを表示できません</h2>
          <p>単語の情報が変更されました。このカードは記録せず次へ進めます。</p>
          <Button onClick={next}>
            {session.index === session.ids.length - 1
              ? "復習を終える"
              : "次のカード"}
          </Button>
        </section>
      ) : (
        <>
          <div className="review-overview">
            <div className="surface">
              <Layers3 size={21} aria-hidden="true" />
              <p>登録した単語</p>
              <strong>
                {knownCards.length}
                <span>語</span>
              </strong>
            </div>
            <div className="surface">
              <CalendarClock size={21} aria-hidden="true" />
              <p>今の復習予定</p>
              <strong>
                {dueCards.length}
                <span>語</span>
              </strong>
            </div>
          </div>
          {knownCards.length === 0 ? (
            <section className="surface language-empty">
              <Layers3 size={30} aria-hidden="true" />
              <h2>最初の復習カードを選びましょう</h2>
              <p>
                単語帳の「復習に追加」で、覚えたい単語を選べます。登録したカードはすぐに復習できます。
              </p>
              <Button asChild>
                <Link href="/vocabulary">
                  単語帳を開く <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            </section>
          ) : dueCards.length > 0 ? (
            <section className="surface review-start">
              <p className="eyebrow">READY WHEN YOU ARE</p>
              <h2>今日は、{Math.min(dueCards.length, 20)}語から。</h2>
              <p>
                タイ語を見て意味を思い出し、答えを開いて確かめます。そのあとの自己評価で、次の復習時刻を決めます。
              </p>
              {dueCards.length > 20 && (
                <p>1回に最大20語を扱います。残りは続けて復習できます。</p>
              )}
              <Button onClick={beginSession}>
                今日の復習をはじめる <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </section>
          ) : (
            <section className="surface language-empty">
              <Check size={30} aria-hidden="true" />
              <h2>今の予定分は、復習できています。</h2>
              <p>次の時刻になったら、また思い出してみましょう。</p>
              {nextCard && (
                <p className="review-next-date">
                  <CalendarClock size={18} aria-hidden="true" />
                  次の予定：{formatDate(nextCard.dueAt)}
                </p>
              )}
              <Button asChild variant="outline">
                <Link href="/vocabulary">
                  単語を追加する <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </Button>
            </section>
          )}
        </>
      )}
      <div className="language-disclosure review-how-it-works">
        <strong>自己評価は、学びのペースを決めるために。</strong>
        <p>
          「思い出せた」は1・3・7・14・30・60日の順に間隔を広げます。「迷った」は1日後、「もう一度」は約10分後です。自動採点や習熟度の判定ではなく、XP・正答率・レッスンの解放には使いません。予定は1分ごとと、この画面に戻ったときに更新します。
        </p>
        <p>
          記録はこのブラウザに保存します。教材・合成音声は専門家監修前です。
        </p>
      </div>
    </div>
  );
}

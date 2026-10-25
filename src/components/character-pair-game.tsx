"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  Link2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CharacterAudioPrompt,
  type CharacterAudioReadiness,
} from "@/components/character-audio-prompt";
import { SpeakButton } from "@/components/speech-practice";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { alphabetCharacters } from "@/data/alphabet";
import { getCharacterTrainingReading } from "@/data/character-training";
import {
  createCharacterPairGame,
  gradeCharacterPair,
  type PairGame,
  type PairMatch,
  type PairMode,
} from "@/lib/character-pairs";

interface CharacterPairGameProps {
  selectedIds: string[];
  mode: PairMode;
  onQuiz: (mode: PairMode) => void;
  onBack: () => void;
}

const characters = new Map(
  alphabetCharacters.map((entry) => [entry.id, entry]),
);

function freshGame(selectedIds: string[], mode: PairMode) {
  const random = window.crypto.getRandomValues(new Uint32Array(4));
  return createCharacterPairGame({
    selectedIds,
    mode,
    seed: random[0],
    gameId: `pairs-${Array.from(random, (value) => value.toString(16)).join("-")}`,
  });
}

function AudioNotice() {
  return (
    <p className="cp-audio-notice">
      端末の合成音声（未監修）です。ブラウザ・音声の提供元と通信する場合があります。
    </p>
  );
}

function PairFeedback({ match }: { match: PairMatch }) {
  const target = characters.get(match.cueId);
  const chosen = characters.get(match.letterId);
  if (!target || !chosen) return null;
  return (
    <div
      className={`cp-feedback ${match.correct ? "is-correct" : "is-review"}`}
      role="status"
    >
      <div className="cp-feedback-heading">
        {match.correct ? (
          <Link2 size={23} aria-hidden="true" />
        ) : (
          <RotateCcw size={22} aria-hidden="true" />
        )}
        <strong>
          {match.correct ? "ペアが見つかった！" : "見比べて、もう一度。"}
        </strong>
      </div>
      <p>
        <span className="thai" lang="th">
          {target.name}
        </span>{" "}
        の文字は{" "}
        <span className="thai" lang="th">
          {target.thai}
        </span>{" "}
        です。
        {!match.correct && "そのまま、対応する文字をタップしてみましょう。"}
      </p>
      {!match.correct && (
        <div className="cp-feedback-comparison">
          {[
            { entry: target, label: "この名前の文字" },
            { entry: chosen, label: "選んだ文字" },
          ].map(({ entry, label }) => (
            <div key={label}>
              <small>{label}</small>
              <span className="thai cp-comparison-glyph" lang="th">
                {entry.thai}
              </span>
              <span className="thai" lang="th">
                {entry.name}
              </span>
              <span className="cp-romanized">
                {getCharacterTrainingReading(entry).romanizedName}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A two-lap warm-up. It never reads or writes lesson, XP, quiz, or review records. */
export function CharacterPairGame({
  selectedIds,
  mode,
  onQuiz,
  onBack,
}: CharacterPairGameProps) {
  const [initialConfig] = useState(() => ({
    selectedIds: [...selectedIds],
    mode,
  }));
  const [game, setGame] = useState<PairGame | null>(null);
  const [lapIndex, setLapIndex] = useState<0 | 1>(0);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<PairMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<CharacterAudioReadiness | null>(
    null,
  );
  const activePromptId = useRef<string | null>(null);
  const cueRef = useRef<string | null>(null);
  const matchedRef = useRef<string[]>([]);
  const attemptLock = useRef(false);
  const leaving = useRef(false);
  const readinessRef = useRef<CharacterAudioReadiness | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const audioHeading = useRef<HTMLHeadingElement>(null);
  const { playEffect } = useSoundEffects();

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      try {
        setGame(freshGame(initialConfig.selectedIds, initialConfig.mode));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "ペアを準備できませんでした。文字を選び直してください。",
        );
      }
    });
    return () => {
      mounted = false;
      activePromptId.current = null;
    };
  }, [initialConfig]);

  const handleReadiness = useCallback((next: CharacterAudioReadiness) => {
    if (next.questionId !== activePromptId.current) return;
    readinessRef.current = next;
    setReadiness(next);
  }, []);

  const lap = game?.laps[lapIndex];
  const selectedCue = selectedCueId ? characters.get(selectedCueId) : undefined;
  const promptId = lap && selectedCueId ? `${lap.id}:${selectedCueId}` : null;
  const currentReadiness =
    readiness?.questionId === promptId ? readiness : null;
  const soundReady = Boolean(
    currentReadiness?.heard &&
      !currentReadiness.playing &&
      currentReadiness.available === true,
  );
  const canMatch = Boolean(
    selectedCueId && (game?.mode !== "audio-to-letter" || soundReady),
  );
  const lapComplete = Boolean(
    game && matchedIds.length === game.selectedIds.length,
  );
  const finished = lapComplete && lapIndex === 1;

  function clearSelection() {
    activePromptId.current = null;
    cueRef.current = null;
    readinessRef.current = null;
    setSelectedCueId(null);
    setReadiness(null);
  }

  function focusHeading() {
    window.requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  function reset(nextMode: PairMode) {
    if (!game) return;
    try {
      const next = freshGame(game.selectedIds, nextMode);
      clearSelection();
      attemptLock.current = false;
      leaving.current = false;
      matchedRef.current = [];
      setMatchedIds([]);
      setFeedback(null);
      setError(null);
      setLapIndex(0);
      setGame(next);
      focusHeading();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "ペアを準備できませんでした。文字を選び直してください。",
      );
    }
  }

  function selectCue(id: string) {
    if (!game || !lap || matchedRef.current.includes(id)) return;
    if (cueRef.current === id) {
      setFeedback(null);
      return;
    }
    const nextPromptId = `${lap.id}:${id}`;
    activePromptId.current = nextPromptId;
    cueRef.current = id;
    readinessRef.current = null;
    setSelectedCueId(id);
    setReadiness(null);
    setFeedback(null);
    setError(null);
    if (game.mode === "audio-to-letter") {
      window.requestAnimationFrame(() => {
        const node = audioHeading.current;
        if (!node) return;
        node.focus({ preventScroll: true });
        const bounds = node.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > window.innerHeight)
          node.scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
  }

  function matchLetter(letterId: string) {
    const cueId = cueRef.current;
    if (!game || !lap || !cueId || attemptLock.current) return;
    if (game.mode === "audio-to-letter") {
      const current = readinessRef.current;
      if (
        !current ||
        current.questionId !== `${lap.id}:${cueId}` ||
        !current.heard ||
        current.playing ||
        current.available !== true
      )
        return;
    }
    // The ref locks a found pair before React renders the disabled cards.
    if (
      matchedRef.current.includes(cueId) ||
      matchedRef.current.includes(letterId)
    )
      return;
    attemptLock.current = true;
    try {
      const result = gradeCharacterPair(
        lap,
        cueId,
        letterId,
        matchedRef.current,
      );
      setFeedback(result);
      setError(null);
      if (result.correct) {
        const next = [...matchedRef.current, cueId];
        matchedRef.current = next;
        setMatchedIds(next);
        clearSelection();
      }
      playEffect(result.correct ? "correct" : "incorrect");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "このペアを確認できませんでした。カードを選び直してください。",
      );
    } finally {
      queueMicrotask(() => {
        attemptLock.current = false;
      });
    }
  }

  function nextLap() {
    if (!lapComplete || lapIndex !== 0) return;
    clearSelection();
    matchedRef.current = [];
    setMatchedIds([]);
    setFeedback(null);
    setLapIndex(1);
    focusHeading();
  }

  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    activePromptId.current = null;
    cueRef.current = null;
    onBack();
  }

  if (!game || !lap) {
    return (
      <section className="cp-game" aria-label="文字ペアさがし">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">ペアのカードを並べています…</p>
        )}
        <Button type="button" variant="ghost" onClick={leave}>
          <ArrowLeft size={17} />
          文字を選び直す
        </Button>
      </section>
    );
  }

  return (
    <section
      className="cp-game"
      aria-label="文字ペアさがし"
      data-lap={lap.number}
      data-game-mode={game.mode}
      data-lap-complete={lapComplete}
    >
      <header className="cp-heading">
        <div>
          <p className="eyebrow">
            <Link2 size={16} aria-hidden="true" /> PAIR & RECALL
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {game.mode === "audio-to-letter"
              ? "音と文字のペアさがし"
              : "読み方と文字のペアさがし"}
          </h2>
          <p className="cp-instruction">
            名前のカード <ArrowRight size={16} aria-hidden="true" />{" "}
            同じ名前の文字
          </p>
        </div>
        <span className="cp-lap">
          <b>{lap.number}</b> / 2 周
        </span>
      </header>

      <div className="cp-collection" aria-label="今回見つけた文字">
        {game.selectedIds.map((id) => {
          const entry = characters.get(id);
          if (!entry) return null;
          const count = lapIndex + Number(matchedIds.includes(id));
          return (
            <div
              key={id}
              className={`cp-stamp${count ? " has-pair" : ""}${feedback?.correct && feedback.cueId === id ? " is-new" : ""}`}
              aria-label={`${entry.thai}、${count}周で確認`}
            >
              <span className="thai" lang="th">
                {entry.thai}
              </span>
              <span className="cp-stamp-dots" aria-hidden="true">
                <i className={count >= 1 ? "is-filled" : ""} />
                <i className={count >= 2 ? "is-filled" : ""} />
              </span>
            </div>
          );
        })}
      </div>
      <div className="cp-progress-heading">
        <span>この周のペア</span>
        <strong>
          {matchedIds.length}
          <small> / {game.selectedIds.length}</small>
        </strong>
      </div>
      <progress
        aria-label="この周で見つけたペア"
        value={matchedIds.length}
        max={game.selectedIds.length}
      />
      <details className="cp-source-note">
        <summary>
          教材案・専門家監修前
          {game.mode === "name-to-letter"
            ? " · 読み方の表記について"
            : " · 文字名の音声について"}
        </summary>
        <p>
          {game.mode === "name-to-letter"
            ? "IPAは字母名の最初の音節だけを示します。英字は文字を区別するUnicode名で、名前全体の発音記号ではありません。同じIPAでも、英字の文字名を含めて見比べましょう。"
            : "聞く音声は文字を呼ぶ名前（字母名）です。子音単体の音ではありません。合成音声の読み方は未監修です。"}
        </p>
      </details>
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}

      {!lapComplete && game.mode === "audio-to-letter" && (
        <div className="cp-audio-dock">
          <h3 ref={audioHeading} tabIndex={-1}>
            <Headphones size={21} aria-hidden="true" />
            {selectedCue
              ? `音声${lap.cueIds.indexOf(selectedCue.id) + 1}を聞いてみよう`
              : "音声カードを選ぼう"}
          </h3>
          {selectedCue && promptId ? (
            <>
              <AudioNotice />
              <CharacterAudioPrompt
                key={promptId}
                questionId={promptId}
                text={selectedCue.name}
                onReadyChange={handleReadiness}
              />
            </>
          ) : (
            <p className="cp-small">
              カードを選ぶと、ここで文字の名前を再生できます。
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cp-text-fallback"
            onClick={() => reset("name-to-letter")}
          >
            読み方でペアさがし
          </Button>
        </div>
      )}

      <div className={`cp-board${lapComplete ? " is-complete" : ""}`}>
        <div className="cp-column cp-cue-column">
          <h3>
            {game.mode === "audio-to-letter"
              ? "1. 音声を選ぶ"
              : "1. 読み方を選ぶ"}
          </h3>
          {lap.cueIds.map((id, index) => {
            const entry = characters.get(id);
            if (!entry) return null;
            const found = matchedIds.includes(id);
            const reading = getCharacterTrainingReading(entry);
            return (
              <button
                type="button"
                className={`cp-cue${selectedCueId === id ? " is-selected" : ""}${found ? " is-matched" : ""}`}
                key={id}
                data-cue-id={id}
                aria-label={
                  game.mode === "audio-to-letter"
                    ? `音声${index + 1}のカード`
                    : `${reading.romanizedName} の読み方カード`
                }
                aria-pressed={selectedCueId === id}
                disabled={found}
                onClick={() => selectCue(id)}
              >
                {game.mode === "audio-to-letter" ? (
                  <>
                    <span className="cp-audio-cue-label">
                      <Volume2 size={20} aria-hidden="true" />
                      音声{index + 1}
                    </span>
                    {found ? (
                      <span className="cp-connected">
                        <Link2 size={17} aria-hidden="true" />
                        <span className="thai" lang="th">
                          {entry.thai}
                        </span>
                      </span>
                    ) : (
                      <span className="cp-small">選んで、聞く</span>
                    )}
                  </>
                ) : (
                  <>
                    <strong className="cp-reading-ipa">{reading.ipa}</strong>
                    <span className="cp-romanized">
                      {reading.romanizedName}
                    </span>
                    {found && (
                      <span className="cp-connected">
                        <Link2 size={17} aria-hidden="true" />
                        <span className="thai" lang="th">
                          {entry.thai}
                        </span>
                      </span>
                    )}
                  </>
                )}
                {found && (
                  <Check
                    className="cp-card-check"
                    size={17}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="cp-column cp-letter-column">
          <h3>2. 文字とつなぐ</h3>
          {lap.letterIds.map((id) => {
            const entry = characters.get(id);
            if (!entry) return null;
            const found = matchedIds.includes(id);
            return (
              <button
                type="button"
                key={id}
                className={`cp-letter${found ? " is-matched" : ""}${feedback && !feedback.correct && feedback.letterId === id ? " is-review" : ""}`}
                data-letter-id={id}
                aria-label={`${entry.thai} とつなぐ`}
                disabled={found || !canMatch}
                onClick={() => matchLetter(id)}
              >
                <span className="thai" lang="th">
                  {entry.thai}
                </span>
                {found && (
                  <span className="cp-letter-found">
                    <Link2 size={16} aria-hidden="true" />
                    <Check size={17} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && <PairFeedback match={feedback} />}
      {!lapComplete && game.mode === "name-to-letter" && selectedCue && (
        <details className="cp-reading-audio">
          <summary>選んだ文字の名前を音声でも聞く</summary>
          <AudioNotice />
          <SpeakButton
            key={selectedCue.id}
            text={selectedCue.name}
            label="選んだ文字の名前を聞く"
          />
        </details>
      )}

      {lapComplete && (
        <div className={`cp-lap-finish${finished ? " is-final" : ""}`}>
          <span className="cp-finish-icon">
            {finished ? (
              <Sparkles size={29} aria-hidden="true" />
            ) : (
              <Check size={28} aria-hidden="true" />
            )}
          </span>
          <h3>{finished ? "2周クリア！" : "1周目、つながった！"}</h3>
          <p>
            {finished
              ? "同じ文字を、別の並びでも見つけられました。"
              : "次は場所を変えて、もう一度見つけよう。"}
          </p>
          {finished ? (
            <div className="cp-finish-actions">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  if (leaving.current) return;
                  leaving.current = true;
                  activePromptId.current = null;
                  playEffect("review-complete");
                  onQuiz(game.mode);
                }}
              >
                8問で確かめる
                <ArrowRight size={18} />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => reset(game.mode)}
              >
                <RotateCcw size={17} />
                もう一度ペアさがし
              </Button>
            </div>
          ) : (
            <Button type="button" size="lg" onClick={nextLap}>
              <Shuffle size={19} />
              シャッフルしてもう1周
              <ArrowRight size={18} />
            </Button>
          )}
        </div>
      )}

      <footer className="cp-footer">
        <Button type="button" variant="ghost" onClick={leave}>
          <ArrowLeft size={16} />
          文字を選び直す
        </Button>
        <p>ペアさがしは練習用。記録は8問で確認すると保存されます。</p>
      </footer>
    </section>
  );
}

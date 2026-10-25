"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  Layers2,
  Lightbulb,
  RotateCcw,
  Headphones,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/speech-practice";
import {
  CharacterAudioPrompt,
  type CharacterAudioReadiness,
} from "@/components/character-audio-prompt";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { useCharacterTraining } from "@/components/use-character-training";
import { alphabetCharacters } from "@/data/alphabet";
import {
  CHARACTER_TRAINING_PRESETS,
  DEFAULT_CHARACTER_SELECTION,
  getCharacterTrainingCue,
} from "@/data/character-training";
import type { AlphabetCharacter } from "@/lib/alphabet-types";
import { getWeakCharacterIds } from "@/lib/character-training-progress";
import {
  createCharacterTrainingSession,
  gradeCharacterTrainingQuestion,
  MAX_TRAINING_CHARACTERS,
  MIN_TRAINING_CHARACTERS,
  TRAINING_ROUND_SIZE,
  type CharacterTrainingMode,
  type TrainerAnswer,
  type TrainerSession,
} from "@/lib/character-trainer";

const characterMap = new Map(
  alphabetCharacters.map((entry) => [entry.id, entry]),
);
type ActivePracticeMode = "audio-to-letter" | "name-to-letter";

function activePracticeMode(mode: CharacterTrainingMode): ActivePracticeMode {
  return mode === "audio-to-letter" ? mode : "name-to-letter";
}

const MODES: { value: ActivePracticeMode; label: string; hint: string }[] = [
  {
    value: "audio-to-letter",
    label: "音声から文字",
    hint: "文字の名前を聞いて選ぶ",
  },
  {
    value: "name-to-letter",
    label: "読み方から文字",
    hint: "発音記号と英字の文字名を見て選ぶ",
  },
];

type Stage = "setup" | "learn" | "quiz" | "result";

function entriesFor(ids: readonly string[]) {
  return ids.flatMap((id) => {
    const entry = characterMap.get(id);
    return entry ? [entry] : [];
  });
}

function ModeOption({
  item,
  mode,
  disabled,
  onSelect,
}: {
  item: (typeof MODES)[number];
  mode: ActivePracticeMode;
  disabled: boolean;
  onSelect: (mode: ActivePracticeMode) => void;
}) {
  return (
    <label className={`ct-mode${mode === item.value ? " is-selected" : ""}`}>
      <input
        type="radio"
        name="character-training-mode"
        aria-label={item.label}
        value={item.value}
        checked={mode === item.value}
        onChange={() => onSelect(item.value)}
        disabled={disabled}
      />
      <span>
        <strong>{item.label}</strong>
        <small>{item.hint}</small>
      </span>
    </label>
  );
}

function CharacterIdentity({
  entry,
  compact = false,
}: {
  entry: AlphabetCharacter;
  compact?: boolean;
}) {
  return (
    <div className={`ct-identity${compact ? " ct-identity-compact" : ""}`}>
      <span className="thai ct-identity-glyph" lang="th">
        {entry.thai}
      </span>
      <div>
        <strong>{getCharacterTrainingCue(entry)}</strong>
        <span className="thai ct-name" lang="th">
          {entry.name}
        </span>
        <span className="ct-small">基本初頭音 {entry.initialIpa}</span>
      </div>
    </div>
  );
}

function AudioNotice() {
  return (
    <p className="ct-audio-notice">
      音声は任意の端末合成音声（未監修）です。利用時にブラウザ・音声の提供元と通信する場合があります。音声なしでも練習できます。
    </p>
  );
}

/** Independent practice: completing a round never changes course XP or prerequisites. */
export function CharacterTraining({ initialFocus }: { initialFocus?: string }) {
  const training = useCharacterTraining();
  const { playEffect } = useSoundEffects();
  const [stage, setStage] = useState<Stage>("setup");
  const [selectedIds, setSelectedIds] = useState<string[]>([
    ...DEFAULT_CHARACTER_SELECTION,
  ]);
  const [mode, setMode] = useState<ActivePracticeMode>("audio-to-letter");
  const [draftReady, setDraftReady] = useState(false);
  const initialized = useRef(false);
  const [learnIndex, setLearnIndex] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const [session, setSession] = useState<TrainerSession | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<TrainerAnswer[]>([]);
  const [roundNote, setRoundNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(new Set<string>());
  const completed = useRef(new Set<string>());
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const activeQuestionId = useRef<string | null>(null);
  const audioReadinessRef = useRef<CharacterAudioReadiness | null>(null);
  const [audioReadiness, setAudioReadiness] =
    useState<CharacterAudioReadiness | null>(null);
  const handleAudioReadiness = useCallback((next: CharacterAudioReadiness) => {
    if (next.questionId !== activeQuestionId.current) return;
    audioReadinessRef.current = next;
    setAudioReadiness(next);
  }, []);

  useEffect(() => {
    if (!training.ready || initialized.current) return;
    initialized.current = true;
    const focused =
      initialFocus && characterMap.has(initialFocus) ? initialFocus : undefined;
    const draft = focused
      ? [...new Set([focused, ...DEFAULT_CHARACTER_SELECTION])].slice(0, 4)
      : [...training.state.selectedIds];
    queueMicrotask(() => {
      setSelectedIds(draft);
      setMode(activePracticeMode(training.state.mode));
      setDraftReady(true);
    });
  }, [
    training.ready,
    training.state.selectedIds,
    training.state.mode,
    initialFocus,
  ]);

  const selectedEntries = entriesFor(selectedIds);
  const validCount =
    selectedIds.length >= MIN_TRAINING_CHARACTERS &&
    selectedIds.length <= MAX_TRAINING_CHARACTERS;
  const canStart = draftReady && validCount;
  const weakIds = getWeakCharacterIds(training.state);
  const question = session?.questions[questionIndex];
  const answer = question
    ? answers.find((item) => item.questionId === question.id)
    : undefined;
  const target = question ? characterMap.get(question.targetId) : undefined;
  const currentAudio =
    audioReadiness?.questionId === question?.id ? audioReadiness : null;
  const audioAnswerReady =
    question?.kind !== "audio-to-letter" ||
    Boolean(
      currentAudio?.heard &&
        !currentAudio.playing &&
        currentAudio.available === true,
    );
  const learnEntry = selectedEntries[learnIndex] ?? selectedEntries[0];
  const incorrectIds = [
    ...new Set(
      answers.filter((item) => !item.correct).map((item) => item.characterId),
    ),
  ];
  const correctCount = answers.filter((item) => item.correct).length;
  const chosenEntry = answer?.selectedOptionId
    ? characterMap.get(answer.selectedOptionId)
    : undefined;

  function focusStage() {
    window.requestAnimationFrame(() => {
      const heading = stageHeading.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      const bounds = heading.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight)
        heading.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  function toggleCharacter(id: string) {
    setError(null);
    setRoundNote(null);
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < MAX_TRAINING_CHARACTERS
          ? [...current, id]
          : current,
    );
  }

  function chooseSet(ids: readonly string[]) {
    setSelectedIds([...ids]);
    setRoundNote(null);
    setError(null);
  }

  function startQuiz(
    ids = selectedIds,
    nextMode: CharacterTrainingMode = mode,
    note: string | null = roundNote,
  ) {
    try {
      const randomValues = window.crypto.getRandomValues(new Uint32Array(4));
      const seed = randomValues[0];
      const sessionId =
        window.crypto.randomUUID?.() ??
        `training-${Array.from(randomValues, (value) => value.toString(16)).join("-")}`;
      const practiceMode = activePracticeMode(nextMode);
      const next = createCharacterTrainingSession({
        selectedIds: ids,
        mode: practiceMode,
        seed,
        sessionId,
      });
      if (!training.saveSettings([...ids], practiceMode)) {
        setError(
          "練習する文字を設定できませんでした。文字を選び直してください。",
        );
        return;
      }
      setSelectedIds([...ids]);
      setMode(practiceMode);
      activeQuestionId.current = next.questions[0].id;
      audioReadinessRef.current = null;
      setAudioReadiness(null);
      setSession(next);
      setAnswers([]);
      setQuestionIndex(0);
      setSelectedOption(null);
      setRoundNote(note);
      setError(null);
      setStage("quiz");
      focusStage();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "この文字セットでは練習を始められません。文字を選び直してください。",
      );
    }
  }

  function startLearn(ids = selectedIds, note: string | null = roundNote) {
    if (
      ids.length < MIN_TRAINING_CHARACTERS ||
      ids.length > MAX_TRAINING_CHARACTERS
    )
      return;
    if (!training.saveSettings([...ids], mode)) {
      setError(
        "練習する文字を設定できませんでした。文字を選び直してください。",
      );
      return;
    }
    setSelectedIds([...ids]);
    setRoundNote(note);
    setLearnIndex(0);
    setRevealed(true);
    setError(null);
    setStage("learn");
    focusStage();
  }

  function practiceAgain(ids: string[]) {
    if (!ids.length) return;
    const withContrast = [...ids];
    let note: string | null = null;
    if (withContrast.length === 1) {
      const contrast = [...selectedIds, ...DEFAULT_CHARACTER_SELECTION].find(
        (id) => !withContrast.includes(id),
      );
      if (contrast) withContrast.push(contrast);
      note = "もう一度の1字に、見比べる1字を加えました。2字で8問練習します。";
    }
    setSelectedIds(withContrast.slice(0, MAX_TRAINING_CHARACTERS));
    setRoundNote(note);
    setError(null);
    setStage("setup");
    focusStage();
  }

  function submit(optionId: string | null) {
    if (!question || submitted.current.has(question.id)) return;
    const readiness = audioReadinessRef.current;
    if (
      question.kind === "audio-to-letter" &&
      (!readiness ||
        readiness.questionId !== question.id ||
        !readiness.heard ||
        readiness.playing ||
        readiness.available !== true)
    )
      return;
    const graded = gradeCharacterTrainingQuestion(question, optionId);
    submitted.current.add(question.id);
    setAnswers((current) => [...current, graded]);
    setSelectedOption(optionId);
    playEffect(graded.correct ? "correct" : "incorrect");
  }

  function nextQuestion() {
    if (!session || !answer) return;
    if (questionIndex === session.questions.length - 1) {
      if (
        answers.length !== TRAINING_ROUND_SIZE ||
        completed.current.has(session.id)
      )
        return;
      if (
        !training.saveSession(
          session.id,
          answers.map((item) => ({
            characterId: item.characterId,
            correct: item.correct,
          })),
        )
      ) {
        setError(
          "今回の練習を記録できませんでした。「結果を見る」でもう一度試してください。",
        );
        return;
      }
      completed.current.add(session.id);
      activeQuestionId.current = null;
      audioReadinessRef.current = null;
      setAudioReadiness(null);
      setStage("result");
      playEffect("review-complete");
    } else {
      activeQuestionId.current = session.questions[questionIndex + 1].id;
      audioReadinessRef.current = null;
      setAudioReadiness(null);
      setQuestionIndex((current) => current + 1);
      setSelectedOption(null);
    }
    focusStage();
  }

  function switchToTextPractice() {
    if (!training.saveSettings(selectedIds, "name-to-letter")) {
      setError(
        "文字だけの練習に切り替えられませんでした。文字を選び直してください。",
      );
      return;
    }
    activeQuestionId.current = null;
    audioReadinessRef.current = null;
    setAudioReadiness(null);
    setSession(null);
    setAnswers([]);
    setQuestionIndex(0);
    setSelectedOption(null);
    setMode("name-to-letter");
    setRoundNote("文字だけの練習に切り替えました。途中の回答は記録しません。");
    setLearnIndex(0);
    setRevealed(true);
    setStage("learn");
    setError(null);
    focusStage();
  }

  return (
    <div className="character-training">
      <header className="ct-header">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" /> CHARACTER STUDIO
          </p>
          <h1>文字を、楽しく覚えよう。</h1>
          <p className="ct-intro">文字を見て、音を聞いて、読み方を覚える。</p>
          <span className="ct-verification">教材案・専門家監修前</span>
        </div>
        <div className="ct-header-art" aria-hidden="true">
          <span className="thai" lang="th">
            ก
          </span>
          <span className="thai" lang="th">
            ม
          </span>
          <Sparkles size={19} />
        </div>
      </header>

      <ol className="ct-steps" aria-label="文字トレーニングの流れ">
        {[
          { label: "選ぶ", key: "setup", icon: Layers2 },
          { label: "聞いておぼえる", key: "learn", icon: Headphones },
          { label: "8問チャレンジ", key: "quiz", icon: Target },
        ].map((step, index) => (
          <li
            key={step.key}
            className={
              stage === step.key || (stage === "result" && step.key === "quiz")
                ? "is-current"
                : ""
            }
            aria-current={stage === step.key ? "step" : undefined}
          >
            <span>
              <step.icon size={18} aria-hidden="true" />
            </span>
            <b>{index + 1}</b> {step.label}
          </li>
        ))}
      </ol>

      {training.message && (
        <div className="ct-storage-message" role="status">
          <p>{training.message}</p>
          {training.loadStatus === "invalid" && (
            <div>
              <p className="ct-small">
                この操作で、読み取れない文字練習データを、このタブの記録で置き換えます。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => training.recoverStorage()}
              >
                保存データを初期化して保存する
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="ct-error" role="alert">
          {error}
        </p>
      )}

      {stage === "setup" && (
        <section className="ct-setup" aria-label="文字トレーニングの設定">
          <div className="ct-setup-main surface">
            <div className="ct-section-heading">
              <div>
                <p className="eyebrow">YOUR LETTERS</p>
                <h2 ref={stageHeading} tabIndex={-1}>
                  今日は、どの文字にする？
                </h2>
              </div>
              <span className="ct-count">
                {selectedIds.length}
                <small> / 8字</small>
              </span>
            </div>
            {!draftReady && (
              <p role="status">文字練習の設定を読み込んでいます…</p>
            )}
            {initialFocus && characterMap.has(initialFocus) && (
              <p className="ct-focus-note">
                <Lightbulb size={17} aria-hidden="true" />
                <span>
                  選んだ{" "}
                  <span className="thai" lang="th">
                    {characterMap.get(initialFocus)?.thai}
                  </span>{" "}
                  を含むセットです。
                </span>
              </p>
            )}
            {roundNote && (
              <p className="ct-context-note" role="status">
                {roundNote}
              </p>
            )}
            <section aria-label="練習する文字" className="ct-selected-grid">
              {selectedEntries.map((entry) => (
                <div key={entry.id} className="ct-selected-letter">
                  <span className="thai" lang="th">
                    {entry.thai}
                  </span>
                  <small className="thai" lang="th">
                    {entry.name}
                  </small>
                  {entry.usage === "obsolete" && <small>廃用字</small>}
                </div>
              ))}
              {!selectedEntries.length && (
                <p className="ct-empty-selection">
                  下の文字一覧から2〜8字を選びましょう。
                </p>
              )}
            </section>
            <div className="ct-preset-grid" aria-label="文字セット">
              {CHARACTER_TRAINING_PRESETS.map((preset) => {
                const active =
                  preset.characterIds.length === selectedIds.length &&
                  preset.characterIds.every((id) => selectedIds.includes(id));
                return (
                  <button
                    type="button"
                    className={`ct-preset${active ? " is-selected" : ""}`}
                    key={preset.id}
                    aria-pressed={active}
                    aria-label={preset.title}
                    disabled={!draftReady}
                    onClick={() => chooseSet(preset.characterIds)}
                  >
                    <span className="ct-preset-title">
                      {preset.title}
                      {active && <Check size={16} aria-hidden="true" />}
                    </span>
                    <span className="thai" lang="th">
                      {entriesFor(preset.characterIds)
                        .map((entry) => entry.thai)
                        .join(" ")}
                    </span>
                    <small>{preset.description}</small>
                  </button>
                );
              })}
              <button
                type="button"
                className="ct-preset ct-weak-preset"
                disabled={!draftReady || weakIds.length === 0}
                onClick={() => practiceAgain(weakIds)}
              >
                <span className="ct-preset-title">
                  <RotateCcw size={16} aria-hidden="true" />
                  前回まちがえた文字
                </span>
                <span className="thai" lang="th">
                  {weakIds.length
                    ? entriesFor(weakIds)
                        .map((entry) => entry.thai)
                        .join(" ")
                    : "—"}
                </span>
                <small>
                  {weakIds.length
                    ? "直近の回答でもう一度になった文字"
                    : "8問が終わると、ここに集まります"}
                </small>
              </button>
            </div>
            <details className="ct-custom">
              <summary>
                44文字からカスタム<span aria-hidden="true">＋</span>
              </summary>
              <p id="ct-selection-help" className="ct-small">
                2〜8字を選択。選んだ文字をもう一度押すと外せます。廃用字は現在通常使わない文字です。
              </p>
              <div
                className="ct-all-letters"
                aria-describedby="ct-selection-help"
              >
                {alphabetCharacters.map((entry) => {
                  const selected = selectedIds.includes(entry.id);
                  return (
                    <button
                      type="button"
                      key={entry.id}
                      data-testid={`training-selection-${entry.id}`}
                      className={selected ? "is-selected" : ""}
                      aria-label={`${entry.thai} を練習に選ぶ`}
                      aria-pressed={selected}
                      disabled={
                        !draftReady ||
                        (!selected &&
                          selectedIds.length >= MAX_TRAINING_CHARACTERS)
                      }
                      onClick={() => toggleCharacter(entry.id)}
                      title={`${getCharacterTrainingCue(entry)} · ${entry.initialIpa}${entry.usage === "obsolete" ? " · 廃用字" : ""}`}
                    >
                      <span className="thai" lang="th">
                        {entry.thai}
                      </span>
                      {entry.usage === "obsolete" ? (
                        <small>廃用字</small>
                      ) : (
                        <small>{getCharacterTrainingCue(entry)}</small>
                      )}
                      {selected && <Check size={13} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <p className="ct-small" role="status">
                {selectedIds.length}字を選択中
                {selectedIds.length < MIN_TRAINING_CHARACTERS
                  ? " · あと1字以上選ぶと始められます"
                  : selectedIds.length === MAX_TRAINING_CHARACTERS
                    ? " · 上限の8字です"
                    : " · 最大8字まで"}
              </p>
            </details>
          </div>
          <aside className="ct-setup-aside">
            <div className="surface ct-mode-panel">
              <p className="eyebrow">CHOOSE YOUR CHALLENGE</p>
              <fieldset>
                <legend>練習モード</legend>
                {MODES.map((item) => (
                  <ModeOption
                    key={item.value}
                    item={item}
                    mode={mode}
                    disabled={!draftReady}
                    onSelect={setMode}
                  />
                ))}
              </fieldset>
              {mode === "name-to-letter" && (
                <p className="ct-small">
                  日本語の意味は出題しません。字母名の最初の音節をIPAで、文字名を英字で表示します。
                </p>
              )}
              {!validCount && (
                <p className="ct-context-note" role="status">
                  始めるには2〜8字を選んでください。
                </p>
              )}
              {mode === "audio-to-letter" && (
                <p className="ct-small">
                  聞く音声は、子音単体の音ではなく「文字の名前（字母名）」です。合成音声が使えないときは、文字だけの練習に切り替えられます。
                </p>
              )}
              <div className="ct-start-actions">
                <Button
                  type="button"
                  size="lg"
                  disabled={!canStart}
                  onClick={() => startLearn()}
                >
                  <Headphones size={19} />
                  このセットで覚える
                  <ArrowRight size={18} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canStart}
                  onClick={() => startQuiz()}
                >
                  すぐに8問チャレンジ
                </Button>
              </div>
            </div>
            <div className="ct-gentle-note">
              <Lightbulb size={22} aria-hidden="true" />
              <p>
                まちがえても大丈夫。
                <br />
                聞き直すたび、文字に慣れます。
              </p>
            </div>
            <div className="ct-session-stat">
              <span>
                <b>{training.state.sessionsCompleted}</b> 回
              </span>
              <p>
                これまでに終えた8問練習
                <br />
                <small>レッスンのXPには加算しません</small>
              </p>
            </div>
          </aside>
        </section>
      )}

      {stage === "learn" && learnEntry && (
        <section className="surface ct-learn" aria-label="文字をおぼえる">
          <div className="ct-section-heading">
            <div>
              <p className="eyebrow">LISTEN & READ</p>
              <h2 ref={stageHeading} tabIndex={-1}>
                聞く。読む。思い出す。
              </h2>
            </div>
            <span className="ct-count">
              {learnIndex + 1}
              <small> / {selectedEntries.length}字</small>
            </span>
          </div>
          {roundNote && <p className="ct-context-note">{roundNote}</p>}
          <div className="ct-learn-layout">
            <div className="ct-flashcard">
              <span className="thai ct-flashcard-glyph" lang="th">
                {learnEntry.thai}
              </span>
              {revealed ? (
                <div className="ct-flashcard-answer">
                  <span className="ct-small">文字の名前（字母名）</span>
                  <p className="thai ct-letter-name" lang="th">
                    {learnEntry.name}
                  </p>
                  <p className="ct-name-meaning">
                    {getCharacterTrainingCue(learnEntry)}の文字
                  </p>
                  {learnEntry.usage === "obsolete" && (
                    <span className="ct-obsolete">
                      廃用字・現在は通常使いません
                    </span>
                  )}
                </div>
              ) : (
                <div className="ct-flashcard-hidden">
                  <Headphones size={32} aria-hidden="true" />
                  <p>音を聞いて、文字の名前を思い出そう。</p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevealed((current) => !current)}
              >
                {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
                {revealed ? "名前をかくす" : "名前をみる"}
              </Button>
            </div>
            <div className="ct-learn-details">
              <div className="ct-letter-tabs" aria-label="確認する文字">
                {selectedEntries.map((entry, index) => (
                  <button
                    type="button"
                    key={entry.id}
                    className={index === learnIndex ? "is-selected" : ""}
                    aria-label={`${entry.thai} を確認`}
                    aria-pressed={index === learnIndex}
                    onClick={() => {
                      setLearnIndex(index);
                      setRevealed(true);
                    }}
                  >
                    <span className="thai" lang="th">
                      {entry.thai}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ct-learn-audio">
                <p className="ct-audio-heading">
                  <Headphones size={22} aria-hidden="true" />
                  まず、音を聞いてみよう
                </p>
                <AudioNotice />
                <div className="ct-name-audio">
                  <SpeakButton
                    key={`name-${learnEntry.id}`}
                    text={learnEntry.name}
                    label="文字の名前を聞く"
                  />
                </div>
                <div className="ct-example-audio">
                  <SpeakButton
                    key={`example-${learnEntry.id}`}
                    text={learnEntry.example.thai}
                    label="例語を聞く"
                    compact
                  />
                </div>
                <p className="ct-small">
                  字母名は文字を呼ぶ名前です。子音単体の音とは異なります。
                </p>
              </div>
              {revealed ? (
                <>
                  <div className="ct-example-card">
                    <span className="ct-small">
                      {learnEntry.usage === "obsolete"
                        ? "対応する現代字の例語"
                        : "この文字を使う例語"}
                    </span>
                    <span className="thai" lang="th">
                      {learnEntry.example.thai}
                    </span>
                    <strong>{learnEntry.example.meaning}</strong>
                    <span>{learnEntry.example.ipa}</span>
                    {learnEntry.example.note && (
                      <p className="ct-small">{learnEntry.example.note}</p>
                    )}
                  </div>
                  <details className="ct-extra">
                    <summary>字体・発音のメモ</summary>
                    <div className="ct-font-comparison">
                      <div>
                        <span className="ct-font-looped" lang="th">
                          {learnEntry.thai}
                        </span>
                        <small>標準</small>
                      </div>
                      <div>
                        <span className="ct-font-loopless" lang="th">
                          {learnEntry.thai}
                        </span>
                        <small>ループなし</small>
                      </div>
                    </div>
                    <p>字母名（最初の音節）：{learnEntry.ipa}</p>
                    <p>子音の基本初頭音：{learnEntry.initialIpa}</p>
                    <p className="ct-small">
                      字母名のIPAは、名前全体の発音ではありません。例語のIPAには、その語の母音と声調も含まれます。
                    </p>
                    {learnEntry.note && <p>{learnEntry.note}</p>}
                    <Link
                      className="ct-text-link"
                      href={`/writing?character=${learnEntry.id}`}
                    >
                      この文字の書取りへ <ArrowRight size={15} />
                    </Link>
                  </details>
                </>
              ) : (
                <p className="ct-hidden-hint">
                  音声で思い出したら、「名前をみる」で読み方と例語を確認できます。
                </p>
              )}
            </div>
          </div>
          <div className="ct-bottom-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                activeQuestionId.current = null;
                setStage("setup");
                focusStage();
              }}
            >
              <ArrowLeft size={17} />
              文字を選び直す
            </Button>
            <Button type="button" size="lg" onClick={() => startQuiz()}>
              <Headphones size={19} />
              8問チャレンジをはじめる
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      )}

      {stage === "quiz" && session && question && target && (
        <section
          className="surface ct-quiz"
          aria-label="文字チャレンジ"
          data-character-id={question.targetId}
          data-target-id={question.targetId}
          data-kind={question.kind}
          data-question-kind={question.kind}
          data-question-index={questionIndex + 1}
        >
          <div className="ct-quiz-top">
            <span className="eyebrow">RECALL CHALLENGE</span>
            <strong>
              {questionIndex + 1}
              <span> / {session.questions.length} 問</span>
            </strong>
          </div>
          <div
            className="ct-round-track"
            aria-label={`${questionIndex + 1}問目 / ${session.questions.length}問`}
          >
            {session.questions.map((item, index) => {
              const graded = answers.find(
                (record) => record.questionId === item.id,
              );
              return (
                <span
                  key={item.id}
                  className={
                    graded
                      ? graded.correct
                        ? "is-correct"
                        : "is-review"
                      : index === questionIndex
                        ? "is-active"
                        : ""
                  }
                  aria-hidden="true"
                >
                  {graded ? (
                    graded.correct ? (
                      <Check size={14} />
                    ) : (
                      <RotateCcw size={12} />
                    )
                  ) : null}
                </span>
              );
            })}
          </div>
          {session.soundFallback && (
            <p className="ct-small ct-fallback">
              このセットのミックスは、同音による紛らわしさを避けて「名前から文字」で出題しています。
            </p>
          )}
          <div className="ct-question">
            <h2 ref={stageHeading} tabIndex={-1}>
              {question.prompt}
            </h2>
            {question.kind === "audio-to-letter" ? (
              <div className="ct-audio-question">
                <AudioNotice />
                {!answer ? (
                  <>
                    {question.audioText ? (
                      <CharacterAudioPrompt
                        key={question.id}
                        questionId={question.id}
                        text={question.audioText}
                        onReadyChange={handleAudioReadiness}
                      />
                    ) : (
                      <p role="alert">
                        この問題の音声データを確認できません。文字だけの練習に切り替えてください。
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      className="ct-audio-fallback"
                      onClick={switchToTextPractice}
                    >
                      文字だけの練習に切り替える
                    </Button>
                  </>
                ) : (
                  <p className="ct-audio-finished">
                    <Headphones size={21} aria-hidden="true" />
                    音声の答えを確認しよう
                  </p>
                )}
              </div>
            ) : question.kind === "name-to-letter" ? (
              <div className="ct-reading-cue">
                <strong className="ct-reading-ipa">{question.cue}</strong>
                <span className="ct-small">字母名の最初の音節 / IPA</span>
                <strong className="ct-reading-name">
                  {question.readingName}
                </strong>
                <span className="ct-small">字母名の英字表記（Unicode名）</span>
                <p className="ct-small">
                  英字名は発音記号ではありません。同じ音の文字は、英字名も手がかりに選びましょう。
                </p>
                <details className="ct-reading-audio">
                  <summary>読み方を音声で確認する</summary>
                  <AudioNotice />
                  <SpeakButton
                    key={question.id}
                    text={target.name}
                    label="読み方を聞く"
                  />
                </details>
              </div>
            ) : (
              <>
                <span className="thai ct-question-glyph" lang="th">
                  {target.thai}
                </span>
                <p className="ct-small">
                  文字の基本初頭音をIPAから選びましょう。
                </p>
              </>
            )}
          </div>
          <fieldset
            className={`ct-options${question.kind === "letter-to-sound" ? " ct-sound-options" : ""}`}
            disabled={Boolean(answer)}
          >
            <legend className="ct-sr-only">答えを選ぶ</legend>
            {question.options.map((option) => {
              const picked = selectedOption === option.id;
              const correct =
                Boolean(answer) && option.id === question.correctOptionId;
              const wrong = Boolean(answer) && picked && !answer?.correct;
              return (
                <label
                  key={option.id}
                  className={`ct-option${picked ? " is-selected" : ""}${correct ? " is-correct" : ""}${wrong ? " is-incorrect" : ""}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    data-option-id={option.id}
                    value={option.id}
                    checked={picked}
                    onChange={() => setSelectedOption(option.id)}
                    aria-label={option.label}
                  />
                  <span
                    className={
                      question.kind !== "letter-to-sound"
                        ? "thai ct-option-glyph"
                        : "ct-option-ipa"
                    }
                    lang={
                      question.kind !== "letter-to-sound" ? "th" : undefined
                    }
                  >
                    {option.label}
                  </span>
                  <span className="ct-option-status" aria-hidden="true">
                    {correct ? (
                      <Check size={20} />
                    ) : wrong ? (
                      <X size={20} />
                    ) : picked ? (
                      <span className="ct-option-dot" />
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {!answer ? (
            <div className="ct-answer-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={!audioAnswerReady}
                onClick={() => submit(null)}
              >
                わからない
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={!selectedOption || !audioAnswerReady}
                onClick={() => submit(selectedOption)}
              >
                答えを確認
                <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <div
              className={`ct-feedback${answer.correct ? " is-correct" : " is-review"}`}
              role="status"
            >
              <div className="ct-feedback-title">
                {answer.correct ? (
                  <Check size={23} aria-hidden="true" />
                ) : (
                  <Lightbulb size={23} aria-hidden="true" />
                )}
                <h3>
                  {answer.correct
                    ? "そのとおり！"
                    : answer.selectedOptionId === null
                      ? "一緒に、見てみよう。"
                      : "見比べて、もう一度。"}
                </h3>
              </div>
              <p>
                {question.kind === "audio-to-letter" ? (
                  <>
                    聞こえた文字の名前は{" "}
                    <span className="thai" lang="th">
                      {target.name}
                    </span>
                    。対応する文字は{" "}
                    <span className="thai" lang="th">
                      {target.thai}
                    </span>{" "}
                    です。
                  </>
                ) : question.kind === "name-to-letter" ? (
                  <>
                    <strong>{question.cue}</strong>
                    （字母名の最初の音節）と、英字名{" "}
                    <strong>{question.readingName}</strong> に対応する文字は{" "}
                    <span className="thai" lang="th">
                      {target.thai}
                    </span>
                    （
                    <span className="thai" lang="th">
                      {target.name}
                    </span>
                    ）です。
                  </>
                ) : (
                  <>
                    <span className="thai" lang="th">
                      {target.thai}
                    </span>{" "}
                    の基本初頭音は <strong>{target.initialIpa}</strong>{" "}
                    です。母音や声調を加える前の子音の音を確認しています。
                  </>
                )}
              </p>
              {!answer.correct &&
                question.kind !== "letter-to-sound" &&
                chosenEntry && (
                  <div className="ct-comparison">
                    <div>
                      <small>今回の文字</small>
                      <CharacterIdentity entry={target} compact />
                    </div>
                    <div>
                      <small>選んだ文字</small>
                      <CharacterIdentity entry={chosenEntry} compact />
                    </div>
                  </div>
                )}
              {!answer.correct &&
                question.kind === "letter-to-sound" &&
                answer.selectedOptionId && (
                  <p className="ct-small">
                    選んだ音：
                    {
                      question.options.find(
                        (option) => option.id === answer.selectedOptionId,
                      )?.label
                    }{" "}
                    ／ 今回の基本初頭音：{target.initialIpa}
                  </p>
                )}
              {question.kind === "audio-to-letter" && (
                <>
                  <p className="ct-small">
                    字母名（最初の音節）のIPA：{target.ipa}
                    。名前全体のIPAではありません。
                  </p>
                  <div className="ct-feedback-audio">
                    <AudioNotice />
                    <SpeakButton
                      text={target.name}
                      label="正解の文字名を聞く"
                    />
                    <SpeakButton
                      text={target.example.thai}
                      label="正解の例語を聞く"
                      compact
                    />
                  </div>
                </>
              )}
              {target.note && <p className="ct-small">{target.note}</p>}
              <p className="ct-small">
                {answer.correct
                  ? "このつながりを、次も思い出してみましょう。"
                  : "まちがえてもペナルティはありません。この回答は変更せず、最後に見直せます。"}
              </p>
              <Button type="button" size="lg" onClick={nextQuestion}>
                {questionIndex === session.questions.length - 1
                  ? "結果を見る"
                  : "次の文字へ"}
                <ArrowRight size={18} />
              </Button>
            </div>
          )}
          <button
            type="button"
            className="ct-quit"
            onClick={() => {
              activeQuestionId.current = null;
              setStage("setup");
              setRoundNote(
                "途中の回答は記録しません。文字を選んで、また始められます。",
              );
              focusStage();
            }}
          >
            文字を選び直す
          </button>
        </section>
      )}

      {stage === "result" && session && (
        <section
          className="surface ct-result"
          aria-label="文字トレーニングの結果"
        >
          <div className="ct-result-icon">
            <Trophy size={37} aria-hidden="true" />
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <p className="eyebrow">A LITTLE PRACTICE, EVERY DAY</p>
          <h2 ref={stageHeading} tabIndex={-1}>
            8問の文字練習、おつかれさま。
          </h2>
          <div className="ct-result-score">
            <strong>
              {correctCount}
              <small> / {TRAINING_ROUND_SIZE}</small>
            </strong>
            <span>今回の正解</span>
          </div>
          <p className="ct-result-message">
            {incorrectIds.length
              ? "もう一度の文字を、並べて見てみよう。"
              : "今回は、すべての問題を確認できました。"}
          </p>
          <div
            className="ct-result-letters"
            aria-label={
              incorrectIds.length ? "もう一度の文字" : "今回練習した文字"
            }
          >
            {entriesFor(
              incorrectIds.length ? incorrectIds : session.selectedIds,
            ).map((entry) => (
              <div key={entry.id}>
                <CharacterIdentity entry={entry} compact />
                <Link
                  href={`/writing?character=${entry.id}`}
                  className="ct-text-link"
                >
                  書いてみる
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
          {incorrectIds.length > 0 && (
            <details className="ct-result-review">
              <summary>名前・例語をもう一度見る</summary>
              <AudioNotice />
              {entriesFor(incorrectIds).map((entry) => (
                <div className="ct-review-entry" key={entry.id}>
                  <CharacterIdentity entry={entry} />
                  <p>
                    例語：
                    <span className="thai" lang="th">
                      {entry.example.thai}
                    </span>{" "}
                    · {entry.example.meaning} · {entry.example.ipa}
                  </p>
                  {entry.note && <p className="ct-small">{entry.note}</p>}
                  <SpeakButton
                    text={entry.name}
                    label={`${entry.thai} の名前を聞く`}
                  />
                </div>
              ))}
            </details>
          )}
          <div className="ct-result-actions">
            <Button
              type="button"
              size="lg"
              onClick={() => startQuiz(session.selectedIds, session.mode, null)}
            >
              <RotateCcw size={18} />
              同じセットでもう1回
            </Button>
            {incorrectIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => practiceAgain(incorrectIds)}
              >
                もう一度の文字で練習
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStage("setup");
                setRoundNote(null);
                focusStage();
              }}
            >
              文字を選び直す
            </Button>
          </div>
          <p className="ct-small">
            {training.loadStatus === "loaded"
              ? "8問の回答をこの端末に記録しました。"
              : "8問の回答は、このタブの記録に反映しました。"}{" "}
            今回の結果は習得の保証ではありません。日を変えて、また思い出してみましょう。
          </p>
          <Link href="/characters" className="ct-text-link">
            文字ライブラリへ
            <ArrowRight size={15} />
          </Link>
        </section>
      )}

      <footer className="ct-disclosure">
        <span>
          <CircleHelp size={16} aria-hidden="true" />{" "}
          教材のIPA・字母名・語義は未監修
        </span>
        <details>
          <summary>教材と練習記録について</summary>
          <p>
            44子音の文字コード・公式文字名はUnicode資料と照合済みです。IPA・語義・子音クラスは専門家の監修前で、正確性を保証するものではありません。
          </p>
          <p>
            文字トレーニングは独立した練習です。XP・通常レッスンの正答率・解放条件・単語の復習予定は変わりません。文字ごとの「もう一度」は直近の回答で決まり、習熟度の判定ではありません。
          </p>
          <Link href="/characters#content-sources" className="ct-text-link">
            文字教材の出典を見る
            <ArrowRight size={14} />
          </Link>
        </details>
      </footer>
    </div>
  );
}

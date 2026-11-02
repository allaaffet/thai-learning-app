"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleCheck,
  Coffee,
  Heart,
  Lightbulb,
  LockKeyhole,
  MessageCircle,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  getRomanceCharacter,
  getRomanceEpisode,
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceEpisodes,
  romanceSources,
  romanceSourceNotes,
  romanceWords,
} from "@/data/romance";
import type {
  RomanceCharacter,
  RomanceEpisodeId,
  RomanceGender,
  RomancePreference,
  RomanceQuestion,
} from "@/lib/romance-types";
import {
  createRomanceSessionId,
  getAvailableRomanceCharacters,
  getRomanceCharacterProgress,
  getRomanceEnding,
  getRomanceRelationship,
  gradeRomanceChoice,
  isRomanceEpisodeUnlocked,
} from "@/lib/romance";
import { useRomance } from "@/components/use-romance";
import { useRomanceLearning } from "@/components/use-romance-learning";
import { RomanceJourneyPlayer } from "@/components/romance-journey-player";
import { RomancePassport } from "@/components/romance-passport";
import { getJourneyChapter } from "@/data/romance-journey";
import { getJourneyLearningProgress } from "@/lib/romance-journey";
import { RomancePortrait } from "@/components/romance-portrait";
import {
  SpeakButton,
  type SpeakButtonHandle,
} from "@/components/speech-practice";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { Button } from "@/components/ui/button";

const preferences: { id: RomancePreference; label: string; detail: string }[] =
  [
    {
      id: "warm",
      label: "明るく親しみやすい",
      detail: "一緒に笑って、会話を楽しみたい",
    },
    {
      id: "calm",
      label: "穏やかで優しい",
      detail: "ゆっくり、自然体で話したい",
    },
    {
      id: "curious",
      label: "落ち着いて知的",
      detail: "新しいことを、一緒に見つけたい",
    },
  ];
const preferenceName = (id: RomancePreference) =>
  preferences.find((item) => item.id === id)?.label ?? id;
type Stage =
  | "setup"
  | "roster"
  | "character"
  | "episode"
  | "story"
  | "review"
  | "result";
type RomanceState = ReturnType<typeof useRomance>["state"];
type Receipt = NonNullable<
  ReturnType<ReturnType<typeof useRomance>["finishEpisode"]>
>;
type EpisodeInput = Parameters<
  ReturnType<typeof useRomance>["finishEpisode"]
>[0];
type Grade = ReturnType<typeof gradeRomanceChoice>;

/** Keep each radio group to one tab stop, with native-like arrow navigation. */
function moveRadio(event: KeyboardEvent<HTMLDivElement>) {
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ].includes(event.key)
  )
    return;
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ),
  );
  const current = radios.findIndex((radio) => radio === event.target);
  if (current < 0) return;
  event.preventDefault();
  const backwards = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? radios.length - 1
        : (current + (backwards ? -1 : 1) + radios.length) % radios.length;
  radios[next]?.focus();
  radios[next]?.click();
}

function Affinity({
  character,
  value,
}: {
  character: RomanceCharacter;
  value: number;
}) {
  return (
    <div className="rc-affinity">
      <div>
        <span>
          <Heart size={16} aria-hidden="true" />
          物語の好感度
        </span>
        <strong>
          {value}
          <small> / 100</small>
        </strong>
      </div>
      <progress
        value={value}
        max={100}
        aria-label={`${character.name} の好感度`}
      />
      <p>{getRomanceRelationship(value).label}</p>
    </div>
  );
}

function RomanceSetup({
  profile,
  onSave,
  onCancel,
}: {
  profile: RomanceState["profile"];
  onSave: (gender: RomanceGender, preference: RomancePreference) => void;
  onCancel: () => void;
}) {
  const [gender, setGender] = useState<RomanceGender | null>(
    profile?.gender ?? null,
  );
  const [preference, setPreference] = useState<RomancePreference | null>(
    profile?.preference ?? null,
  );
  return (
    <div className="rc-setup surface">
      <div className="rc-setup-heading">
        <Heart size={32} aria-hidden="true" />
        <h2>どんな出会いから、はじめよう？</h2>
        <p>物語の主人公と、気になるタイプを選んでください。</p>
      </div>
      <fieldset>
        <legend>主人公の性別</legend>
        <div
          className="rc-gender-options"
          role="radiogroup"
          aria-label="主人公の性別"
          onKeyDown={moveRadio}
        >
          {(["male", "female"] as const).map((value) => (
            <button
              type="button"
              role="radio"
              aria-checked={gender === value}
              tabIndex={
                gender === value || (!gender && value === "male") ? 0 : -1
              }
              key={value}
              className={gender === value ? "is-selected" : ""}
              onClick={() => setGender(value)}
            >
              <span aria-hidden="true">{value === "male" ? "♂" : "♀"}</span>
              {value === "male" ? "男性" : "女性"}
            </button>
          ))}
        </div>
        <p className="rc-small">
          この物語では、主人公と異なる性別の成人キャラクターと出会います。
        </p>
      </fieldset>
      <fieldset>
        <legend>好みのタイプ</legend>
        <div
          className="rc-preferences"
          role="radiogroup"
          aria-label="好みのタイプ"
          onKeyDown={moveRadio}
        >
          {preferences.map((item) => (
            <button
              type="button"
              role="radio"
              aria-label={item.label}
              aria-checked={preference === item.id}
              tabIndex={
                preference === item.id || (!preference && item.id === "warm")
                  ? 0
                  : -1
              }
              key={item.id}
              onClick={() => setPreference(item.id)}
              className={preference === item.id ? "is-selected" : ""}
            >
              <Heart size={21} aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              {preference === item.id && <Check size={20} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="rc-small">
        設定と物語の記録はこのブラウザ内だけに保存します。あとで変更しても、相手ごとの記録は残ります。
      </p>
      <div className="rc-actions">
        <Button
          size="lg"
          disabled={!gender || !preference}
          onClick={() => {
            if (gender && preference) onSave(gender, preference);
          }}
        >
          この設定で物語をはじめる
          <ArrowRight size={18} />
        </Button>
        {profile && (
          <Button variant="ghost" onClick={onCancel}>
            今の設定で戻る
          </Button>
        )}
      </div>
    </div>
  );
}

function RomanceSources() {
  return (
    <details className="rc-sources">
      <summary>
        <BookOpen size={17} aria-hidden="true" />
        教材・音声・イラストについて
      </summary>
      <p>{romanceSourceNotes}</p>
      <p>
        音声は端末の合成音声（未監修）です。音声の提供元と通信する場合があります。タイ語の声がない端末でも、文字と日本語訳で進められます。
      </p>
      <p>
        イラストはこのコース用に生成した架空の成人キャラクターです。実在する人物を示しません。好感度は物語の進行値で、現実の恋愛やタイ語の習熟度の評価ではありません。
      </p>
      {romanceSources.map((source) => (
        <div key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title}
          </a>
          <p className="rc-small">{source.scope}</p>
        </div>
      ))}
    </details>
  );
}

export function RomanceCourse({ classic = false }: { classic?: boolean }) {
  const progress = useRomance();
  const learning = useRomanceLearning();
  const [stage, setStage] = useState<Stage>("roster");
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [episodeId, setEpisodeId] = useState<RomanceEpisodeId | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const recovery = useRef<HTMLDialogElement>(null);
  const learningRecovery = useRef<HTMLDialogElement>(null);
  const character = characterId ? getRomanceCharacter(characterId) : undefined;
  const compatible = Boolean(
    character &&
      progress.state.profile &&
      character.gender !== progress.state.profile.gender,
  );
  const visibleStage: Stage =
    !progress.state.profile || stage === "setup"
      ? "setup"
      : characterId && !compatible
        ? "roster"
        : stage;
  const active = compatible ? character : undefined;
  const record = active
    ? getRomanceCharacterProgress(progress.state, active.id)
    : null;

  useEffect(() => {
    if (
      !progress.ready ||
      !["setup", "roster", "character"].includes(visibleStage)
    )
      return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [progress.ready, visibleStage, characterId]);

  function roster() {
    setStage("roster");
    setCharacterId(null);
    setEpisodeId(null);
    setSessionId(null);
  }
  function startEpisode(id: RomanceEpisodeId) {
    if (!active || !isRomanceEpisodeUnlocked(progress.state, active.id, id))
      return;
    setEpisodeId(id);
    setSessionId(createRomanceSessionId());
    setStage("episode");
  }

  if (!progress.ready || (!classic && !learning.ready))
    return <p role="status">物語のしおりを読み込んでいます…</p>;
  const people = getAvailableRomanceCharacters(progress.state);
  const ending = active ? getRomanceEnding(progress.state, active.id) : null;

  return (
    <section
      className={`romance-course${!classic && !["setup", "roster", "character"].includes(visibleStage) ? " is-journey-playing" : ""}`}
      aria-label="恋するタイ語"
      data-romance-stage={visibleStage}
      data-character-id={active?.id}
      data-episode-id={episodeId ?? undefined}
    >
      {!classic && !["setup", "roster", "character"].includes(visibleStage) && (
        <h1 className="sr-only">恋するタイ語 — 会話の冒険</h1>
      )}
      <header className="rc-page-header">
        <div>
          <p className="eyebrow">
            <Heart size={16} aria-hidden="true" /> PRACTICE · STORY
          </p>
          <h1 className="page-title" ref={heading} tabIndex={-1}>
            恋するタイ語
          </h1>
          <p className="page-description">
            ことばを交わすたび、少しずつ近づく。
          </p>
        </div>
        {progress.state.profile && visibleStage !== "setup" && (
          <Button variant="ghost" onClick={() => setStage("setup")}>
            <Settings2 size={17} />
            主人公の設定を変更
          </Button>
        )}
      </header>
      <p className="rc-course-note">
        架空の成人との、台本付きの恋愛シミュレーション。タイ語の返答と、相手を知る選択を楽しむコースです。
      </p>
      {progress.message && (
        <div className="rc-storage-notice" role="status">
          <p>{progress.message}</p>
          {progress.status === "invalid" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => recovery.current?.showModal()}
            >
              このコースの保存データを置き換える
            </Button>
          )}
        </div>
      )}

      {!classic && learning.message && (
        <div
          className="rc-storage-notice"
          role="status"
          data-testid="romance-learning-notice"
        >
          <p>{learning.message}</p>
          {learning.status === "invalid" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => learningRecovery.current?.showModal()}
            >
              会話パスポートの保存を置き換える
            </Button>
          )}
        </div>
      )}
      {classic && (
        <p className="rc-small">
          以前の3問練習を表示しています。
          <Link href="/romance">新しい物語と会話の冒険へ</Link>
        </p>
      )}
      {visibleStage === "setup" ? (
        <RomanceSetup
          key={
            progress.state.profile
              ? `${progress.state.profile.gender}:${progress.state.profile.preference}`
              : "new"
          }
          profile={progress.state.profile}
          onSave={(gender, preference) => {
            if (progress.saveProfile(gender, preference)) roster();
          }}
          onCancel={roster}
        />
      ) : visibleStage === "roster" ? (
        <>
          <section className="rc-roster-intro">
            <span className="rc-badge">
              <Coffee size={17} /> Bangkok · Book café
            </span>
            <h2>今日、誰と話してみる？</h2>
            <p>
              気になる相手を選びましょう。好みのタイプに近い人には、おすすめの印を付けています。
            </p>
            {!classic && (
              <div
                className="rjp-howto"
                aria-label="会話を身につける3つのステップ"
              >
                <span>
                  <BookOpen size={18} /> 見つける
                </span>
                <span>
                  <MessageCircle size={18} /> 組んで、使う
                </span>
                <span>
                  <Sparkles size={18} /> また思い出す
                </span>
              </div>
            )}
          </section>
          <div className="rc-roster">
            {people.map((person) => {
              const personRecord = getRomanceCharacterProgress(
                progress.state,
                person.id,
              );
              const recommended = Boolean(
                progress.state.profile &&
                  person.traits.includes(progress.state.profile.preference),
              );
              return (
                <button
                  type="button"
                  key={person.id}
                  className="rc-person-card surface"
                  data-character-id={person.id}
                  data-recommended={recommended ? "true" : "false"}
                  aria-label={`${person.name} と会話する`}
                  onClick={() => {
                    setCharacterId(person.id);
                    setStage("character");
                  }}
                >
                  <RomancePortrait
                    character={person}
                    className="rc-roster-portrait"
                  />
                  <div className="rc-person-copy">
                    <span className="rc-person-name">
                      {person.name}
                      <small>{person.age}歳</small>
                    </span>
                    {recommended && (
                      <span className="rc-recommended">
                        <Sparkles size={14} />
                        好みのタイプ
                      </span>
                    )}
                    <p>{person.description}</p>
                    <div className="rc-traits">
                      {person.traits.map((trait) => (
                        <span key={trait}>{preferenceName(trait)}</span>
                      ))}
                    </div>
                    <Affinity
                      character={person}
                      value={personRecord.affinity}
                    />
                    <span className="rc-person-go">
                      会いにいく
                      <ArrowRight size={18} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rc-daily-note">
            <CalendarDays size={23} aria-hidden="true" />
            <div>
              <h3>一日ひとつの会話から。</h3>
              <p>
                その相手との会話を終えた日に、継続ボーナス。前日から続けば少し上乗せされます。休んだ日だけで好感度が下がることはありません。
              </p>
            </div>
          </div>
        </>
      ) : visibleStage === "character" && active && record ? (
        <>
          <Button variant="ghost" onClick={roster}>
            <ArrowLeft size={17} />
            ほかの人と話す
          </Button>
          <div className="rc-character-grid">
            <RomancePortrait
              character={active}
              className="rc-character-portrait"
            />
            <section className="surface rc-character-info">
              <p className="eyebrow">YOUR STORY</p>
              <h2>
                {active.name}
                <small>{active.age}歳</small>
              </h2>
              <p>{active.description}</p>
              <div className="rc-traits">
                {active.traits.map((trait) => (
                  <span key={trait}>{preferenceName(trait)}</span>
                ))}
              </div>
              <Affinity character={active} value={record.affinity} />
              <div className="rc-character-days">
                <CalendarDays size={20} />
                <div>
                  <strong>{record.studyDays.length}日</strong>
                  <span>この相手と会話した日</span>
                </div>
                <div>
                  <strong>{record.streak}日</strong>
                  <span>直近の連続記録</span>
                </div>
              </div>
              <p className="rc-small">
                好感度は物語上の数値です。会話能力の成績や、現実の関係の評価ではありません。
              </p>
            </section>
          </div>
          {!classic && (
            <RomancePassport character={active} state={learning.state} />
          )}
          <section
            className="rc-episodes"
            aria-label={`${active.name} のエピソード`}
          >
            <h2>
              {classic
                ? "ふたりの、小さなエピソード"
                : "5つの出会い、5つの会話ゴール"}
            </h2>
            <p>
              {classic
                ? "各話の3つの返答を確かめ、最後に物語の行動を選びます。"
                : "行き先を選んで物語へ。ことばを組み、会話をつなぎ、以前のひと言を使ってみよう。"}
            </p>
            {romanceEpisodes.map((episode) => {
              const unlocked = isRomanceEpisodeUnlocked(
                progress.state,
                active.id,
                episode.id,
              );
              const completed = Boolean(record.episodes[episode.id]);
              const practiced = getJourneyLearningProgress(
                learning.state,
                active.id,
                episode.id,
              );
              const chapter = getJourneyChapter(episode.id);
              const displayCompleted = classic ? completed : Boolean(practiced);
              return (
                <button
                  type="button"
                  key={episode.id}
                  data-episode-id={episode.id}
                  className={`rc-episode-button surface${displayCompleted ? " is-complete" : ""}`}
                  aria-label={`${episode.title} をはじめる`}
                  disabled={!unlocked}
                  onClick={() => startEpisode(episode.id)}
                >
                  <span className="rc-episode-number">
                    {displayCompleted ? (
                      <Check size={23} />
                    ) : unlocked ? (
                      episode.number
                    ) : (
                      <LockKeyhole size={22} />
                    )}
                  </span>
                  <span>
                    <strong>{episode.title}</strong>
                    <small>
                      {classic
                        ? episode.objective
                        : `${chapter?.level}. ${chapter?.skillTitle} — ${chapter?.canDo}`}
                    </small>
                    {!classic && practiced && (
                      <small className="rjp-route-record">
                        思い出 {practiced.routes.length} / 2 ・会話練習{" "}
                        {practiced.plays}回
                      </small>
                    )}
                    {!classic && completed && !practiced && (
                      <small className="rjp-route-record">
                        物語の記録あり・新しい練習はこれから
                      </small>
                    )}
                  </span>
                  <span className="rc-episode-status">
                    {displayCompleted
                      ? "もう一度"
                      : unlocked
                        ? "はじめる"
                        : "前の話のあと"}
                    <ArrowRight size={17} />
                  </span>
                </button>
              );
            })}
          </section>
          {!classic && (
            <details className="rjp-classic-link">
              <summary>以前の練習について</summary>
              <p>
                これまでの好感度・完了記録は引き継いでいます。新しい会話練習の記録は、実際に取り組んでから増えます。
              </p>
              <Link href="/romance?view=classic">以前の3問練習を使う</Link>
            </details>
          )}
          {ending?.unlocked && (
            <section className="rc-ending surface">
              <Heart size={27} aria-hidden="true" />
              <h2>{ending.title}</h2>
              <p>{ending.description}</p>
              <p className="rc-small">
                物語はここでひと区切り。会話や毎日の練習は、いつでも続けられます。
              </p>
            </section>
          )}
        </>
      ) : active && episodeId && sessionId && progress.state.profile ? (
        classic ? (
          <RomanceEpisodePlayer
            key={sessionId}
            character={active}
            episodeId={episodeId}
            sessionId={sessionId}
            gender={progress.state.profile.gender}
            state={progress.state}
            status={progress.status}
            message={progress.message}
            onStage={setStage}
            onSave={progress.finishEpisode}
            onBack={() => setStage("character")}
            onRoster={roster}
            onReplay={() => startEpisode(episodeId)}
          />
        ) : (
          <RomanceJourneyPlayer
            key={sessionId}
            character={active}
            episodeId={episodeId}
            sessionId={sessionId}
            gender={progress.state.profile.gender}
            state={progress.state}
            status={progress.status}
            message={progress.message}
            learning={learning}
            onStage={setStage}
            onSave={progress.finishEpisode}
            onBack={() => setStage("character")}
            onRoster={roster}
            onReplay={() => startEpisode(episodeId)}
          />
        )
      ) : null}
      <RomanceSources />
      <dialog
        ref={recovery}
        className="rc-recovery"
        aria-labelledby="rc-recovery-title"
      >
        <h2 id="rc-recovery-title">保存データを置き換えますか</h2>
        <p>
          恋するタイ語の保存データだけを、このタブの記録で置き換えます。本編や単語帳の記録は変わりません。
        </p>
        <div className="rc-actions">
          <Button variant="outline" onClick={() => recovery.current?.close()}>
            戻る
          </Button>
          <Button
            onClick={() => {
              if (progress.replaceSaved()) recovery.current?.close();
            }}
          >
            このコースの記録で置き換える
          </Button>
        </div>
      </dialog>
      <dialog
        ref={learningRecovery}
        className="rc-recovery"
        aria-labelledby="rjp-recovery-title"
      >
        <h2 id="rjp-recovery-title">会話パスポートの保存を置き換えますか</h2>
        <p>
          会話パスポートと新しい思い出の保存だけを、このタブの記録で置き換えます。好感度・以前の完了記録・本編には触れません。
        </p>
        <div className="rc-actions">
          <Button
            variant="outline"
            onClick={() => learningRecovery.current?.close()}
          >
            戻る
          </Button>
          <Button
            onClick={() => {
              if (learning.replaceSaved()) learningRecovery.current?.close();
            }}
          >
            会話パスポートの記録で置き換える
          </Button>
        </div>
      </dialog>
    </section>
  );
}

function RomanceEpisodePlayer({
  character,
  episodeId,
  sessionId,
  gender,
  state,
  status,
  message,
  onStage,
  onSave,
  onBack,
  onRoster,
  onReplay,
}: {
  character: RomanceCharacter;
  episodeId: RomanceEpisodeId;
  sessionId: string;
  gender: RomanceGender;
  state: RomanceState;
  status: ReturnType<typeof useRomance>["status"];
  message: string | null;
  onStage: (stage: Stage) => void;
  onSave: (input: EpisodeInput) => Receipt | null;
  onBack: () => void;
  onRoster: () => void;
  onReplay: () => void;
}) {
  const [questions] = useState(() =>
    getRomanceQuestions(character.id, episodeId),
  );
  const [storyOptions] = useState(() =>
    getRomanceStoryOptions(character.id, episodeId),
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"episode" | "story" | "review" | "result">(
    "episode",
  );
  const [answers, setAnswers] = useState<EpisodeInput["answers"]>([]);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef(false);
  const finishedQuestions = useRef(new Set<string>());
  const heading = useRef<HTMLHeadingElement>(null);
  const episode = getRomanceEpisode(episodeId);
  const question = questions[index];
  const story = storyOptions.find((option) => option.id === storyId);
  const record = getRomanceCharacterProgress(state, character.id);
  const correct = answers.filter((answer) => {
    const source = questions.find((item) => item.id === answer.stepId);
    return source?.answerIds.includes(answer.choiceId);
  }).length;
  useEffect(() => {
    if (phase === "episode") return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [phase]);
  function changePhase(value: typeof phase) {
    setPhase(value);
    onStage(value);
  }
  function commit(answer: EpisodeInput["answers"][number]) {
    if (
      !question ||
      finishedQuestions.current.has(question.id) ||
      question.id !== answer.stepId
    )
      return;
    finishedQuestions.current.add(question.id);
    setAnswers((previous) => [...previous, answer]);
    if (index === questions.length - 1) changePhase("story");
    else setIndex((value) => value + 1);
  }
  function save() {
    if (saved.current || !story || answers.length !== questions.length) return;
    const result = onSave({
      characterId: character.id,
      episodeId,
      sessionId,
      answers,
      storyChoiceId: story.id,
    });
    if (!result) {
      setError(
        "記録できませんでした。画面上のお知らせを確認して、もう一度お試しください。",
      );
      return;
    }
    saved.current = true;
    setReceipt(result);
    setError(null);
    changePhase("result");
  }
  if (!episode || !question)
    return <p role="alert">このエピソードの教材を確認できませんでした。</p>;
  return (
    <div
      className="rc-player"
      data-character-id={character.id}
      data-episode-id={episodeId}
      data-step-id={phase === "episode" ? question.id : undefined}
    >
      <div className="rc-player-top">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={17} />
          {character.name} のエピソードへ
        </Button>
        <span>
          EPISODE {episode.number} · {episode.title}
        </span>
      </div>
      <div className="rc-story-grid">
        <aside className="rc-partner">
          <RomancePortrait
            character={character}
            className="rc-player-portrait"
          />
          <div>
            <h2>
              {character.name}
              <small>{character.age}歳</small>
            </h2>
            <Affinity character={character} value={record.affinity} />
          </div>
        </aside>
        <div className="rc-scene-main">
          {phase === "episode" ? (
            <>
              {index === 0 && (
                <div className="rc-scene-intro">
                  <p className="eyebrow">{episode.title}</p>
                  <p>{character.episodeIntros[episodeId]}</p>
                </div>
              )}
              <RomanceQuestionCard
                key={question.id}
                character={character}
                episodeId={episodeId}
                question={question}
                index={index}
                total={questions.length}
                gender={gender}
                firstTime={!record.episodes[episodeId]}
                onNext={commit}
              />
            </>
          ) : phase === "story" ? (
            <section className="surface rc-story-choice">
              <span className="rc-badge">
                <Heart size={17} />
                物語の選択
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {episode.storyPrompt}
              </h2>
              <p>
                ここからは、物語の行動を選びます。タイ語の正誤とは別の選択です。
              </p>
              <div
                role="radiogroup"
                aria-label="物語の選択"
                className="rc-story-options"
                onKeyDown={moveRadio}
              >
                {storyOptions.map((option, optionIndex) => (
                  <button
                    type="button"
                    role="radio"
                    aria-label={option.label}
                    aria-checked={storyId === option.id}
                    tabIndex={
                      storyId === option.id || (!storyId && optionIndex === 0)
                        ? 0
                        : -1
                    }
                    key={option.id}
                    className={storyId === option.id ? "is-selected" : ""}
                    onClick={() => setStoryId(option.id)}
                  >
                    {option.label}
                    {storyId === option.id && (
                      <Check size={20} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
              {story && (
                <p className="rc-story-reaction" role="status">
                  {story.reaction}
                </p>
              )}
              <Button
                size="lg"
                disabled={!storyId}
                onClick={() => changePhase("review")}
              >
                この選択で振り返る
                <ArrowRight size={18} />
              </Button>
            </section>
          ) : phase === "review" ? (
            <section className="surface rc-review">
              <span className="rc-badge">
                <Check size={17} />
                今日のひと区切り
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {character.name} と、ことばを交わしました。
              </h2>
              <p>{story?.reaction}</p>
              <div className="rc-correct-count">
                <strong>
                  {correct} / {questions.length}
                </strong>
                <span>今回の会話の目標に合う返答</span>
              </div>
              <p className="rc-small">
                まだ記録は反映していません。初めて終える話の返答・行動と、今日の継続ボーナスを、記録時に好感度へ反映します。同じ話のやり直しで、初回分は重ねて加算しません。
              </p>
              {error && <p role="alert">{error}</p>}
              <Button size="lg" onClick={save}>
                今日の会話を記録する
                <Heart size={18} />
              </Button>
            </section>
          ) : receipt ? (
            <section
              className="surface rc-result"
              data-testid="romance-receipt"
            >
              <Heart size={38} aria-hidden="true" />
              <h2 ref={heading} tabIndex={-1}>
                今日の会話を記録しました
              </h2>
              <p className="rc-result-delta">
                {receipt.affinityBefore}
                <ArrowRight size={24} aria-hidden="true" />
                {receipt.affinityAfter}
                <small> / 100</small>
              </p>
              <p>{getRomanceRelationship(receipt.affinityAfter).label}</p>
              <p className="rc-story-reaction">{story?.reaction}</p>
              {story &&
              story.affinityDelta >= 0 &&
              receipt.affinityAfter >= receipt.affinityBefore ? (
                <p>{character.episodeOutros[episodeId]}</p>
              ) : (
                <p>
                  今日はここで、ひと区切り。返答を確かめて、また自分のペースで話しましょう。
                </p>
              )}
              <dl className="rc-receipt">
                <div>
                  <dt>言葉を選ぶ練習</dt>
                  <dd>{signed(receipt.languageDelta)}</dd>
                </div>
                <div>
                  <dt>物語の選択</dt>
                  <dd>{signed(receipt.storyDelta)}</dd>
                </div>
                <div>
                  <dt>初めてのエピソード</dt>
                  <dd>{signed(receipt.firstClearBonus)}</dd>
                </div>
                <div>
                  <dt>今日の継続ボーナス</dt>
                  <dd>{signed(receipt.dailyBonus)}</dd>
                </div>
              </dl>
              <p className="rc-small">
                {receipt.firstClear
                  ? "初回の返答と物語の選択を反映しました。"
                  : "この話の初回分は反映済みです。やり直しの返答や選択で好感度を繰り返し増減しません。"}{" "}
                継続ボーナスは、相手ごとに一日一度です。
              </p>
              <p className="rc-save-message" role="status">
                {status === "loaded" && !message
                  ? "このブラウザに、物語のしおりを保存しました。"
                  : "このタブでは続けられます。保存については画面上のお知らせを確認してください。"}
              </p>
              <div className="rc-actions">
                <Button onClick={onBack}>
                  {character.name} のエピソードへ
                  <ArrowRight size={17} />
                </Button>
                <Button variant="outline" onClick={onReplay}>
                  <RotateCcw size={17} />
                  もう一度練習する
                </Button>
                <Button variant="ghost" onClick={onRoster}>
                  ほかの人と話す
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function RomanceQuestionCard({
  character,
  episodeId,
  question,
  index,
  total,
  gender,
  firstTime,
  onNext,
}: {
  character: RomanceCharacter;
  episodeId: RomanceEpisodeId;
  question: RomanceQuestion;
  index: number;
  total: number;
  gender: RomanceGender;
  firstTime: boolean;
  onNext: (answer: EpisodeInput["answers"][number]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Grade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = useRef<string | null>(null);
  const committed = useRef(false);
  const advanced = useRef(false);
  const npcAudio = useRef<SpeakButtonHandle>(null);
  const replyAudio = useRef<SpeakButtonHandle>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { playEffect } = useSoundEffects();
  const id = useId();
  const chosen = question.choices.find((choice) => choice.id === selectedId);
  const wordIds = new Set([
    ...question.npc.wordIds,
    ...question.choices.flatMap((choice) => choice.phrase.wordIds),
  ]);
  const words = romanceWords.filter((word) => wordIds.has(word.id));
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);
  function stopAudio() {
    npcAudio.current?.stop();
    replyAudio.current?.stop();
  }
  function choose(choiceId: string) {
    if (committed.current) return;
    const choice = question.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    selected.current = choice.id;
    setSelectedId(choice.id);
    replyAudio.current?.play(choice.phrase.thai);
  }
  function confirm() {
    if (committed.current || !selected.current) return;
    try {
      const result = gradeRomanceChoice(
        character.id,
        episodeId,
        question.id,
        selected.current,
      );
      committed.current = true;
      stopAudio();
      setFeedback(result);
      setError(null);
      playEffect(result.correct ? "correct" : "incorrect");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "返答を確認できませんでした。",
      );
    }
  }
  return (
    <section
      className="surface rc-question"
      aria-label="タイ語の会話練習"
      data-step-id={question.id}
    >
      <div className="rc-question-count">
        <MessageCircle size={19} />
        <span>
          会話 {index + 1} / {total}
        </span>
      </div>
      <p className="rc-disclosure">
        教材・訳・用法と端末の合成音声は未監修です。音声の提供元と通信する場合があります。
      </p>
      <div className="rc-npc-bubble">
        <span>{character.name}</span>
        <p className="thai" lang="th">
          {question.npc.thai}
        </p>
        <p>{question.npc.meaning}</p>
        {question.npc.note && <p className="rc-small">{question.npc.note}</p>}
        <SpeakButton
          ref={npcAudio}
          text={question.npc.thai}
          label="相手のことばを聞く"
        />
      </div>
      <h2 id={`${id}-goal`} ref={heading} tabIndex={-1}>
        {question.goal}
      </h2>
      <details className="rc-models" open={firstTime || undefined}>
        <summary>
          <BookOpen size={17} />
          お手本とことばを見る
        </summary>
        <p className="rc-small">
          初めての表現は、お手本を使って練習しましょう。どちらの丁寧な形も目標に合えば正答です。主人公の性別だけで別の正しい表現を誤答にはしません。
        </p>
        {question.choices
          .filter((choice) => question.answerIds.includes(choice.id))
          .map((choice, modelIndex) => (
            <div className="rc-model" key={choice.id}>
              <p className="thai" lang="th">
                {choice.phrase.thai}
              </p>
              <p>{choice.phrase.meaning}</p>
              <SpeakButton
                text={choice.phrase.thai}
                label={`返答例${modelIndex + 1}を聞く`}
              />
            </div>
          ))}
        <p className="rc-small">
          語句ごとの辞書形IPAです。全文の発音表記ではありません。
        </p>
        <ul className="rc-words">
          {words.map((word) => (
            <li key={word.id}>
              <span className="thai" lang="th">
                {word.thai}
              </span>
              <span>{word.meaning}</span>
              <span className="ipa">{word.ipa}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="rc-small">
        返答を選ぶと、対応端末ではそのまま音も聞けます。確定するまでは選び直せます。
      </p>
      <div
        className="rc-replies"
        role="radiogroup"
        aria-labelledby={`${id}-goal`}
        onKeyDown={moveRadio}
      >
        {question.choices.map((choice, choiceIndex) => {
          const recommended =
            choice.phrase.wordIds.includes(
              gender === "male" ? "polite-male" : "polite-female-statement",
            ) ||
            (gender === "female" &&
              choice.phrase.wordIds.includes("polite-female-question"));
          const accepted = Boolean(
            feedback && question.answerIds.includes(choice.id),
          );
          return (
            <button
              type="button"
              role="radio"
              aria-label={choice.phrase.thai}
              aria-checked={choice.id === selectedId}
              key={choice.id}
              disabled={Boolean(feedback)}
              tabIndex={
                choice.id === selectedId || (!selectedId && choiceIndex === 0)
                  ? 0
                  : -1
              }
              className={`${choice.id === selectedId ? "is-selected" : ""}${accepted ? " is-accepted" : ""}`}
              onClick={() => choose(choice.id)}
            >
              <span className="rc-reply-icon" aria-hidden="true">
                {accepted ? <Check size={19} /> : <MessageCircle size={19} />}
              </span>
              <span>
                <span className="thai" lang="th">
                  {choice.phrase.thai}
                </span>
                <small>{choice.phrase.meaning}</small>
                {recommended && <em>この主人公の文末詞の例</em>}
              </span>
            </button>
          );
        })}
      </div>
      <div hidden={!selectedId} className="rc-replay">
        <SpeakButton
          ref={replyAudio}
          text={chosen?.phrase.thai ?? ""}
          label="選んだ返答をもう一度聞く"
        />
      </div>
      {feedback && (
        <div
          className={`rc-feedback ${feedback.correct ? "is-correct" : "is-review"}`}
          role="status"
          data-correct={feedback.correct}
        >
          {feedback.correct ? (
            <CircleCheck size={23} />
          ) : (
            <Lightbulb size={23} />
          )}
          <div>
            <h3>
              {feedback.correct
                ? "伝えたいことに合っています！"
                : "ここで、返し方を確かめよう。"}
            </h3>
            <p>{feedback.choiceExplanation}</p>
            <p>{feedback.explanation}</p>
            {!feedback.correct && (
              <div className="rc-accepted">
                <strong>この目標に合う返答例</strong>
                {question.choices
                  .filter((choice) => question.answerIds.includes(choice.id))
                  .map((choice) => (
                    <p key={choice.id}>
                      <span className="thai" lang="th">
                        {choice.phrase.thai}
                      </span>
                      <span>{choice.phrase.meaning}</span>
                    </p>
                  ))}
              </div>
            )}
            <p className="rc-small">
              これは今回の会話目標への判定です。発音や会話能力を採点していません。
            </p>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="rc-question-actions">
        {feedback ? (
          <Button
            size="lg"
            onClick={() => {
              if (advanced.current || !selected.current) return;
              advanced.current = true;
              stopAudio();
              onNext({ stepId: question.id, choiceId: selected.current });
            }}
          >
            {index === total - 1 ? "物語の選択へ" : "次のやりとりへ"}
            <ArrowRight size={18} />
          </Button>
        ) : (
          <Button size="lg" disabled={!selectedId} onClick={confirm}>
            返答を確認
            <Check size={18} />
          </Button>
        )}
      </div>
      <details className="rc-question-source">
        <summary>この会話の出典と確認状況</summary>
        <p className="rc-small">{question.sourceNote}</p>
        {romanceSources
          .filter((source) => question.sourceIds.includes(source.id))
          .map((source) => (
            <p key={source.id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </p>
          ))}
      </details>
    </section>
  );
}

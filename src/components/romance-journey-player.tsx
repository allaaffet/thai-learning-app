"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  Compass,
  Heart,
  Lightbulb,
  MapPin,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Ticket,
  Undo2,
} from "lucide-react";
import {
  romanceSources,
  romanceWords,
  getRomanceEpisode,
} from "@/data/romance";
import { getJourneyScene, getJourneyChapter } from "@/data/romance-journey";
import {
  getJourneyPlan,
  gradeJourneyActivity,
  getJourneyCoreAnswers,
  getJourneyRecoveryActivities,
  type JourneyActivity,
  type JourneyAttempt,
  type JourneyPlan,
} from "@/lib/romance-journey";
import type {
  JourneyExpression,
  JourneyRouteId,
} from "@/lib/romance-journey-types";
import type {
  RomanceCharacter,
  RomanceEpisodeId,
  RomanceGender,
  RomanceQuestion,
} from "@/lib/romance-types";
import type {
  RomanceEpisodeInput,
  RomanceLoadStatus,
  RomanceReceipt,
  RomanceState,
} from "@/lib/romance";
import { getRomanceRelationship } from "@/lib/romance";
import type { useRomanceLearning } from "@/components/use-romance-learning";
import { RomancePortrait } from "@/components/romance-portrait";
import {
  SpeakButton,
  type SpeakButtonHandle,
} from "@/components/speech-practice";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { Button } from "@/components/ui/button";

type LearningStore = ReturnType<typeof useRomanceLearning>;
type LearningReceipt = NonNullable<ReturnType<LearningStore["finish"]>>;
type Phase =
  | "route"
  | "scene"
  | "activity"
  | "repair"
  | "story"
  | "review"
  | "result";
type GradableActivity = Exclude<JourneyActivity, { kind: "model" }>;
type Grade = ReturnType<typeof gradeJourneyActivity>;
type ModelActivity = Extract<JourneyActivity, { kind: "model" }>;
type BuildActivity = Extract<JourneyActivity, { kind: "build" }>;
type RespondActivity = Extract<JourneyActivity, { kind: "respond" }>;

export interface RomanceJourneyPlayerProps {
  character: RomanceCharacter;
  episodeId: RomanceEpisodeId;
  sessionId: string;
  gender: RomanceGender;
  state: RomanceState;
  status: RomanceLoadStatus;
  message: string | null;
  learning: LearningStore;
  onStage: (stage: "episode" | "story" | "review" | "result") => void;
  onSave: (input: RomanceEpisodeInput) => RomanceReceipt | null;
  onBack: () => void;
  onRoster: () => void;
  onReplay: () => void;
}

function moveRadio(event: KeyboardEvent<HTMLDivElement>) {
  const keys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ];
  if (!keys.includes(event.key)) return;
  const radios = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ),
  ];
  const index = radios.findIndex((radio) => radio === event.target);
  if (index < 0) return;
  event.preventDefault();
  const reverse = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? radios.length - 1
        : (index + (reverse ? -1 : 1) + radios.length) % radios.length;
  radios[next]?.focus();
  radios[next]?.click();
}

const supportNames = {
  model: "お手本と一緒に",
  meaning: "意味を手がかりに",
  recall: "まずは思い出して",
};
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

/** A finite, branching lesson. Only the first core answers affect legacy affinity. */
export function RomanceJourneyPlayer({
  character,
  episodeId,
  sessionId,
  gender,
  state,
  status,
  message,
  learning,
  onStage,
  onSave,
  onBack,
  onRoster,
  onReplay,
}: RomanceJourneyPlayerProps) {
  const [routeId, setRouteId] = useState<JourneyRouteId | null>(null);
  const [plan, setPlan] = useState<JourneyPlan | null>(null);
  const [phase, setPhase] = useState<Phase>("route");
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<JourneyAttempt[]>([]);
  const [repairs, setRepairs] = useState<GradableActivity[]>([]);
  const [repairIndex, setRepairIndex] = useState(0);
  const [expression, setExpression] = useState<JourneyExpression>("thoughtful");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<RomanceReceipt | null>(null);
  const [learningReceipt, setLearningReceipt] =
    useState<LearningReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [learningError, setLearningError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const recorded = useRef(false);
  const advanced = useRef(new Set<string>());
  const attemptsRef = useRef<JourneyAttempt[]>([]);
  const scene = getJourneyScene(character.id, episodeId);
  const chapter = getJourneyChapter(episodeId);
  const episode = getRomanceEpisode(episodeId);
  const activity =
    phase === "repair" ? repairs[repairIndex] : plan?.activities[index];
  const authoredChoices = plan?.route.wrapChoices ?? [];
  const reverseChoices =
    (character.id
      .split("")
      .reduce((sum, letter) => sum + letter.charCodeAt(0), 0) +
      (chapter?.level ?? 0) +
      (routeId === "lead" ? 1 : 0)) %
      2 ===
    1;
  const wrapChoices = reverseChoices
    ? [...authoredChoices].reverse()
    : authoredChoices;
  const story = wrapChoices.find((choice) => choice.storyChoiceId === storyId);
  const currentAffinity = state.characters[character.id]?.affinity ?? 0;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [phase, index, repairIndex]);

  if (!scene || !chapter || !episode)
    return <p role="alert">この物語の教材を確認できませんでした。</p>;

  function changePhase(next: Phase) {
    setPhase(next);
    onStage(
      next === "story" || next === "review" || next === "result"
        ? next
        : "episode",
    );
  }
  function chooseRoute(id: JourneyRouteId) {
    const next = getJourneyPlan(character.id, episodeId, id, gender);
    setRouteId(id);
    setPlan(next);
    setExpression(next.route.expression);
    changePhase("scene");
  }
  function advance(nextAttempt?: JourneyAttempt) {
    if (!plan || !activity || advanced.current.has(activity.id)) return;
    advanced.current.add(activity.id);
    const nextAttempts = nextAttempt
      ? [...attemptsRef.current, nextAttempt]
      : attemptsRef.current;
    attemptsRef.current = nextAttempts;
    setAttempts(nextAttempts);
    setExpression("neutral");
    if (index < plan.activities.length - 1) setIndex(index + 1);
    else {
      const recovery = getJourneyRecoveryActivities(plan, nextAttempts);
      setRepairs(recovery);
      if (recovery.length) {
        setExpression("thoughtful");
        changePhase("repair");
      } else {
        setExpression("happy");
        changePhase("story");
      }
    }
  }
  function advanceRepair() {
    const repair = repairs[repairIndex];
    if (!repair || advanced.current.has(repair.id)) return;
    advanced.current.add(repair.id);
    setExpression("neutral");
    if (repairIndex < repairs.length - 1) setRepairIndex(repairIndex + 1);
    else {
      setExpression("happy");
      changePhase("story");
    }
  }
  function record() {
    if (!plan || !routeId || !story || recorded.current || !learning.ready)
      return;
    try {
      const answers = getJourneyCoreAnswers(plan, attemptsRef.current);
      const result = onSave({
        characterId: character.id,
        episodeId,
        sessionId,
        answers,
        storyChoiceId: story.storyChoiceId,
      });
      if (!result) {
        setError(
          "物語を記録できませんでした。画面のお知らせを確認してください。",
        );
        return;
      }
      recorded.current = true;
      setReceipt(result);
      const trained = learning.finish({
        characterId: character.id,
        episodeId,
        routeId,
        gender,
        sessionId,
        attempts: attemptsRef.current,
      });
      setLearningReceipt(trained);
      setLearningError(!trained);
      setError(null);
      setExpression(
        result.affinityAfter >= result.affinityBefore ? "happy" : "thoughtful",
      );
      changePhase("result");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "練習の記録を確認できませんでした。",
      );
    }
  }

  return (
    <section
      className={`romance-journey rj-theme-${routeId ?? "intro"}`}
      aria-label="会話と物語のレッスン"
      data-journey-stage={phase}
      data-route-id={routeId ?? undefined}
    >
      <div className="rj-topbar">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={17} />
          エピソードへ
        </Button>
        <span>CHAPTER {chapter.level} / 5</span>
      </div>
      <div className="rj-scene-layout">
        <aside className="rj-character-scene" data-expression={expression}>
          <RomancePortrait
            character={character}
            expression={expression}
            className="rj-portrait"
          />
          <div className="rj-character-name">
            <strong>{character.name}</strong>
            <span>{character.age}歳</span>
            <span>
              <Heart size={14} />
              {receipt?.affinityAfter ?? currentAffinity}
            </span>
          </div>
          <div className="rj-location">
            <MapPin size={15} />
            <span>{plan?.route.title ?? "ふたりの新しいページ"}</span>
          </div>
        </aside>
        <div className="rj-dialogue-column">
          <div className="rj-skill-banner">
            <span>
              <Sparkles size={17} />
              今日の会話ミッション
            </span>
            <strong>{chapter.skillTitle}</strong>
            <p>{chapter.canDo}</p>
          </div>

          {phase === "route" ? (
            <section className="rj-panel rj-prologue">
              <p className="rj-kicker">STORY · {episode.title}</p>
              <h2 ref={heading} tabIndex={-1}>
                今日は、どちらへ行こう？
              </h2>
              <p>{scene.intro}</p>
              <div className="rj-route-options">
                {scene.routes.map((route) => (
                  <button
                    type="button"
                    className="rj-route-card"
                    key={route.id}
                    data-route-id={route.id}
                    onClick={() => chooseRoute(route.id)}
                  >
                    <Compass size={24} aria-hidden="true" />
                    <span>
                      <strong>{route.title}</strong>
                      <small>{route.teaser}</small>
                    </span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="rj-note">
                どちらも選べます。行き先によって、練習する順序と集まる思い出が変わります。
              </p>
            </section>
          ) : phase === "scene" && plan ? (
            <section className="rj-panel rj-prologue">
              <p className="rj-kicker">
                <MapPin size={15} />
                {plan.route.title}
              </p>
              <h2 ref={heading} tabIndex={-1}>
                ふたりの、今日のチャレンジ
              </h2>
              <p>{plan.route.scene}</p>
              <div className="rj-challenge">
                <Ticket size={26} />
                <p>{plan.route.challenge}</p>
              </div>
              <p className="rj-note">{chapter.bridge}</p>
              <ol className="rj-learning-path" aria-label="今日の練習の順番">
                {plan.activities
                  .filter((item, step, all) => {
                    const previous = all[step - 1];
                    return (
                      item.kind !== "respond" ||
                      previous?.kind !== "respond" ||
                      item.purpose !== previous.purpose
                    );
                  })
                  .map((item) => (
                    <li key={item.id}>
                      {item.kind === "model" ? (
                        <>
                          <BookOpen size={17} />
                          見つける
                        </>
                      ) : item.kind === "build" ? (
                        <>
                          <MessageCircle size={17} />
                          組み立てる
                        </>
                      ) : item.purpose === "recall" ? (
                        <>
                          <RotateCcw size={17} />
                          思い出す
                        </>
                      ) : (
                        <>
                          <Sparkles size={17} />
                          使ってみる
                        </>
                      )}
                    </li>
                  ))}
              </ol>
              <Button
                size="lg"
                onClick={() => {
                  setExpression("neutral");
                  changePhase("activity");
                }}
              >
                会話をはじめる
                <ArrowRight size={18} />
              </Button>
              <button
                className="rj-text-button"
                type="button"
                onClick={() => {
                  setPlan(null);
                  setRouteId(null);
                  setExpression("thoughtful");
                  changePhase("route");
                }}
              >
                行き先を選び直す
              </button>
            </section>
          ) : (phase === "activity" || phase === "repair") &&
            plan &&
            activity ? (
            <>
              <div className="rj-progress">
                <span>
                  {phase === "repair"
                    ? `確認タイム ${repairIndex + 1} / ${repairs.length}`
                    : `会話のステップ ${index + 1} / ${plan.activities.length}`}
                </span>
                <progress
                  aria-label={
                    phase === "repair"
                      ? "確認タイムの進み具合"
                      : "会話レッスンの進み具合"
                  }
                  max={
                    phase === "repair" ? repairs.length : plan.activities.length
                  }
                  value={phase === "repair" ? repairIndex + 1 : index + 1}
                />
              </div>
              {phase === "repair" && (
                <p className="rj-repair-note">
                  <Lightbulb size={20} />
                  {plan.route.supportBeat}{" "}
                  もう一度だけ一緒に確かめましょう。最初の記録は変わりません。
                </p>
              )}
              {activity.kind === "model" ? (
                <JourneyModelCard
                  key={activity.id}
                  activity={activity}
                  character={character}
                  heading={heading}
                  allowSkip={chapter.level >= 3}
                  onNext={() => advance()}
                />
              ) : activity.kind === "build" ? (
                <JourneyBuildCard
                  key={activity.id}
                  activity={activity}
                  character={character}
                  heading={heading}
                  repair={phase === "repair"}
                  onExpression={setExpression}
                  onNext={phase === "repair" ? advanceRepair : advance}
                />
              ) : (
                <JourneyRespondCard
                  key={activity.id}
                  activity={activity}
                  character={character}
                  heading={heading}
                  repair={phase === "repair"}
                  onExpression={setExpression}
                  onNext={phase === "repair" ? advanceRepair : advance}
                />
              )}
            </>
          ) : phase === "story" && plan ? (
            <section className="rj-panel rj-wrap">
              <p className="rj-kicker">
                <Heart size={17} />
                STORY CHOICE
              </p>
              <h2 ref={heading} tabIndex={-1}>
                この時間を、どう結ぼう？
              </h2>
              <p>{plan.route.successBeat}</p>
              <p className="rj-note">
                ここからは物語の行動。タイ語の正誤とは別の選択です。
              </p>
              <div
                className="rj-wrap-options"
                role="radiogroup"
                aria-label="物語のしめくくり"
                onKeyDown={moveRadio}
              >
                {wrapChoices.map((choice, choiceIndex) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={storyId === choice.storyChoiceId}
                    tabIndex={
                      storyId === choice.storyChoiceId ||
                      (!storyId && choiceIndex === 0)
                        ? 0
                        : -1
                    }
                    key={choice.storyChoiceId}
                    onClick={() => {
                      setStoryId(choice.storyChoiceId);
                      setExpression(choice.expression);
                    }}
                    className={
                      storyId === choice.storyChoiceId ? "is-selected" : ""
                    }
                  >
                    <span>{choice.label}</span>
                    {storyId === choice.storyChoiceId && <Check size={20} />}
                  </button>
                ))}
              </div>
              {story && (
                <p className="rj-story-response" role="status">
                  {story.reaction}
                </p>
              )}
              <Button
                size="lg"
                disabled={!storyId}
                onClick={() => changePhase("review")}
              >
                今日のページを振り返る
                <ArrowRight size={18} />
              </Button>
            </section>
          ) : phase === "review" && plan ? (
            <section className="rj-panel rj-review">
              <p className="rj-kicker">YOUR CONVERSATION NOTE</p>
              <h2 ref={heading} tabIndex={-1}>
                ことばで進んだ、小さな一歩。
              </h2>
              <p>{chapter.canDo}</p>
              <JourneyAttemptSummary plan={plan} attempts={attempts} />
              <div className="rj-keepsake-preview">
                <Ticket size={30} />
                <div>
                  <small>このルートの思い出</small>
                  <strong>{plan.route.keepsake.title}</strong>
                  <p>{plan.route.keepsake.detail}</p>
                </div>
              </div>
              <p className="rj-note">
                組立・想起とヒントの使用は練習の記録です。好感度に使うのは、本番3問の最初の返答と物語の選択。習熟度や発音の点数ではありません。
              </p>
              {error && (
                <p role="alert" className="rj-error">
                  {error}
                </p>
              )}
              <Button size="lg" disabled={!learning.ready} onClick={record}>
                今日の会話を記録する
                <Heart size={18} />
              </Button>
              <p className="rj-note">
                ここで記録すると、物語のしおりと会話のノートを、このブラウザへそれぞれ保存します。
              </p>
            </section>
          ) : phase === "result" && plan && receipt ? (
            <section
              className="rj-panel rj-result"
              data-testid="journey-receipt"
            >
              <CircleCheck
                size={40}
                className="rj-result-check"
                aria-hidden="true"
              />
              <p className="rj-kicker">A NEW PAGE TOGETHER</p>
              <h2 ref={heading} tabIndex={-1}>
                今日の会話を記録しました
              </h2>
              <div className="rj-keepsake-earned">
                <Ticket size={34} />
                <div>
                  <small>
                    {learningReceipt?.newKeepsake
                      ? "新しい思い出"
                      : "ふたりの思い出"}
                  </small>
                  <strong>{plan.route.keepsake.title}</strong>
                  <p>{plan.route.keepsake.detail}</p>
                </div>
              </div>
              <p>{story?.reaction}</p>
              <div className="rj-next-hook">
                <Sparkles size={20} />
                <p>{plan.route.nextHook}</p>
              </div>
              <JourneyAttemptSummary plan={plan} attempts={attempts} />
              <details className="rj-affinity-details">
                <summary>
                  <Heart size={17} />
                  物語の好感度 {receipt.affinityBefore} →{" "}
                  {receipt.affinityAfter} / 100
                </summary>
                <p>{getRomanceRelationship(receipt.affinityAfter).label}</p>
                <dl>
                  <div>
                    <dt>本番の初回返答</dt>
                    <dd>{signed(receipt.languageDelta)}</dd>
                  </div>
                  <div>
                    <dt>物語の選択</dt>
                    <dd>{signed(receipt.storyDelta)}</dd>
                  </div>
                  <div>
                    <dt>話の初回終了</dt>
                    <dd>{signed(receipt.firstClearBonus)}</dd>
                  </div>
                  <div>
                    <dt>今日の継続</dt>
                    <dd>{signed(receipt.dailyBonus)}</dd>
                  </div>
                </dl>
                <p className="rj-note">
                  同じ話のやり直しで初回分は繰り返し増減しません。休んだ日だけで好感度が下がることもありません。
                </p>
              </details>
              <div className="rj-save-status" role="status">
                <p>
                  {status === "loaded" && !message
                    ? "物語のしおり：このブラウザに保存しました。"
                    : "物語のしおり：このタブでは続けられます。保存のお知らせを確認してください。"}
                </p>
                <p>
                  {learningError
                    ? "会話のノートを記録できませんでした。物語のしおりとは別の保存です。"
                    : learning.status === "loaded" && !learning.message
                      ? "会話のノート：このブラウザに保存しました。"
                      : "会話のノート：このタブの記録です。保存のお知らせを確認してください。"}
                </p>
              </div>
              <div className="rj-actions">
                <Button onClick={onBack}>
                  次のページへ
                  <ArrowRight size={18} />
                </Button>
                <Button variant="outline" onClick={onReplay}>
                  <RotateCcw size={17} />
                  別のルートも試す
                </Button>
                <Button variant="ghost" onClick={onRoster}>
                  ほかの人に会いにいく
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function JourneyAttemptSummary({
  plan,
  attempts,
}: {
  plan: JourneyPlan;
  attempts: JourneyAttempt[];
}) {
  const graded = plan.activities
    .filter(
      (activity): activity is GradableActivity => activity.kind !== "model",
    )
    .map((activity) => {
      const attempt = attempts.find((item) => item.activityId === activity.id);
      return {
        activity,
        attempt,
        correct: attempt
          ? gradeJourneyActivity(activity, attempt.response).correct
          : false,
      };
    });
  const core = graded.filter(
    (item) =>
      item.activity.kind === "respond" && item.activity.purpose === "core",
  );
  const build = graded.filter((item) => item.activity.kind === "build");
  const recall = graded.filter(
    (item) =>
      item.activity.kind === "respond" && item.activity.purpose === "recall",
  );
  return (
    <div className="rj-summary">
      <div>
        <MessageCircle size={21} />
        <strong>
          {core.filter((item) => item.correct).length}
          <small> / {core.length}</small>
        </strong>
        <span>本番の初回返答</span>
      </div>
      <div>
        <BookOpen size={21} />
        <strong>
          {build.filter((item) => item.correct).length}
          <small> / {build.length}</small>
        </strong>
        <span>ことばの組立</span>
      </div>
      <div>
        <RotateCcw size={21} />
        <strong>
          {recall.filter((item) => item.correct).length}
          <small> / {recall.length}</small>
        </strong>
        <span>{recall.length ? "前の会話を想起" : "想起は次の話から"}</span>
      </div>
    </div>
  );
}

function JourneySource({ question }: { question: RomanceQuestion }) {
  return (
    <details className="rj-source">
      <summary>ことば・出典・確認状況</summary>
      <p>{question.sourceNote}</p>
      <p>語句ごとの辞書形IPAです。全文の発音表記ではありません。</p>
      <ul>
        {romanceWords
          .filter((word) =>
            new Set([
              ...question.npc.wordIds,
              ...question.choices.flatMap((choice) => choice.phrase.wordIds),
            ]).has(word.id),
          )
          .map((word) => (
            <li key={word.id}>
              <span className="thai" lang="th">
                {word.thai}
              </span>
              <span>{word.meaning}</span>
              <span className="ipa">{word.ipa}</span>
            </li>
          ))}
      </ul>
      {romanceSources
        .filter((source) => question.sourceIds.includes(source.id))
        .map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.title}
          </a>
        ))}
    </details>
  );
}

function JourneyDisclosure() {
  return (
    <p className="rj-disclosure">
      教材・訳・端末の合成音声は未監修です。音声の提供元と通信する場合があります。
    </p>
  );
}

function JourneyModelCard({
  activity,
  character,
  heading,
  allowSkip,
  onNext,
}: {
  activity: ModelActivity;
  character: RomanceCharacter;
  heading: React.RefObject<HTMLHeadingElement | null>;
  allowSkip: boolean;
  onNext: () => void;
}) {
  const [index, setIndex] = useState(0);
  const moved = useRef(new Set<number>());
  const finished = useRef(false);
  const question = activity.models[index];
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [index, heading]);
  if (!question) return <p role="alert">お手本を確認できませんでした。</p>;
  function next() {
    if (finished.current || moved.current.has(index)) return;
    moved.current.add(index);
    if (index < activity.models.length - 1) setIndex(index + 1);
    else {
      finished.current = true;
      onNext();
    }
  }
  return (
    <section
      className="rj-panel rj-model-card"
      data-activity-kind="model"
      data-activity-id={activity.id}
    >
      <p className="rj-kicker">
        <BookOpen size={17} />
        ことばを見つける {index + 1} / {activity.models.length}
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {question.goal}
      </h2>
      <JourneyDisclosure />
      <div className="rj-chat-bubble">
        <span>{character.name}</span>
        <p className="thai" lang="th">
          {question.npc.thai}
        </p>
        <p>{question.npc.meaning}</p>
        <SpeakButton text={question.npc.thai} label="相手のことばを聞く" />
      </div>
      <div className="rj-model-replies">
        <span className="rj-role-label">あなたの返答例</span>
        {question.choices
          .filter((choice) => question.answerIds.includes(choice.id))
          .map((choice, modelIndex) => (
            <div className="rj-model-reply" key={choice.id}>
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
      </div>
      <p className="rj-note">
        どちらの丁寧な形も、今回の目標に合えば使えます。
      </p>
      <p className="rj-model-rule">{question.explanation}</p>
      <Button size="lg" onClick={next}>
        {index < activity.models.length - 1
          ? "次のお手本へ"
          : "このことばを使ってみる"}
        <ArrowRight size={18} />
      </Button>
      {allowSkip && (
        <button
          className="rj-text-button"
          type="button"
          onClick={() => {
            if (finished.current) return;
            finished.current = true;
            onNext();
          }}
        >
          お手本を見ずに、まず挑戦する
        </button>
      )}
      <JourneySource question={question} />
    </section>
  );
}

interface ActivityCardProps<T extends GradableActivity> {
  activity: T;
  character: RomanceCharacter;
  heading: React.RefObject<HTMLHeadingElement | null>;
  repair: boolean;
  onExpression: (expression: JourneyExpression) => void;
  onNext: (attempt: JourneyAttempt) => void;
}

function JourneyBuildCard({
  activity,
  character,
  heading,
  repair,
  onExpression,
  onNext,
}: ActivityCardProps<BuildActivity>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hint, setHint] = useState(repair);
  const [feedback, setFeedback] = useState<Grade | null>(null);
  const words = useRef<string[]>([]);
  const hinted = useRef(repair);
  const confirmed = useRef(false);
  const advanced = useRef(false);
  const tokenAudio = useRef<SpeakButtonHandle>(null);
  const { playEffect } = useSoundEffects();
  const question = activity.question;
  const models = question.choices.filter((choice) =>
    question.answerIds.includes(choice.id),
  );
  function select(wordId: string) {
    if (confirmed.current) return;
    const word = activity.bank.find((item) => item.id === wordId);
    if (
      !word ||
      words.current.filter((id) => id === wordId).length >=
        activity.bank.filter((item) => item.id === wordId).length
    )
      return;
    words.current = [...words.current, wordId];
    setSelected(words.current);
    tokenAudio.current?.play(word.thai);
  }
  function confirm() {
    if (confirmed.current || !words.current.length) return;
    confirmed.current = true;
    const grade = gradeJourneyActivity(activity, {
      kind: "build",
      wordIds: [...words.current],
    });
    tokenAudio.current?.stop();
    setFeedback(grade);
    onExpression(grade.correct ? "happy" : "concerned");
    playEffect(grade.correct ? "correct" : "incorrect");
  }
  return (
    <section
      className="rj-panel rj-build-card"
      data-activity-kind="build"
      data-activity-id={activity.id}
    >
      <p className="rj-kicker">
        <BookOpen size={17} />
        ことばを組み立てる
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {question.goal}
      </h2>
      <JourneyDisclosure />
      <div className="rj-chat-bubble">
        <span>{character.name}</span>
        <p className="thai" lang="th">
          {question.npc.thai}
        </p>
        <p>{question.npc.meaning}</p>
        <SpeakButton text={question.npc.thai} label="相手のことばを聞く" />
      </div>
      <p className="rj-note">
        語句を押すと音を確認できます。伝えたい順に並べ、最後に確かめましょう。
      </p>
      <div className="rj-token-answer" aria-label="組み立てた返答">
        <span className="rj-role-label">あなたの返答</span>
        {selected.length ? (
          <div>
            {selected.map((wordId, wordIndex) => {
              const word = activity.bank.find((item) => item.id === wordId);
              return (
                <button
                  type="button"
                  key={`${wordId}-${wordIndex}`}
                  disabled={Boolean(feedback)}
                  aria-label={`${word?.thai ?? wordId} を返答から戻す`}
                  onClick={() => {
                    if (confirmed.current) return;
                    words.current = words.current.filter(
                      (_, index) => index !== wordIndex,
                    );
                    setSelected(words.current);
                  }}
                >
                  <span className="thai" lang="th">
                    {word?.thai}
                  </span>
                  <Undo2 size={14} />
                </button>
              );
            })}
          </div>
        ) : (
          <p>下のことばを、ここに並べよう。</p>
        )}
      </div>
      <div className="rj-token-bank" aria-label="使えることば">
        {activity.bank.map((word, wordIndex) => (
          <button
            type="button"
            key={`${word.id}-${wordIndex}`}
            data-word-id={word.id}
            disabled={
              Boolean(feedback) ||
              selected.filter((id) => id === word.id).length >=
                activity.bank.filter((item) => item.id === word.id).length
            }
            onClick={() => select(word.id)}
          >
            <span className="thai" lang="th">
              {word.thai}
            </span>
            <small>{word.meaning}</small>
          </button>
        ))}
      </div>
      <div hidden>
        <SpeakButton ref={tokenAudio} text="" label="選んだ語句の音声" />
      </div>
      {!feedback && (
        <div className="rj-inline-actions">
          <button
            className="rj-text-button"
            type="button"
            disabled={!selected.length}
            onClick={() => {
              if (confirmed.current) return;
              words.current = [];
              setSelected([]);
              tokenAudio.current?.stop();
            }}
          >
            <Undo2 size={15} />
            並べ直す
          </button>
          <button
            className="rj-text-button"
            type="button"
            aria-expanded={hint}
            onClick={() => {
              hinted.current = true;
              setHint(true);
            }}
          >
            <Lightbulb size={16} />
            お手本のヒント
          </button>
        </div>
      )}
      {hint && !feedback && (
        <div className="rj-hint">
          {models.map((choice) => (
            <p key={choice.id}>
              <span className="thai" lang="th">
                {choice.phrase.thai}
              </span>
              <span>{choice.phrase.meaning}</span>
            </p>
          ))}
        </div>
      )}
      {feedback && (
        <JourneyFeedback
          character={character}
          activity={activity}
          feedback={feedback}
        />
      )}
      <Button
        size="lg"
        disabled={!feedback && !selected.length}
        onClick={
          feedback
            ? () => {
                if (advanced.current) return;
                advanced.current = true;
                tokenAudio.current?.stop();
                onNext({
                  activityId: activity.id,
                  response: { kind: "build", wordIds: [...words.current] },
                  usedHint: hinted.current,
                });
              }
            : confirm
        }
      >
        {feedback ? "次のステップへ" : "組み立てた返答を確認"}
        {feedback ? <ArrowRight size={18} /> : <Check size={18} />}
      </Button>
      <JourneySource question={question} />
    </section>
  );
}

function JourneyRespondCard({
  activity,
  character,
  heading,
  repair,
  onExpression,
  onNext,
}: ActivityCardProps<RespondActivity>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hint, setHint] = useState(repair);
  const [feedback, setFeedback] = useState<Grade | null>(null);
  const selected = useRef<string | null>(null);
  const hinted = useRef(repair);
  const confirmed = useRef(false);
  const advanced = useRef(false);
  const npcAudio = useRef<SpeakButtonHandle>(null);
  const replyAudio = useRef<SpeakButtonHandle>(null);
  const { playEffect } = useSoundEffects();
  const question = activity.question;
  const models = question.choices.filter((choice) =>
    question.answerIds.includes(choice.id),
  );
  const showNpcMeaning =
    activity.support !== "recall" || hint || Boolean(feedback);
  const showChoiceMeaning =
    activity.support === "model" || hint || Boolean(feedback);
  const showModels = activity.support === "model" || hint;
  const sourceEpisode = getRomanceEpisode(activity.sourceEpisodeId);
  const choices = [...question.choices];
  // A stable rotation changes position without changing accepted answers or language.
  const rotation =
    [...activity.id].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ) % choices.length;
  const orderedChoices = [
    ...choices.slice(rotation),
    ...choices.slice(0, rotation),
  ];
  function choose(choiceId: string) {
    if (confirmed.current) return;
    const choice = choices.find((item) => item.id === choiceId);
    if (!choice) return;
    selected.current = choice.id;
    setSelectedId(choice.id);
    replyAudio.current?.play(choice.phrase.thai);
  }
  function stop() {
    npcAudio.current?.stop();
    replyAudio.current?.stop();
  }
  function confirm() {
    if (confirmed.current || !selected.current) return;
    confirmed.current = true;
    const grade = gradeJourneyActivity(activity, {
      kind: "choice",
      choiceId: selected.current,
    });
    stop();
    setFeedback(grade);
    onExpression(grade.correct ? "happy" : "concerned");
    playEffect(grade.correct ? "correct" : "incorrect");
  }
  return (
    <section
      className="rj-panel rj-respond-card"
      data-activity-kind="respond"
      data-activity-purpose={activity.purpose}
      data-activity-id={activity.id}
      data-step-id={question.id}
      data-support={activity.support}
    >
      <p className="rj-kicker">
        {activity.purpose === "recall" ? (
          <RotateCcw size={17} />
        ) : (
          <MessageCircle size={17} />
        )}
        {activity.purpose === "recall"
          ? `前の会話を思い出す · ${sourceEpisode?.title ?? "前の話"}`
          : activity.purpose === "repair"
            ? "もう一度、一緒に"
            : "会話の本番"}
        <span className="rj-support-label">
          {supportNames[activity.support]}
        </span>
      </p>
      <h2 ref={heading} tabIndex={-1}>
        {question.goal}
      </h2>
      <JourneyDisclosure />
      <div className="rj-chat-bubble">
        <span>{character.name}</span>
        <p className="thai" lang="th">
          {question.npc.thai}
        </p>
        {showNpcMeaning && <p>{question.npc.meaning}</p>}
        <SpeakButton
          ref={npcAudio}
          text={question.npc.thai}
          label="相手のことばを聞く"
        />
      </div>
      {showModels && (
        <div className="rj-hint">
          <span className="rj-role-label">使える返答のお手本</span>
          {models.map((choice) => (
            <p key={choice.id}>
              <span className="thai" lang="th">
                {choice.phrase.thai}
              </span>
              <span>{choice.phrase.meaning}</span>
            </p>
          ))}
        </div>
      )}
      <p className="rj-note">
        返答を選ぶと、そのまま音も聞けます。確定するまでは選び直せます。
      </p>
      <div
        role="radiogroup"
        className="rj-replies"
        aria-label="タイ語の返答"
        onKeyDown={moveRadio}
      >
        {orderedChoices.map((choice, choiceIndex) => (
          <button
            type="button"
            role="radio"
            aria-label={choice.phrase.thai}
            aria-checked={selectedId === choice.id}
            tabIndex={
              selectedId === choice.id || (!selectedId && choiceIndex === 0)
                ? 0
                : -1
            }
            disabled={Boolean(feedback)}
            className={`${selectedId === choice.id ? "is-selected" : ""}${feedback && question.answerIds.includes(choice.id) ? " is-accepted" : ""}`}
            key={choice.id}
            onClick={() => choose(choice.id)}
          >
            <span className="rj-reply-number" aria-hidden="true">
              {feedback && question.answerIds.includes(choice.id) ? (
                <Check size={18} />
              ) : (
                choiceIndex + 1
              )}
            </span>
            <span>
              <span className="thai" lang="th">
                {choice.phrase.thai}
              </span>
              {showChoiceMeaning && <small>{choice.phrase.meaning}</small>}
            </span>
          </button>
        ))}
      </div>
      <div hidden={!selectedId} className="rj-replay">
        <SpeakButton
          ref={replyAudio}
          text={
            choices.find((choice) => choice.id === selectedId)?.phrase.thai ??
            ""
          }
          label="選んだ返答をもう一度聞く"
        />
      </div>
      {!feedback && !showModels && (
        <button
          type="button"
          className="rj-text-button"
          aria-expanded={hint}
          onClick={() => {
            hinted.current = true;
            setHint(true);
          }}
        >
          <Lightbulb size={16} />
          日本語とお手本のヒントを見る
        </button>
      )}
      {feedback && (
        <JourneyFeedback
          character={character}
          activity={activity}
          feedback={feedback}
        />
      )}
      <Button
        size="lg"
        disabled={!feedback && !selectedId}
        onClick={
          feedback
            ? () => {
                if (advanced.current || !selected.current) return;
                advanced.current = true;
                stop();
                onNext({
                  activityId: activity.id,
                  response: { kind: "choice", choiceId: selected.current },
                  usedHint: hinted.current,
                });
              }
            : confirm
        }
      >
        {feedback ? "次のステップへ" : "返答を確認"}
        {feedback ? <ArrowRight size={18} /> : <Check size={18} />}
      </Button>
      <JourneySource question={question} />
    </section>
  );
}

function JourneyFeedback({
  character,
  activity,
  feedback,
}: {
  character: RomanceCharacter;
  activity: GradableActivity;
  feedback: Grade;
}) {
  const response = useRef<HTMLDivElement>(null);
  useEffect(() => {
    response.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);
  const question = activity.question;
  return (
    <div
      ref={response}
      className={`rj-feedback ${feedback.correct ? "is-correct" : "is-review"}`}
      role="status"
      data-correct={feedback.correct}
    >
      <RomancePortrait
        character={character}
        expression={feedback.correct ? "happy" : "concerned"}
        className="rj-feedback-portrait"
      />
      <div className="rj-feedback-copy">
        <h3>
          {feedback.correct ? (
            <CircleCheck size={22} aria-hidden="true" />
          ) : (
            <Lightbulb size={22} aria-hidden="true" />
          )}
          {feedback.correct
            ? "気持ちが、ことばでつながった。"
            : "大丈夫。一緒に言い方を見つけよう。"}
        </h3>
        <p>{feedback.choiceExplanation}</p>
        <p>{feedback.explanation}</p>
        {!feedback.correct && (
          <div className="rj-accepted">
            <strong>この場面で伝えたい返答</strong>
            {question.choices
              .filter((choice) => question.answerIds.includes(choice.id))
              .map((choice, index) => (
                <div key={choice.id}>
                  <p className="thai" lang="th">
                    {choice.phrase.thai}
                  </p>
                  <p>{choice.phrase.meaning}</p>
                  <SpeakButton
                    text={choice.phrase.thai}
                    label={`確認する返答例${index + 1}を聞く`}
                  />
                </div>
              ))}
          </div>
        )}
        <p className="rj-note">
          この場面の目標への判定です。発音や会話能力の点数ではありません。
        </p>
      </div>
    </div>
  );
}

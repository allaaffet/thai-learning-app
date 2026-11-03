"use client";

import { useRef, useState } from "react";
import { BookOpen, Check, CircleCheck, Lightbulb, Undo2 } from "lucide-react";
import { conversationSources } from "@/data/conversations";
import { languageSources } from "@/data/language";
import {
  gradeCourseWordBuilder,
  type CourseWordBuilder,
} from "@/lib/course-word-builder";
import {
  SpeakButton,
  type SpeakButtonHandle,
} from "@/components/speech-practice";
import { useSoundEffects } from "@/components/sound-effects-provider";
import { Button } from "@/components/ui/button";

export function CourseWordBuilderCard({
  builder,
  onComplete,
}: {
  builder: CourseWordBuilder;
  onComplete: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState<ReturnType<
    typeof gradeCourseWordBuilder
  > | null>(null);
  const selection = useRef<string[]>([]);
  const confirmed = useRef(false);
  const tokenAudio = useRef<SpeakButtonHandle>(null);
  const npcAudio = useRef<SpeakButtonHandle>(null);
  const { playEffect } = useSoundEffects();
  const accepted = builder.step.choices.filter((choice) =>
    builder.step.answerIds.includes(choice.id),
  );
  function choose(wordId: string) {
    if (confirmed.current) return;
    const word = builder.bank.find((entry) => entry.id === wordId);
    if (
      !word ||
      selection.current.filter((id) => id === wordId).length >=
        builder.bank.filter((entry) => entry.id === wordId).length
    )
      return;
    selection.current = [...selection.current, wordId];
    setSelected(selection.current);
    tokenAudio.current?.play(word.thai);
  }
  function confirm() {
    if (confirmed.current || !selection.current.length) return;
    confirmed.current = true;
    npcAudio.current?.stop();
    tokenAudio.current?.stop();
    const grade = gradeCourseWordBuilder(builder, selection.current);
    setFeedback(grade);
    playEffect(grade.correct ? "correct" : "incorrect");
    onComplete(grade.correct);
  }
  return (
    <section
      className="surface course-word-builder"
      data-testid="course-word-builder"
      data-step-id={builder.step.id}
      aria-label="会話の語句を組み立てる"
    >
      <p className="cwb-context">{builder.unit.context}</p>
      <div className="cwb-situation">
        <span className="cwb-label">相手のことば</span>
        <p className="thai" lang="th">
          {builder.step.npc.thai}
        </p>
        <p>{builder.step.npc.meaning}</p>
        <SpeakButton
          ref={npcAudio}
          text={builder.step.npc.thai}
          label="相手のことばを聞く"
        />
      </div>
      <p className="cwb-note">
        ことばを押すと音を聞けます。伝えたい順に並べましょう。文字は登録済みの語句のまとまりで扱います。
      </p>
      <div className="cwb-answer" aria-label="組み立てた返答">
        <span className="cwb-label">あなたの返答</span>
        {selected.length ? (
          <div>
            {selected.map((id, index) => {
              const word = builder.bank.find((entry) => entry.id === id);
              return (
                <button
                  type="button"
                  key={`${id}-${index}`}
                  disabled={Boolean(feedback)}
                  aria-label={`${word?.thai ?? id} を返答から戻す`}
                  onClick={() => {
                    if (confirmed.current) return;
                    selection.current = selection.current.filter(
                      (_, at) => at !== index,
                    );
                    setSelected(selection.current);
                    tokenAudio.current?.stop();
                  }}
                >
                  <span className="thai" lang="th">
                    {word?.thai}
                  </span>
                  <Undo2 size={14} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <p>下のことばを、ここに並べよう。</p>
        )}
      </div>
      <div className="cwb-bank" aria-label="使えることば">
        {builder.bank.map((word, index) => (
          <button
            type="button"
            key={`${word.id}-${index}`}
            data-word-id={word.id}
            disabled={
              Boolean(feedback) ||
              selected.filter((id) => id === word.id).length >=
                builder.bank.filter((entry) => entry.id === word.id).length
            }
            onClick={() => choose(word.id)}
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
        <>
          <div className="cwb-tools">
            <Button
              variant="ghost"
              disabled={!selected.length}
              onClick={() => {
                if (confirmed.current) return;
                selection.current = [];
                setSelected([]);
                tokenAudio.current?.stop();
              }}
            >
              <Undo2 size={16} aria-hidden="true" />
              並べ直す
            </Button>
            <Button
              variant="ghost"
              aria-expanded={hint}
              onClick={() => setHint((open) => !open)}
            >
              <Lightbulb size={16} aria-hidden="true" />
              お手本のヒント
            </Button>
          </div>
          {hint && (
            <div className="cwb-hint">
              <strong>この場面の返答例</strong>
              {accepted.map((choice) => (
                <p key={choice.id}>
                  <span className="thai" lang="th">
                    {choice.phrase.thai}
                  </span>
                  <span>{choice.phrase.meaning}</span>
                </p>
              ))}
              <p>どちらの丁寧な形も、今回の目標に合えば正答です。</p>
            </div>
          )}
          <Button size="lg" disabled={!selected.length} onClick={confirm}>
            <Check size={18} aria-hidden="true" />
            組み立てた返答を確認
          </Button>
        </>
      )}
      {feedback && (
        <div
          className={`cwb-feedback ${feedback.correct ? "is-correct" : "is-review"}`}
          role="status"
          data-correct={feedback.correct}
        >
          {feedback.correct ? (
            <CircleCheck size={24} aria-hidden="true" />
          ) : (
            <Lightbulb size={24} aria-hidden="true" />
          )}
          <div>
            <h2>
              {feedback.correct
                ? "ことばが、つながった！"
                : "ここで、言い方を確かめよう。"}
            </h2>
            <p>{feedback.explanation}</p>
            {!feedback.correct && (
              <div className="cwb-correct-models">
                <strong>この目標に合う返答例</strong>
                {accepted.map((choice, index) => (
                  <div key={choice.id}>
                    <p className="thai" lang="th">
                      {choice.phrase.thai}
                    </p>
                    <p>{choice.phrase.meaning}</p>
                    <SpeakButton
                      text={choice.phrase.thai}
                      label={`返答例${index + 1}を聞く`}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="cwb-note">
              この組立は気軽な練習です。確認5問の成績やXPは変わりません。次のカードへ進めます。
            </p>
          </div>
        </div>
      )}
      <details className="cwb-sources">
        <summary>
          <BookOpen size={16} aria-hidden="true" />
          語句・出典と確認状況
        </summary>
        <p>
          会話・訳・用法は教材案で専門家監修前です。音声は端末の合成音声で、発音の採点ではありません。語句ごとの辞書形IPAです。全文IPAではありません。
        </p>
        <ul>
          {[
            ...new Map(builder.bank.map((word) => [word.id, word])).values(),
          ].map((word) => (
            <li key={word.id}>
              <span className="thai" lang="th">
                {word.thai}
              </span>
              <span>{word.meaning}</span>
              <span className="ipa">{word.ipa}</span>
            </li>
          ))}
        </ul>
        {[...conversationSources, ...languageSources]
          .filter((source) => builder.scenario.sourceIds.includes(source.id))
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

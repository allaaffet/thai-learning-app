import Link from "next/link";
import { ArrowRight, MessagesSquare } from "lucide-react";
import {
  getCourseConversation,
  getCourseConversationSteps,
  getCourseConversationScenario,
} from "@/data/course-conversations";
import { conversationSources } from "@/data/conversations";
import { languageSources } from "@/data/language";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/speech-practice";

/** The textbook keeps its original assessment and exposes the parallel talk goal. */
export function CourseConversationPreview({ lessonId }: { lessonId: string }) {
  const unit = getCourseConversation(lessonId);
  if (!unit) return null;
  const scenario = getCourseConversationScenario(unit);
  const sources = [...conversationSources, ...languageSources].filter(
    (source) => scenario?.sourceIds.includes(source.id),
  );
  return (
    <section
      className="surface course-talk-preview"
      aria-label="このレッスンの会話"
    >
      <p className="eyebrow">
        <MessagesSquare size={18} aria-hidden="true" /> この課で使う会話
      </p>
      <h2>{unit.title}</h2>
      <p>{unit.objective}</p>
      <p className="course-talk-context">{unit.context}</p>
      <details>
        <summary>今回使う表現を見る</summary>
        <p className="mission-disclosure">
          会話・訳は専門家監修前です。音声は端末の合成音声（未監修）で、提供元と通信する場合があります。
        </p>
        {getCourseConversationSteps(unit).map((step) => (
          <div className="course-talk-model" key={step.id}>
            <p>{step.goal}</p>
            <div>
              <p className="mission-footnote">相手</p>
              <p className="thai" lang="th">
                {step.npc.thai}
              </p>
              <p>{step.npc.meaning}</p>
              {step.npc.note && (
                <p className="mission-footnote">{step.npc.note}</p>
              )}
              <SpeakButton text={step.npc.thai} label="相手の表現を聞く" />
            </div>
            {step.choices
              .filter((choice) => step.answerIds.includes(choice.id))
              .map((choice) => (
                <div key={choice.id}>
                  <p className="thai" lang="th">
                    {choice.phrase.thai}
                  </p>
                  <p>{choice.phrase.meaning}</p>
                  <SpeakButton
                    text={choice.phrase.thai}
                    label="この表現を聞く"
                  />
                </div>
              ))}
          </div>
        ))}
      </details>
      <details>
        <summary>会話表現の出典と確認状況</summary>
        <p className="mission-disclosure">
          語ごとのIPAの限定照合と、会話全体の自然さの監修は別です。会話・訳・用法は専門家監修前です。
        </p>
        {sources.map((source) => (
          <div className="course-talk-model" key={source.id}>
            <a
              className="text-link"
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.title}
            </a>
            <p className="mission-footnote">{source.scope}</p>
          </div>
        ))}
      </details>
      <Button asChild>
        <Link href={`/play/${lessonId}`}>
          会話からこの課をはじめる
          <ArrowRight size={17} />
        </Link>
      </Button>
      <p className="mission-footnote">
        会話はひとまとまりの表現から。文字・音のしくみも、この課で少しずつ確かめます。
      </p>
    </section>
  );
}

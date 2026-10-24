import { BookOpen, ChevronDown, Info } from "lucide-react";
import type { ExampleSentence, LearningBlock } from "@/lib/content-types";
import { grammarPoints } from "@/data/language";
import { lookupSyllable } from "@/data/syllables";
import { isThaiSpeechText } from "@/lib/device-speech";
import { SpeakButton } from "@/components/speech-practice";
import { ToneContour, toneDescriptions } from "@/components/tone-contour";

/**
 * 既存教材で明示されている分解・役割だけを図にする。
 * 未登録の綴りやIPAから、音節・声調・文法の役割を推測しない。
 */
export function ExampleVisual({ example }: { example: ExampleSentence }) {
  const candidate = lookupSyllable(example.thai);
  const syllable = candidate?.ipa === example.ipa ? candidate : undefined;
  const sentence = grammarPoints
    .flatMap((point) => point.examples)
    .find((item) => item.thai === example.thai && item.ipa === example.ipa);

  if (sentence) {
    return (
      <div className="lesson-sentence-visual" aria-label="例文の役割">
        <div className="lesson-role-flow">
          {sentence.segments.map((segment, index) => (
            <div className="lesson-role-chip" key={`${segment.thai}-${index}`}>
              <span className="thai" lang="th">
                {segment.thai}
              </span>
              <span>{segment.role}</span>
            </div>
          ))}
        </div>
        <p>役割を見やすく区切った図です。本文の綴りは上で確認できます。</p>
      </div>
    );
  }

  if (!syllable) return null;

  return (
    <div className="lesson-syllable-visual">
      <div className="lesson-tone-preview">
        <ToneContour tone={syllable.expectedTone} compact />
        <span>{toneDescriptions[syllable.expectedTone].label}</span>
      </div>
      <div
        className="lesson-spelling-flow"
        aria-label="教材に記載された綴りの構成要素"
      >
        <div>
          <span className="thai" lang="th">
            {syllable.onset}
          </span>
          <span>音節初頭の綴り</span>
        </div>
        <div>
          <span className="thai" lang="th">
            {syllable.vowel}
          </span>
          <span>母音の形</span>
        </div>
        {syllable.coda && (
          <>
            <div>
              <span className="thai" lang="th">
                {syllable.coda}
              </span>
              <span>末子音字</span>
            </div>
          </>
        )}
      </div>
      <p>構成要素の図です。「-」は子音の位置、線は声調の概略です。</p>
    </div>
  );
}

/** 補足を閉じても、注意・制限・誤解しやすい対比は目に入るようにする。 */
function visibleCautions(paragraphs: readonly string[]) {
  const caution =
    /ただし|ではありません|とは限|注意|例外|未|辞書|自由に|限ら|混同|勝手|推測|保証|できません|必要はありません/;
  return paragraphs.flatMap((paragraph) =>
    (paragraph.match(/[^。]+。?/gu) ?? [paragraph]).filter((sentence) =>
      caution.test(sentence),
    ),
  );
}

export function LearningBlockCard({
  block,
  number,
}: {
  block: LearningBlock;
  number: number;
}) {
  const [lead, ...details] = block.paragraphs;
  const cautions = visibleCautions(details);

  return (
    <section className="learning-block surface visual-learning-block">
      <div className="lesson-block-heading">
        <span className="lesson-block-number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
        <h2>{block.title}</h2>
      </div>
      {block.examples && (
        <div className="example-grid visual-example-grid">
          {block.examples.map((example, index) => (
            <div key={index} className="example-card visual-example-card">
              <div className="example-thai thai" lang="th">
                {example.thai}
              </div>
              <div className="ipa">{example.ipa}</div>
              <div className="meaning">{example.meaning}</div>
              <ExampleVisual example={example} />
              {example.note && <p className="example-note">{example.note}</p>}
              {isThaiSpeechText(example.thai) && (
                <SpeakButton text={example.thai} compact />
              )}
            </div>
          ))}
        </div>
      )}
      {lead && <p className="lesson-concept-lead">{lead}</p>}
      {cautions.length > 0 && (
        <div className="lesson-visible-cautions">
          <Info size={18} aria-hidden="true" />
          <div>
            {cautions.map((caution, index) => (
              <p key={index}>{caution}</p>
            ))}
          </div>
        </div>
      )}
      {block.callout && <div className="rule-callout">{block.callout}</div>}
      {details.length > 0 && (
        <details className="lesson-explanation-details">
          <summary>
            <BookOpen size={17} aria-hidden="true" />
            <span>くわしい説明を読む</span>
            <ChevronDown
              size={17}
              className="lesson-details-chevron"
              aria-hidden="true"
            />
          </summary>
          <div>
            {details.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

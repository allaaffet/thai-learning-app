/** 教材の照合状態。source-checked も専門家監修完了を意味しない。 */
export type VerificationStatus = "source-checked" | "unreviewed";

export interface ContentSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  checkedAt: string;
  access: "accessible" | "blocked";
  scope: string;
}

export interface ExampleSentence {
  thai: string;
  ipa: string;
  meaning: string;
  note?: string;
}

export interface LearningBlock {
  id: string;
  title: string;
  paragraphs: string[];
  examples?: ExampleSentence[];
  callout?: string;
}

export interface ExploreItem {
  id: string;
  thai: string;
  ipa: string;
  meaning: string;
  note: string;
}

export interface ExerciseOption {
  id: string;
  label: string;
  detail?: string;
}

interface ExerciseBase {
  id: string;
  prompt: string;
  options: ExerciseOption[];
  answerId: string;
  explanation: string;
  relatedConcepts: string[];
  difficulty: 1 | 2 | 3;
}

/** 形式を判別して renderer を追加できる discriminated union。 */
export type Exercise =
  | (ExerciseBase & { type: "multiple-choice" })
  | (ExerciseBase & { type: "character-recognition" })
  | (ExerciseBase & {
      type: "fill-in-the-blank";
      acceptedAnswers: readonly string[];
    })
  | (ExerciseBase & {
      type: "word-ordering";
      tokens: ExerciseOption[];
      answerOrder: readonly string[];
    });

export interface Lesson {
  id: string;
  number: number;
  chapterId: string;
  title: string;
  subtitle: string;
  durationMinutes: number;
  xp: number;
  prerequisites: string[];
  objectives: string[];
  blocks: LearningBlock[];
  explore: ExploreItem[];
  exercises: Exercise[];
  summary: string[];
  relatedLessonIds: string[];
  sourceIds: string[];
  verification: VerificationStatus;
}

export interface Chapter {
  id: string;
  partId: string;
  number: number;
  title: string;
  description: string;
  lessonIds: string[];
}

export interface Part {
  id: string;
  number: number;
  title: string;
  description: string;
  status: "available" | "planned";
  chapterIds: string[];
}

export type ConsonantClass = "mid" | "high" | "low";

export interface Character {
  id: string;
  thai: string;
  /** 字母の呼び名。ipa はその呼び名の最初の音節だけを表す。 */
  name: string;
  ipa: string;
  meaning: string;
  consonantClass: ConsonantClass;
  initialIpa: string;
  finalIpa?: string;
  example: ExampleSentence;
  sourceIds: string[];
  verification: VerificationStatus;
}

/** 未実装機能は教材型だけで完成済みと見なさない。 */
export interface AudioAsset {
  id: string;
  src: string;
  license: string;
  speaker: "human" | "synthetic";
  verification: VerificationStatus;
}

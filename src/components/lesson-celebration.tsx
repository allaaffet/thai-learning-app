import type { CSSProperties } from "react";

type PieceStyle = CSSProperties & {
  "--piece-x": string;
  "--piece-delay": string;
  "--piece-drift": string;
  "--piece-turn": string;
};

/** A brief, decorative response to the learner's completion action. */
export function LessonCelebration() {
  return (
    <div
      className="lesson-celebration"
      aria-hidden="true"
      data-testid="lesson-celebration"
    >
      {Array.from({ length: 14 }, (_, index) => {
        const style: PieceStyle = {
          "--piece-x": `${8 + index * 6.3}%`,
          "--piece-delay": `${(index % 4) * 35}ms`,
          "--piece-drift": `${(index % 2 ? 1 : -1) * (16 + (index % 3) * 12)}px`,
          "--piece-turn": `${(index % 2 ? 1 : -1) * (105 + index * 17)}deg`,
        };
        return (
          <span
            className="lesson-celebration-piece"
            style={style}
            key={index}
          />
        );
      })}
    </div>
  );
}

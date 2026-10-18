import trajectories from "@/data/stroke-trajectories.json";
import type { ReferenceStrokeGuide } from "@/lib/stroke-types";

const characterIds: Record<string, string> = {
  ก: "ko-kai",
  ง: "ngo-ngu",
  จ: "cho-chan",
  ม: "mo-ma",
};
const commit = "8f2c0e84efb9224835eede55f32d61d4becde1c3";

/** MIT-licensed human recordings: preserve every point and its original order. */
export const referenceStrokeGuides: ReferenceStrokeGuide[] = trajectories.map(
  (entry) => ({
    characterId: characterIds[entry.char],
    thai: entry.char,
    viewBox: [0, 0, 1000, 1000],
    strokes: entry.strokes.map((points, index) => ({
      id: `${characterIds[entry.char]}-${index + 1}`,
      path: points
        .map(
          ([x, y], pointIndex) =>
            `${pointIndex === 0 ? "M" : "L"} ${x * 1000} ${y * 1000}`,
        )
        .join(" "),
      startPoint: { x: points[0][0] * 1000, y: points[0][1] * 1000 },
    })),
    source: {
      id: "littlefrog-writing-practice",
      title: "littlefrog1973 / writing-practice — 手録り運筆データ",
      url: `https://github.com/littlefrog1973/writing-practice/blob/${commit}/data/strokes/thai_consonants.json`,
      license: "MIT · Copyright (c) 2026 littlefrog",
      licenseUrl: `https://github.com/littlefrog1973/writing-practice/blob/${commit}/LICENSE`,
      checkedAt: "2026-10-18",
    },
    verification: "source-checked",
    standardStrokeVerified: false,
    reviewNote:
      "出典の人手による記録軌跡をそのまま再生します。別の公開学習例と運筆の大筋を比較した4文字に限定しています。標準筆順は未検証・専門家監修前です。正解の筆順としての採点には使いません。",
  }),
);

export function getReferenceStrokeGuide(characterId: string) {
  return referenceStrokeGuides.find(
    (guide) => guide.characterId === characterId,
  );
}

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import trajectories from "./stroke-trajectories.json";
import {
  getReferenceStrokeGuide,
  referenceStrokeGuides,
} from "./stroke-guides";
import { isReferenceStrokeGuide } from "@/lib/stroke-types";

// These counts describe source recordings, not a prescribed standard stroke count.
const recordings = [
  { thai: "ก", id: "ko-kai", points: 195 },
  { thai: "ง", id: "ngo-ngu", points: 174 },
  { thai: "จ", id: "cho-chan", points: 211 },
  { thai: "ม", id: "mo-ma", points: 261 },
];

describe("出典から取得した参考運筆例", () => {
  it("比較対象の4文字だけを登録し、標準筆順の確認と区別する", () => {
    expect(referenceStrokeGuides.map((guide) => guide.thai)).toEqual(
      recordings.map((entry) => entry.thai),
    );
    for (const guide of referenceStrokeGuides) {
      expect(isReferenceStrokeGuide(guide)).toBe(true);
      expect(guide.standardStrokeVerified).toBe(false);
      expect(guide.reviewNote).toContain("未検証");
      expect(guide.source.url).toContain(
        "8f2c0e84efb9224835eede55f32d61d4becde1c3",
      );
      expect(guide.source.license).toContain("MIT");
    }
    expect(getReferenceStrokeGuide("kho-khai")).toBeUndefined();
    expect(getReferenceStrokeGuide("ho-nokhuk")).toBeUndefined();
  });

  it.each(recordings)(
    "$thai の全記録点を並べ替えずSVGへ変換する",
    ({ thai, id, points }) => {
      const recording = trajectories.find((entry) => entry.char === thai)!;
      const guide = getReferenceStrokeGuide(id)!;
      expect(recording.strokes).toHaveLength(1);
      expect(recording.strokes[0]).toHaveLength(points);
      for (const [index, stroke] of recording.strokes.entries()) {
        expect(
          stroke.every(
            (point) =>
              point.length === 2 &&
              point.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
          ),
        ).toBe(true);
        const coordinates = guide.strokes[index].path
          .split(/\s+/)
          .filter((value) => value !== "M" && value !== "L")
          .map(Number);
        expect(coordinates).toEqual(
          stroke.flatMap(([x, y]) => [x * 1000, y * 1000]),
        );
        expect(guide.strokes[index].startPoint).toEqual({
          x: stroke[0][0] * 1000,
          y: stroke[0][1] * 1000,
        });
      }
    },
  );

  it("原文のMIT著作権・許諾表示を変更せず同梱する", () => {
    const license = readFileSync(
      new URL(
        "../../public/licenses/ThaiWritingPractice-MIT.txt",
        import.meta.url,
      ),
    );
    expect(createHash("sha256").update(license).digest("hex")).toBe(
      "1eb7b9ca5c16ad212de1766d2ff0d41f3186e491f734e1d3d7af5e99f767773a",
    );
  });
});

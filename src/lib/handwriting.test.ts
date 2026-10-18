import { describe, expect, it } from "vitest";
import {
  createHandwritingState,
  handwritingReducer,
  MAX_HANDWRITING_STROKES,
  MAX_POINTS_PER_STROKE,
  normalizeClientPoint,
  strokeToSvgPoints,
  type HandwritingState,
} from "./handwriting";
import {
  isReferenceStrokeGuide,
  type ReferenceStrokeGuide,
} from "./stroke-types";

const rect = { left: 40, top: 80, width: 400, height: 400 };
const start = { x: 0.25, y: 0.5 };
const end = { x: 0.75, y: 1 };

function finishedLine(state = createHandwritingState()) {
  return handwritingReducer(
    handwritingReducer(state, { type: "start", pointerId: 1, point: start }),
    { type: "finish", pointerId: 1, point: end },
  );
}

describe("normalized handwriting coordinates", () => {
  it("uses the current viewport rectangle, independent of zoom or device pixels", () => {
    expect(normalizeClientPoint(140, 280, rect)).toEqual(start);
    expect(
      normalizeClientPoint(70, 200, {
        left: 20,
        top: 100,
        width: 200,
        height: 200,
      }),
    ).toEqual(start);
    // The stored point renders at the same proportion after surface resizing.
    expect(strokeToSvgPoints([start, end])).toBe("250,500 750,1000");
  });

  it("clamps a captured pointer outside the surface without corrupting the drawing", () => {
    expect(normalizeClientPoint(-20, 900, rect)).toEqual({ x: 0, y: 1 });
    expect(normalizeClientPoint(800, 0, rect)).toEqual({ x: 1, y: 0 });
  });

  it("rejects zero-size, nonfinite, and invalid geometry instead of dividing by zero", () => {
    expect(normalizeClientPoint(0, 0, { ...rect, width: 0 })).toBeNull();
    expect(normalizeClientPoint(0, 0, { ...rect, height: -1 })).toBeNull();
    expect(normalizeClientPoint(NaN, 0, rect)).toBeNull();
    expect(normalizeClientPoint(0, Infinity, rect)).toBeNull();
    expect(normalizeClientPoint(0, 0, { ...rect, left: NaN })).toBeNull();
  });
});

describe("handwriting stroke lifecycle", () => {
  it("keeps a tap as one nonempty stroke and preserves immutable history", () => {
    const initial = createHandwritingState();
    const active = handwritingReducer(initial, {
      type: "start",
      pointerId: 1,
      point: start,
    });
    const completed = handwritingReducer(active, {
      type: "finish",
      pointerId: 1,
      point: start,
    });
    expect(initial).toEqual({ strokes: [], active: null });
    expect(active.active?.points).toEqual([start]);
    expect(completed).toEqual({ strokes: [[start]], active: null });
  });

  it("records the final off-surface point and ignores a duplicate move", () => {
    const active = handwritingReducer(createHandwritingState(), {
      type: "start",
      pointerId: 1,
      point: start,
    });
    expect(
      handwritingReducer(active, { type: "move", pointerId: 1, point: start }),
    ).toBe(active);
    const completed = handwritingReducer(active, {
      type: "finish",
      pointerId: 1,
      point: { x: 2, y: -1 },
    });
    expect(completed.strokes[0]).toEqual([start, { x: 1, y: 0 }]);
  });

  it("ignores a second pointer throughout another pointer's stroke", () => {
    const active = handwritingReducer(createHandwritingState(), {
      type: "start",
      pointerId: 1,
      point: start,
    });
    expect(
      handwritingReducer(active, { type: "start", pointerId: 2, point: end }),
    ).toBe(active);
    expect(
      handwritingReducer(active, { type: "move", pointerId: 2, point: end }),
    ).toBe(active);
    expect(
      handwritingReducer(active, { type: "finish", pointerId: 2, point: end }),
    ).toBe(active);
    expect(handwritingReducer(active, { type: "cancel", pointerId: 2 })).toBe(
      active,
    );
    expect(
      handwritingReducer(active, { type: "finish", pointerId: 1 }).strokes,
    ).toEqual([[start]]);
  });

  it("cancels interrupted input without deleting earlier completed lines", () => {
    const completed = finishedLine();
    const active = handwritingReducer(completed, {
      type: "start",
      pointerId: 8,
      point: start,
    });
    const cancelled = handwritingReducer(active, {
      type: "cancel",
      pointerId: 8,
    });
    expect(cancelled).toEqual(completed);
    expect(
      handwritingReducer(cancelled, {
        type: "finish",
        pointerId: 8,
        point: end,
      }),
    ).toBe(cancelled);
    // lostpointercapture after pointerup is also a no-op.
    expect(
      handwritingReducer(completed, { type: "cancel", pointerId: 1 }),
    ).toBe(completed);
  });

  it("undoes active input first, then one completed line, and clears all history", () => {
    const completed = finishedLine();
    const active = handwritingReducer(completed, {
      type: "start",
      pointerId: 2,
      point: end,
    });
    const firstUndo = handwritingReducer(active, { type: "undo" });
    expect(firstUndo).toEqual(completed);
    expect(handwritingReducer(firstUndo, { type: "undo" })).toEqual(
      createHandwritingState(),
    );
    expect(handwritingReducer(active, { type: "clear" })).toEqual(
      createHandwritingState(),
    );
    const clear = handwritingReducer(active, { type: "clear" });
    expect(
      handwritingReducer(clear, { type: "move", pointerId: 2, point: end }),
    ).toBe(clear);
  });

  it("rejects invalid input without leaving empty or invalid strokes", () => {
    const initial = createHandwritingState();
    expect(
      handwritingReducer(initial, {
        type: "start",
        pointerId: 1,
        point: { x: NaN, y: 0 },
      }),
    ).toBe(initial);
    expect(
      handwritingReducer(initial, {
        type: "start",
        pointerId: Infinity,
        point: start,
      }),
    ).toBe(initial);
    const active = handwritingReducer(initial, {
      type: "start",
      pointerId: 1,
      point: start,
    });
    expect(
      handwritingReducer(active, {
        type: "move",
        pointerId: 1,
        point: { x: 0, y: NaN },
      }),
    ).toBe(active);
    expect(
      handwritingReducer(active, {
        type: "finish",
        pointerId: 1,
        point: { x: Infinity, y: 0 },
      }).strokes,
    ).toEqual([[start]]);
  });

  it("bounds long gestures while retaining their beginning and current endpoint", () => {
    let state = handwritingReducer(createHandwritingState(), {
      type: "start",
      pointerId: 1,
      point: start,
    });
    for (let index = 0; index < MAX_POINTS_PER_STROKE + 5; index++) {
      state = handwritingReducer(state, {
        type: "move",
        pointerId: 1,
        point: { x: index / (MAX_POINTS_PER_STROKE + 5), y: 0.2 },
      });
    }
    const completed = handwritingReducer(state, {
      type: "finish",
      pointerId: 1,
      point: end,
    });
    expect(completed.strokes[0]).toHaveLength(MAX_POINTS_PER_STROKE);
    expect(completed.strokes[0][0]).toEqual(start);
    expect(completed.strokes[0].at(-1)).toEqual(end);
  });

  it("limits local history and lets undo make room for another line", () => {
    let state: HandwritingState = createHandwritingState();
    for (let index = 0; index < MAX_HANDWRITING_STROKES; index++)
      state = finishedLine(state);
    expect(
      handwritingReducer(state, { type: "start", pointerId: 1, point: start }),
    ).toBe(state);
    const undone = handwritingReducer(state, { type: "undo" });
    expect(finishedLine(undone).strokes).toHaveLength(MAX_HANDWRITING_STROKES);
    expect(state.strokes).toHaveLength(MAX_HANDWRITING_STROKES);
  });
});

// Synthetic geometry tests the data contract only, never a Thai character's order.
const guideFixture: ReferenceStrokeGuide = {
  characterId: "test-fixture",
  thai: "fixture",
  viewBox: [0, 0, 100, 100],
  strokes: [
    { id: "test-line", path: "M10 10 L90 90", startPoint: { x: 10, y: 10 } },
  ],
  verification: "source-checked",
  standardStrokeVerified: false,
  reviewNote:
    "Synthetic trajectories only; standard stroke order is unverified.",
  source: {
    id: "test-source",
    title: "Synthetic test fixture",
    url: "https://example.com/test",
    license: "Fixture license",
    licenseUrl: "https://example.com/license",
    checkedAt: "2026-10-18",
  },
};

describe("stroke guide source contract", () => {
  it("requires a complete source-checked record before a guide can be displayed", () => {
    expect(isReferenceStrokeGuide(guideFixture)).toBe(true);
    expect(isReferenceStrokeGuide(undefined)).toBe(false);
    expect(
      isReferenceStrokeGuide({ ...guideFixture, verification: "unreviewed" }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({ ...guideFixture, standardStrokeVerified: true }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        standardStrokeVerified: undefined,
      }),
    ).toBe(false);
    expect(isReferenceStrokeGuide({ ...guideFixture, reviewNote: "" })).toBe(
      false,
    );
    expect(isReferenceStrokeGuide({ ...guideFixture, strokes: [] })).toBe(
      false,
    );
    expect(
      isReferenceStrokeGuide({ ...guideFixture, viewBox: [0, 0, 0, 100] }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        strokes: [{ id: "a", path: "" }],
      }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        strokes: [...guideFixture.strokes, ...guideFixture.strokes],
      }),
    ).toBe(false);
  });

  it("rejects missing licenses, unsafe links, invalid dates, and invalid start points", () => {
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        source: { ...guideFixture.source, license: "" },
      }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        source: { ...guideFixture.source, url: "javascript:alert(1)" },
      }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        source: { ...guideFixture.source, checkedAt: "unknown" },
      }),
    ).toBe(false);
    expect(
      isReferenceStrokeGuide({
        ...guideFixture,
        strokes: [{ ...guideFixture.strokes[0], startPoint: { x: NaN, y: 1 } }],
      }),
    ).toBe(false);
  });
});

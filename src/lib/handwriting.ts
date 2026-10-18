export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface DrawingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type HandwritingStroke = readonly NormalizedPoint[];

export interface HandwritingState {
  strokes: readonly HandwritingStroke[];
  active: {
    pointerId: number;
    points: HandwritingStroke;
  } | null;
}

export type HandwritingAction =
  | { type: "start"; pointerId: number; point: NormalizedPoint }
  | { type: "move"; pointerId: number; point: NormalizedPoint }
  | { type: "finish"; pointerId: number; point?: NormalizedPoint }
  | { type: "cancel"; pointerId: number }
  | { type: "undo" }
  | { type: "clear" };

// Local practice is intentionally bounded; no image, score, or study XP is saved.
export const MAX_HANDWRITING_STROKES = 100;
export const MAX_POINTS_PER_STROKE = 2048;
export const HANDWRITING_VIEWBOX_SIZE = 1000;

export function createHandwritingState(): HandwritingState {
  return { strokes: [], active: null };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function validPoint(point: NormalizedPoint): NormalizedPoint | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: clamp(point.x), y: clamp(point.y) };
}

/**
 * Store proportions, not device pixels. SVG rendering then survives resizing,
 * browser zoom, scrolling and high-DPI displays without clearing the drawing.
 * Read the current client rect for every pointer event.
 */
export function normalizeClientPoint(
  clientX: number,
  clientY: number,
  rect: DrawingRect,
): NormalizedPoint | null {
  if (
    ![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(
      Number.isFinite,
    ) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

function appendPoint(
  points: HandwritingStroke,
  candidate: NormalizedPoint,
): HandwritingStroke {
  const point = validPoint(candidate);
  if (!point) return points;
  const last = points[points.length - 1];
  if (last?.x === point.x && last.y === point.y) return points;
  // Retain the start and latest end even during an unusually long gesture.
  if (points.length >= MAX_POINTS_PER_STROKE) {
    return [...points.slice(0, MAX_POINTS_PER_STROKE - 1), point];
  }
  return [...points, point];
}

/** One active pointer; a cancellation discards only its unfinished stroke. */
export function handwritingReducer(
  state: HandwritingState,
  action: HandwritingAction,
): HandwritingState {
  if (action.type === "clear") return createHandwritingState();
  if (action.type === "undo") {
    if (state.active) return { ...state, active: null };
    if (state.strokes.length === 0) return state;
    return { ...state, strokes: state.strokes.slice(0, -1) };
  }
  if (action.type === "start") {
    if (
      state.active ||
      state.strokes.length >= MAX_HANDWRITING_STROKES ||
      !Number.isFinite(action.pointerId)
    ) {
      return state;
    }
    const point = validPoint(action.point);
    if (!point) return state;
    return {
      ...state,
      active: { pointerId: action.pointerId, points: [point] },
    };
  }
  if (!state.active || action.pointerId !== state.active.pointerId)
    return state;
  if (action.type === "cancel") return { ...state, active: null };
  if (action.type === "move") {
    const points = appendPoint(state.active.points, action.point);
    return points === state.active.points
      ? state
      : { ...state, active: { ...state.active, points } };
  }
  const points = action.point
    ? appendPoint(state.active.points, action.point)
    : state.active.points;
  return { strokes: [...state.strokes, points], active: null };
}

/** A single-point tap is rendered separately as a dot by the SVG component. */
export function strokeToSvgPoints(stroke: HandwritingStroke): string {
  return stroke
    .map(
      ({ x, y }) =>
        `${x * HANDWRITING_VIEWBOX_SIZE},${y * HANDWRITING_VIEWBOX_SIZE}`,
    )
    .join(" ");
}

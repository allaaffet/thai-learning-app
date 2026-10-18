/**
 * Recorded pen trajectories checked against the named, licensed source.
 * Source checking does not establish standard stroke order or expert review.
 * Never derive a reference trajectory from a font outline.
 */
export interface ReferenceStrokeGuide {
  characterId: string;
  thai: string;
  viewBox: readonly [number, number, number, number];
  strokes: readonly {
    id: string;
    path: string;
    startPoint?: { x: number; y: number };
  }[];
  source: {
    id: string;
    title: string;
    url: string;
    license: string;
    licenseUrl: string;
    checkedAt: string;
  };
  verification: "source-checked";
  standardStrokeVerified: false;
  reviewNote: string;
}

/** Reject incomplete records rather than displaying them as checked guides. */
export function isReferenceStrokeGuide(
  value: unknown,
): value is ReferenceStrokeGuide {
  if (typeof value !== "object" || value === null) return false;
  const guide = value as Record<string, unknown>;
  if (
    guide.verification !== "source-checked" ||
    guide.standardStrokeVerified !== false ||
    typeof guide.reviewNote !== "string" ||
    !guide.reviewNote.trim() ||
    typeof guide.characterId !== "string" ||
    !guide.characterId.trim() ||
    typeof guide.thai !== "string" ||
    !guide.thai.trim() ||
    !Array.isArray(guide.viewBox) ||
    guide.viewBox.length !== 4 ||
    !guide.viewBox.every((n) => typeof n === "number" && Number.isFinite(n)) ||
    guide.viewBox[2] <= 0 ||
    guide.viewBox[3] <= 0 ||
    !Array.isArray(guide.strokes) ||
    guide.strokes.length === 0 ||
    typeof guide.source !== "object" ||
    guide.source === null
  ) {
    return false;
  }
  const source = guide.source as Record<string, unknown>;
  if (
    !["id", "title", "url", "license", "licenseUrl", "checkedAt"].every(
      (key) => typeof source[key] === "string" && source[key].trim().length > 0,
    ) ||
    !Number.isFinite(Date.parse(String(source.checkedAt)))
  ) {
    return false;
  }
  try {
    if (
      new URL(String(source.url)).protocol !== "https:" ||
      new URL(String(source.licenseUrl)).protocol !== "https:"
    ) {
      return false;
    }
  } catch {
    return false;
  }
  const ids = new Set<string>();
  return guide.strokes.every((stroke: unknown) => {
    if (typeof stroke !== "object" || stroke === null) return false;
    const item = stroke as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !item.id.trim() ||
      ids.has(item.id) ||
      typeof item.path !== "string" ||
      !item.path.trim()
    ) {
      return false;
    }
    ids.add(item.id);
    if (item.startPoint === undefined) return true;
    if (typeof item.startPoint !== "object" || item.startPoint === null) {
      return false;
    }
    const point = item.startPoint as Record<string, unknown>;
    return (
      typeof point.x === "number" &&
      Number.isFinite(point.x) &&
      typeof point.y === "number" &&
      Number.isFinite(point.y)
    );
  });
}

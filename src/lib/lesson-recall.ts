/** 未採点の振り返り。状態は画面内だけで使い、習熟度や保存記録にしない。 */
export interface LessonRecallState {
  readonly itemIds: readonly string[];
  readonly phase: "first" | "revisit" | "complete";
  readonly index: number;
  readonly revealed: boolean;
  /** 意味・説明を一度以上めくった項目。正解数ではない。 */
  readonly seenIds: readonly string[];
  readonly revisitIds: readonly string[];
}

function isSafeItemId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value) &&
    !["constructor", "prototype", "__proto__"].includes(value)
  );
}

export function createLessonRecallState(
  ids: readonly string[],
): LessonRecallState {
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every(isSafeItemId) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("重複のない教材項目を選んでください。");
  }
  return {
    itemIds: [...ids],
    phase: "first",
    index: 0,
    revealed: false,
    seenIds: [],
    revisitIds: [],
  };
}

export function currentLessonRecallId(
  state: LessonRecallState,
): string | undefined {
  if (state.phase === "complete") return undefined;
  const items = state.phase === "first" ? state.itemIds : state.revisitIds;
  return items[state.index];
}

/** 表示した項目だけを数える。同じ項目を再びめくっても増やさない。 */
export function revealLessonRecall(
  state: LessonRecallState,
): LessonRecallState {
  const id = currentLessonRecallId(state);
  if (!id || state.revealed) return state;
  return {
    ...state,
    revealed: true,
    seenIds: state.seenIds.includes(id)
      ? state.seenIds
      : [...state.seenIds, id],
  };
}

/** 全項目の後、利用者が選んだ項目だけを一度再表示する。 */
export function advanceLessonRecall(
  state: LessonRecallState,
  revisit: boolean,
): LessonRecallState {
  const id = currentLessonRecallId(state);
  // A duplicate click after advancing must not skip a still-concealed card.
  if (!id || !state.revealed) return state;

  const revisitIds =
    state.phase === "first" && revisit
      ? [...state.revisitIds, id]
      : state.revisitIds;
  const activeIds = state.phase === "first" ? state.itemIds : state.revisitIds;
  if (state.index + 1 < activeIds.length) {
    return {
      ...state,
      index: state.index + 1,
      revealed: false,
      revisitIds,
    };
  }
  return {
    ...state,
    phase:
      state.phase === "first" && revisitIds.length ? "revisit" : "complete",
    index: 0,
    revealed: false,
    revisitIds,
  };
}

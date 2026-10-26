import { describe, expect, it } from "vitest";
import { courseLessons } from "@/data/course";
import {
  advanceLessonRecall,
  createLessonRecallState,
  currentLessonRecallId,
  revealLessonRecall,
  type LessonRecallState,
} from "@/lib/lesson-recall";

function freezeState(state: LessonRecallState): LessonRecallState {
  Object.freeze(state.itemIds);
  Object.freeze(state.seenIds);
  Object.freeze(state.revisitIds);
  return Object.freeze(state);
}

describe("本編の未採点めくりカード", () => {
  it.each(courseLessons)(
    "$id は既存項目を元の順序で一度ずつ確認し、新しい教材を作らない",
    (lesson) => {
      const sourceSnapshot = JSON.stringify(lesson);
      const ids = Object.freeze(lesson.explore.map((item) => item.id));
      let state = createLessonRecallState(ids);
      expect(state.itemIds).toEqual(ids);
      expect(state.itemIds).not.toBe(ids);
      expect(state.seenIds).toEqual([]);
      expect(state.revisitIds).toEqual([]);
      for (const [index, item] of lesson.explore.entries()) {
        expect(state.phase).toBe("first");
        expect(state.index).toBe(index);
        expect(currentLessonRecallId(state)).toBe(item.id);
        state = revealLessonRecall(freezeState(state));
        expect(state.seenIds).toEqual(ids.slice(0, index + 1));
        state = advanceLessonRecall(freezeState(state), false);
      }
      expect(state.phase).toBe("complete");
      expect(state.seenIds).toEqual(ids);
      expect(state.revisitIds).toEqual([]);
      expect(currentLessonRecallId(state)).toBeUndefined();
      expect(JSON.stringify(lesson)).toBe(sourceSnapshot);
    },
  );

  it("めくる前は進めず、二重操作でも次の項目を飛ばさない", () => {
    const initial = freezeState(createLessonRecallState(["one", "two"]));
    expect(advanceLessonRecall(initial, false)).toBe(initial);
    expect(advanceLessonRecall(initial, true)).toBe(initial);
    const revealed = freezeState(revealLessonRecall(initial));
    expect(revealLessonRecall(revealed)).toBe(revealed);
    expect(revealed.seenIds).toEqual(["one"]);
    const next = freezeState(advanceLessonRecall(revealed, true));
    expect(currentLessonRecallId(next)).toBe("two");
    expect(next.revealed).toBe(false);
    expect(next.revisitIds).toEqual(["one"]);
    expect(advanceLessonRecall(next, false)).toBe(next);
    expect(advanceLessonRecall(next, true)).toBe(next);
  });

  it("見直したい項目だけを最初の順序でもう一度扱い、その後は必ず終わる", () => {
    let state = createLessonRecallState(["one", "two", "three", "four"]);
    for (const revisit of [true, false, true, true]) {
      state = revealLessonRecall(freezeState(state));
      state = advanceLessonRecall(freezeState(state), revisit);
    }
    expect(state.phase).toBe("revisit");
    expect(state.index).toBe(0);
    expect(state.revealed).toBe(false);
    expect(state.seenIds).toEqual(["one", "two", "three", "four"]);
    expect(state.revisitIds).toEqual(["one", "three", "four"]);
    for (const id of ["one", "three", "four"]) {
      expect(currentLessonRecallId(state)).toBe(id);
      state = revealLessonRecall(freezeState(state));
      expect(state.seenIds).toHaveLength(4);
      // A second pass cannot enqueue another pass, even if a caller requests it.
      state = advanceLessonRecall(freezeState(state), true);
    }
    expect(state.phase).toBe("complete");
    expect(state.revisitIds).toEqual(["one", "three", "four"]);
    expect(state.seenIds).toHaveLength(4);
  });

  it("最後の項目だけを見直す場合や1項目の教材でも、表示を飛ばさない", () => {
    for (const ids of [["only"], ["first", "last"]]) {
      let state = createLessonRecallState(ids);
      for (let index = 0; index < ids.length; index += 1) {
        state = revealLessonRecall(state);
        state = advanceLessonRecall(state, index === ids.length - 1);
      }
      expect(state.phase).toBe("revisit");
      expect(currentLessonRecallId(state)).toBe(ids.at(-1));
      expect(state.revealed).toBe(false);
      state = advanceLessonRecall(revealLessonRecall(state), false);
      expect(state.phase).toBe("complete");
      expect(state.seenIds).toEqual(ids);
    }
  });

  it("終了後に再表示・次へが届いても状態と確認枚数を増やさない", () => {
    let state = createLessonRecallState(["one"]);
    state = freezeState(advanceLessonRecall(revealLessonRecall(state), false));
    expect(currentLessonRecallId(state)).toBeUndefined();
    expect(revealLessonRecall(state)).toBe(state);
    expect(advanceLessonRecall(state, false)).toBe(state);
    expect(advanceLessonRecall(state, true)).toBe(state);
    expect(state.seenIds).toEqual(["one"]);
    expect(Object.keys(state).sort()).toEqual(
      ["itemIds", "phase", "index", "revealed", "seenIds", "revisitIds"].sort(),
    );
  });

  it("未完了の進行や見直し登録で、渡された前の状態を変更しない", () => {
    const initial = freezeState(createLessonRecallState(["one", "two"]));
    const before = JSON.stringify(initial);
    const revealed = freezeState(revealLessonRecall(initial));
    const shown = JSON.stringify(revealed);
    const next = advanceLessonRecall(revealed, true);
    expect(JSON.stringify(initial)).toBe(before);
    expect(JSON.stringify(revealed)).toBe(shown);
    expect(initial.seenIds).toEqual([]);
    expect(revealed.revisitIds).toEqual([]);
    expect(next.revisitIds).toEqual(["one"]);
  });

  it("空・重複・無効なIDを受け入れない", () => {
    for (const ids of [
      [],
      ["one", "one"],
      [""],
      [" one"],
      ["one two"],
      ["one/two"],
      ["constructor"],
      ["prototype"],
      ["__proto__"],
      ["x".repeat(121)],
    ]) {
      expect(() => createLessonRecallState(ids)).toThrow();
    }
    for (const value of [null, undefined, "one", [null], [1]]) {
      expect(() =>
        createLessonRecallState(value as unknown as readonly string[]),
      ).toThrow();
    }
  });
});

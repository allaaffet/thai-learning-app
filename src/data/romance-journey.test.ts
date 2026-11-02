import { describe, expect, it } from "vitest";
import {
  getJourneyChapter,
  getJourneyRoute,
  getJourneyScene,
  isJourneyRouteId,
  journeyChapters,
} from "@/data/romance-journey";
import {
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
  romanceWords,
} from "@/data/romance";

const scenes = romanceCharacters.flatMap((character) =>
  romanceEpisodes.map((episode) => ({ character, episode })),
);

describe("物語と積み上がる会話機能の教材", () => {
  it("旧5話を同じ順で参照し、お手本から意味・想起へ支援を減らす", () => {
    expect(journeyChapters.map((chapter) => chapter.episodeId)).toEqual(
      romanceEpisodes.map((episode) => episode.id),
    );
    expect(
      new Set(journeyChapters.map((chapter) => chapter.episodeId)).size,
    ).toBe(5);
    expect(journeyChapters.map((chapter) => chapter.defaultSupport)).toEqual([
      "model",
      "model",
      "meaning",
      "recall",
      "recall",
    ]);
    journeyChapters.forEach((chapter, index) => {
      expect(chapter.level).toBe(index + 1);
      expect(chapter.skillTitle).not.toBe("");
      expect(chapter.canDo).toContain("練習");
      expect(chapter.bridge).not.toBe("");
      expect(getJourneyChapter(chapter.episodeId)).toBe(chapter);
      for (const character of romanceCharacters)
        expect(
          getRomanceQuestions(character.id, chapter.episodeId)[
            chapter.buildQuestionIndex
          ],
        ).toBeDefined();
    });
  });

  it("想起に未学習の後の話や現在の話を混ぜず、初回には過去の知識を要求しない", () => {
    expect(journeyChapters[0].recallEpisodeIds).toEqual([]);
    journeyChapters.forEach((chapter, index) => {
      expect(new Set(chapter.recallEpisodeIds).size).toBe(
        chapter.recallEpisodeIds.length,
      );
      if (index > 0) expect(chapter.recallEpisodeIds.length).toBeGreaterThan(0);
      for (const recalled of chapter.recallEpisodeIds) {
        const priorIndex = journeyChapters.findIndex(
          (entry) => entry.episodeId === recalled,
        );
        expect(priorIndex).toBeGreaterThanOrEqual(0);
        expect(priorIndex).toBeLessThan(index);
      }
    });
  });

  it.each(scenes)(
    "$character.id / $episode.id は異なる場面・練習焦点・思い出を持つ2ルートを提供する",
    ({ character, episode }) => {
      const scene = getJourneyScene(character.id, episode.id);
      expect(scene).toBeDefined();
      if (!scene) throw new Error("Missing authored scene");
      expect(scene.characterId).toBe(character.id);
      expect(scene.episodeId).toBe(episode.id);
      expect(scene.intro).toContain(character.name);
      expect(scene.routes.map((route) => route.id)).toEqual(["listen", "lead"]);
      const [first, second] = scene.routes;
      expect(first.title).not.toBe(second.title);
      expect(first.scene).not.toBe(second.scene);
      expect(first.successBeat).not.toBe(second.successBeat);
      expect(first.keepsake.id).not.toBe(second.keepsake.id);
      expect(first.keepsake.title).not.toBe(second.keepsake.title);
      expect(first.nextHook).not.toBe(second.nextHook);
      expect(first.focusQuestionIndex).not.toBe(second.focusQuestionIndex);
      expect(first.drillOrder).not.toBe(second.drillOrder);
      const questions = getRomanceQuestions(character.id, episode.id);
      const oldStoryOptions = getRomanceStoryOptions(character.id, episode.id);
      for (const route of scene.routes) {
        expect(isJourneyRouteId(route.id)).toBe(true);
        expect(getJourneyRoute(character.id, episode.id, route.id)).toEqual(
          route,
        );
        expect(questions[route.focusQuestionIndex]).toBeDefined();
        for (const text of [
          route.title,
          route.teaser,
          route.scene,
          route.challenge,
          route.successBeat,
          route.supportBeat,
          route.keepsake.title,
          route.keepsake.detail,
          route.nextHook,
        ])
          expect(text.trim()).not.toBe("");
        expect(["neutral", "happy", "thoughtful", "concerned"]).toContain(
          route.expression,
        );
        expect(route.wrapChoices).toHaveLength(2);
        expect(
          new Set(route.wrapChoices.map((choice) => choice.storyChoiceId)).size,
        ).toBe(2);
        expect(
          new Set(route.wrapChoices.map((choice) => choice.label)).size,
        ).toBe(2);
        for (const choice of route.wrapChoices) {
          // Both ending actions are legitimate. The new game does not disguise
          // the classic deliberately dismissive action as a friendly option.
          const oldOption = oldStoryOptions.find(
            (entry) => entry.id === choice.storyChoiceId,
          );
          expect(oldOption).toBeDefined();
          expect(oldOption?.affinityDelta).toBeGreaterThanOrEqual(0);
          expect(choice.storyChoiceId).not.toMatch(/-dismiss$/u);
          expect(choice.label.trim()).not.toBe("");
          expect(choice.reaction.trim()).not.toBe("");
          expect(["neutral", "happy", "thoughtful", "concerned"]).toContain(
            choice.expression,
          );
        }
      }
    },
  );

  it("60ルートの思い出IDと導入を混同せず、各人物に固有の連続した題材を持つ", () => {
    const memories: string[] = [];
    const intros: string[] = [];
    const themes = [
      ["mali", /展示|スケッチ/u],
      ["rin", /栞/u],
      ["dao", /地図/u],
      ["arun", /写真/u],
      ["kiet", /ゲーム|盤面/u],
      ["niran", /音楽|フライヤー/u],
    ] as const;
    for (const [characterId, theme] of themes) {
      const characterScenes = romanceEpisodes.map((episode) => {
        const scene = getJourneyScene(characterId, episode.id);
        if (!scene) throw new Error("Missing character arc");
        intros.push(scene.intro);
        for (const route of scene.routes) memories.push(route.keepsake.id);
        return scene;
      });
      // The theme recurs across the arc, rather than being only a roster label.
      const scenesWithTheme = characterScenes.filter((scene) =>
        theme.test(JSON.stringify(scene)),
      );
      expect(scenesWithTheme.length).toBeGreaterThanOrEqual(4);
      expect(new Set(characterScenes.map((scene) => scene.intro)).size).toBe(5);
    }
    expect(memories).toHaveLength(60);
    expect(new Set(memories).size).toBe(60);
    expect(new Set(intros).size).toBe(30);
  });

  it("日本語の分岐を追加しても、Thai教材・IPA・旧会話の内容を生成や変更しない", () => {
    const before = JSON.stringify({
      words: romanceWords,
      questions: scenes.map(({ character, episode }) =>
        getRomanceQuestions(character.id, episode.id),
      ),
    });
    const narrative = scenes.map(({ character, episode }) =>
      getJourneyScene(character.id, episode.id),
    );
    expect(JSON.stringify(narrative)).not.toMatch(/[\u0E00-\u0E7F]/u);
    expect(JSON.stringify(journeyChapters)).not.toMatch(/[\u0E00-\u0E7F]/u);
    expect(
      JSON.stringify({
        words: romanceWords,
        questions: scenes.map(({ character, episode }) =>
          getRomanceQuestions(character.id, episode.id),
        ),
      }),
    ).toBe(before);
  });

  it("存在しない相手・話・ルートを推測して教材に変換しない", () => {
    for (const unknown of ["unknown", "", "__proto__", "constructor"]) {
      expect(getJourneyChapter(unknown)).toBeUndefined();
      expect(getJourneyScene(unknown, "meet")).toBeUndefined();
      expect(getJourneyScene("mali", unknown)).toBeUndefined();
      expect(getJourneyRoute("mali", "meet", unknown)).toBeUndefined();
      expect(isJourneyRouteId(unknown)).toBe(false);
    }
    for (const invalid of [null, undefined, 0, {}, [], true])
      expect(isJourneyRouteId(invalid)).toBe(false);
  });
});

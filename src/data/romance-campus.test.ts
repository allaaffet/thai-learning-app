import { describe, expect, it } from "vitest";
import {
  campusRouteIds,
  campusSettingDescription,
  getCampusJourneyRoute,
  getCampusJourneyScene,
} from "@/data/romance-campus";
import {
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
  romanceWords,
} from "@/data/romance";
import { getJourneyScene } from "@/data/romance-journey";

const pairs = romanceCharacters.flatMap((character) =>
  romanceEpisodes.map((episode) => ({ character, episode })),
);

describe("社会人の夜間講座を舞台にしたキャンパス物語", () => {
  it("既存の成人6人と5話を使い、夜間講座の同級生という設定を明示する", () => {
    expect(romanceCharacters).toHaveLength(6);
    expect(romanceEpisodes.map((episode) => episode.id)).toEqual([
      "meet",
      "cafe",
      "likes",
      "market",
      "walk",
    ]);
    expect(campusSettingDescription).toContain("社会人");
    expect(campusSettingDescription).toContain("夜間");
    expect(campusSettingDescription).toContain("同級生");
    for (const character of romanceCharacters) {
      expect(character.age).toBeGreaterThanOrEqual(27);
      expect(character.age).toBeLessThanOrEqual(32);
    }
  });

  it.each(pairs)(
    "$character.id / $episode.id は学園編だけの2ルートと個別の反応を持つ",
    ({ character, episode }) => {
      const scene = getCampusJourneyScene(character.id, episode.id);
      if (!scene) throw new Error("Missing campus scene");
      expect(scene.characterId).toBe(character.id);
      expect(scene.episodeId).toBe(episode.id);
      expect(scene.intro).toContain(character.name);
      expect(scene.routes.map((route) => route.id)).toEqual(campusRouteIds);
      const [listen, lead] = scene.routes;
      expect(listen.title).not.toBe(lead.title);
      expect(listen.scene).not.toBe(lead.scene);
      expect(listen.successBeat).not.toBe(lead.successBeat);
      expect(listen.keepsake.title).not.toBe(lead.keepsake.title);
      expect(listen.nextHook).not.toBe(lead.nextHook);
      expect(listen.drillOrder).toBe("recall-first");
      expect(lead.drillOrder).toBe("build-first");
      expect(listen.focusQuestionIndex).not.toBe(lead.focusQuestionIndex);
      const oldChoices = getRomanceStoryOptions(character.id, episode.id);
      for (const route of scene.routes) {
        expect(
          getCampusJourneyRoute(character.id, episode.id, route.id),
        ).toEqual(route);
        expect(
          getRomanceQuestions(character.id, episode.id)[
            route.focusQuestionIndex
          ],
        ).toBeDefined();
        expect(route.keepsake.id).toBe(
          `campus-${character.id}-${episode.id}-${route.id}`,
        );
        for (const value of [
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
          expect(value.trim().length).toBeGreaterThan(5);
        expect(`${scene.intro} ${route.title} ${route.scene}`).toMatch(
          /講座|講義|教室|学園祭|学内|校舎|図書室|自習室|キャンパス|班|授業|正門|ステージ|編集室|中庭|音楽棟/u,
        );
        expect(route.wrapChoices.map((choice) => choice.storyChoiceId)).toEqual(
          [`${episode.id}-thoughtful`, `${episode.id}-gentle`],
        );
        expect(
          new Set(route.wrapChoices.map((choice) => choice.label)).size,
        ).toBe(2);
        expect(
          new Set(route.wrapChoices.map((choice) => choice.reaction)).size,
        ).toBe(2);
        for (const choice of route.wrapChoices) {
          const old = oldChoices.find(
            (entry) => entry.id === choice.storyChoiceId,
          );
          expect(old).toBeDefined();
          expect(old!.affinityDelta).toBeGreaterThan(0);
          expect(choice.label.trim().length).toBeGreaterThan(5);
          expect(choice.reaction.trim().length).toBeGreaterThan(15);
          expect(choice.expression).toBe("happy");
        }
      }
      const city = getJourneyScene(character.id, episode.id);
      expect(scene.intro).not.toBe(city?.intro);
      expect(scene.routes[0].keepsake.id).not.toBe(city?.routes[0].keepsake.id);
    },
  );

  it("60個の思い出IDと30個の導入を重複させず、人物ごとの内容を保持する", () => {
    const scenes = pairs.map(
      ({ character, episode }) =>
        getCampusJourneyScene(character.id, episode.id)!,
    );
    const routes = scenes.flatMap((scene) => scene.routes);
    expect(routes).toHaveLength(60);
    expect(new Set(routes.map((route) => route.keepsake.id)).size).toBe(60);
    expect(new Set(routes.map((route) => route.keepsake.title)).size).toBe(60);
    expect(new Set(scenes.map((scene) => scene.intro)).size).toBe(30);
    expect(new Set(routes.map((route) => route.scene)).size).toBe(60);
    expect(
      new Set(routes.map((route) => route.wrapChoices[1].reaction)).size,
    ).toBe(60);
  });

  it("学園祭と帰り道へ話が進み、最終話では相手との次の約束を扱う", () => {
    for (const character of romanceCharacters) {
      const market = getCampusJourneyScene(character.id, "market")!;
      expect(JSON.stringify(market)).toContain("学園祭");
      const ending = getCampusJourneyScene(character.id, "walk")!;
      for (const route of ending.routes) {
        expect(route.nextHook).toMatch(/次|これから|続|教室|授業|講座/u);
        expect(
          route.wrapChoices.map((choice) => choice.reaction).join(" "),
        ).toMatch(/会|約束|手|キス|デート|二人/u);
      }
    }
  });

  it("日本語の物語だけを追加し、既存Thai・語句IPA・3問の内容を変えない", () => {
    const wordSnapshot = JSON.stringify(romanceWords);
    const questionsBefore = pairs.map(({ character, episode }) =>
      JSON.stringify(getRomanceQuestions(character.id, episode.id)),
    );
    const scenes = pairs.map(({ character, episode }) =>
      getCampusJourneyScene(character.id, episode.id),
    );
    expect(JSON.stringify(scenes)).not.toMatch(/[\u0E00-\u0E7F]/u);
    expect(JSON.stringify(romanceWords)).toBe(wordSnapshot);
    expect(
      pairs.map(({ character, episode }) =>
        JSON.stringify(getRomanceQuestions(character.id, episode.id)),
      ),
    ).toEqual(questionsBefore);
  });

  it("未知の人物・話・ルートを別の物語へ推測して置き換えない", () => {
    for (const id of ["missing", "", "__proto__", "constructor"])
      expect(getCampusJourneyScene(id, "meet")).toBeUndefined();
    expect(getCampusJourneyScene("mali", "later")).toBeUndefined();
    expect(getCampusJourneyRoute("mali", "meet", "missing")).toBeUndefined();
    expect(getCampusJourneyRoute("missing", "meet", "listen")).toBeUndefined();
    expect(getCampusJourneyRoute("mali", "missing", "listen")).toBeUndefined();
  });

  it("表示側が受け取った配列やラベルを書き換えても、元の教材へ波及しない", () => {
    const first = getCampusJourneyScene("mali", "meet")!;
    const title = first.routes[0].keepsake.title;
    first.routes[0].keepsake.title = "display-only change";
    first.routes[0].wrapChoices.reverse();
    const second = getCampusJourneyScene("mali", "meet")!;
    expect(second.routes[0].keepsake.title).toBe(title);
    expect(second.routes[0].wrapChoices[0].storyChoiceId).toBe(
      "meet-thoughtful",
    );
  });
});

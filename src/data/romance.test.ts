import { describe, expect, it } from "vitest";
import { conversationScenarios, conversationWords } from "@/data/conversations";
import { grammarPoints, vocabularyEntries } from "@/data/language";
import {
  getRomanceCharacter,
  getRomanceEpisode,
  getRomanceQuestions,
  getRomanceStoryOptions,
  romanceCharacters,
  romanceEpisodes,
  romanceSources,
  romanceWords,
} from "@/data/romance";

describe("成人の架空人物と学ぶ実践コースの教材", () => {
  it("成人6人と重複しない6区画の絵を、各性別3人ずつ持つ", () => {
    expect(romanceCharacters).toHaveLength(6);
    expect(
      new Set(romanceCharacters.map((character) => character.id)).size,
    ).toBe(6);
    const cells = new Set<string>();
    for (const character of romanceCharacters) {
      expect(character.age).toBeGreaterThanOrEqual(27);
      expect(character.age).toBeLessThanOrEqual(32);
      expect(character.portrait.row).toBe(
        character.gender === "female" ? 0 : 1,
      );
      expect([0, 1, 2]).toContain(character.portrait.column);
      cells.add(`${character.portrait.row}:${character.portrait.column}`);
      expect(character.traits).toHaveLength(2);
      expect(new Set(character.traits).size).toBe(2);
      expect(getRomanceCharacter(character.id)).toBe(character);
    }
    expect(cells.size).toBe(6);
    expect(
      romanceCharacters.filter((character) => character.gender === "male"),
    ).toHaveLength(3);
    expect(
      romanceCharacters.filter((character) => character.gender === "female"),
    ).toHaveLength(3);
  });

  it("どの好みを選んでも、異性の候補が複数見つかる", () => {
    for (const gender of ["male", "female"] as const) {
      for (const preference of ["warm", "calm", "curious"] as const) {
        const candidates = romanceCharacters.filter(
          (character) =>
            character.gender !== gender &&
            character.traits.includes(preference),
        );
        expect(candidates).toHaveLength(2);
      }
    }
  });

  it("5話を明示的な順序で持ち、会話問題と物語選択を分ける", () => {
    expect(romanceEpisodes.map((episode) => episode.id)).toEqual([
      "meet",
      "cafe",
      "likes",
      "market",
      "walk",
    ]);
    romanceEpisodes.forEach((episode, index) => {
      expect(episode.number).toBe(index + 1);
      expect(episode.previousEpisodeId).toBe(
        index ? romanceEpisodes[index - 1].id : null,
      );
      expect(episode.verification).toBe("unreviewed");
      expect(episode.storyPrompt).not.toBe("");
      expect(getRomanceEpisode(episode.id)).toBe(episode);
    });
    expect(romanceEpisodes[1].setting).toContain("店員役");
    expect(romanceEpisodes[3].setting).toContain("20バーツ");
    expect(romanceEpisodes[4].setting).toContain("案内の人役");
  });

  it.each(romanceCharacters)(
    "$id の全5話に個別の導入と振り返りを持つ",
    (character) => {
      for (const episode of romanceEpisodes) {
        expect(character.episodeIntros[episode.id]).toContain(character.name);
        expect(character.episodeOutros[episode.id].length).toBeGreaterThan(15);
      }
      expect(new Set(Object.values(character.episodeIntros)).size).toBe(5);
      expect(new Set(Object.values(character.episodeOutros)).size).toBe(5);
    },
  );

  it.each(
    romanceCharacters.flatMap((character) =>
      romanceEpisodes.map((episode) => ({ character, episode })),
    ),
  )(
    "$character.id / $episode.id の3問・複数正答・出典と語句を保持する",
    ({ character, episode }) => {
      const original = JSON.stringify([
        conversationScenarios,
        conversationWords,
        vocabularyEntries,
      ]);
      const questions = getRomanceQuestions(character.id, episode.id);
      const words = new Map(romanceWords.map((word) => [word.id, word]));
      const sourceIds = new Set(romanceSources.map((source) => source.id));
      expect(questions).toHaveLength(3);
      expect(new Set(questions.map((question) => question.id)).size).toBe(3);
      for (const question of questions) {
        expect(question.verification).toBe("unreviewed");
        expect(question.answerIds).toHaveLength(2);
        expect(new Set(question.answerIds).size).toBe(2);
        expect(new Set(question.choices.map((choice) => choice.id)).size).toBe(
          question.choices.length,
        );
        const accepted = question.choices.filter((choice) =>
          question.answerIds.includes(choice.id),
        );
        expect(accepted).toHaveLength(2);
        expect(
          accepted.some((choice) =>
            choice.phrase.wordIds.includes("polite-male"),
          ),
        ).toBe(true);
        expect(
          accepted.some(
            (choice) =>
              choice.phrase.wordIds.includes("polite-female-statement") ||
              choice.phrase.wordIds.includes("polite-female-question"),
          ),
        ).toBe(true);
        expect(
          question.choices.some(
            (choice) => !question.answerIds.includes(choice.id),
          ),
        ).toBe(true);
        expect(question.sourceIds.length).toBeGreaterThan(0);
        for (const id of question.sourceIds)
          expect(sourceIds.has(id)).toBe(true);
        expect(question.sourceNote).toContain("監修");
        for (const phrase of [
          question.npc,
          ...question.choices.map((choice) => choice.phrase),
        ]) {
          expect(phrase.wordIds.every((id) => words.has(id))).toBe(true);
          expect(phrase.thai).toBe(
            phrase.wordIds.map((id) => words.get(id)!.thai).join(""),
          );
          expect(phrase.meaning).not.toBe("");
          expect(Object.hasOwn(phrase, "ipa")).toBe(false);
        }
        if (character.gender === "male")
          expect(question.npc.wordIds.at(-1)).toBe("polite-male");
        else
          expect([
            "polite-female-statement",
            "polite-female-question",
          ]).toContain(question.npc.wordIds.at(-1));
      }
      expect(
        JSON.stringify([
          conversationScenarios,
          conversationWords,
          vocabularyEntries,
        ]),
      ).toBe(original);
    },
  );

  it("元の4会話の選択肢・正答を維持し、NPCの登録文末詞だけを切り替える", () => {
    for (const episode of romanceEpisodes.filter(
      (episode) => episode.sourceScenarioId,
    )) {
      const scenario = conversationScenarios.find(
        (item) => item.id === episode.sourceScenarioId,
      )!;
      const female = getRomanceQuestions("mali", episode.id),
        male = getRomanceQuestions("arun", episode.id);
      scenario.steps.forEach((step, index) => {
        expect(female[index].npc.thai).toBe(step.npc.thai);
        expect(female[index].npc.wordIds).toEqual(step.npc.wordIds);
        expect(male[index].npc.wordIds.slice(0, -1)).toEqual(
          step.npc.wordIds.slice(0, -1),
        );
        expect(male[index].npc.wordIds.at(-1)).toBe("polite-male");
        for (const question of [female[index], male[index]]) {
          expect(question.npc.meaning).toBe(step.npc.meaning);
          expect(question.choices).toEqual(step.choices);
          expect(question.answerIds).toEqual(step.answerIds);
          expect(question.explanation).toBe(step.explanation);
        }
      });
    }
  });

  it("好みの質問は既存の基本質問を参照し、希望と出身の違いを扱う未監修モデルとする", () => {
    const point = grammarPoints.find(
      (point) => point.id === "basic-questions",
    )!;
    expect(point.explanation.join("")).toContain("คุณชอบแมวไหม");
    const questions = getRomanceQuestions("mali", "likes");
    expect(questions[0].npc.thai).toBe("คุณชอบแมวไหมคะ");
    expect(questions[1].npc.thai).toBe("คุณอยากไปญี่ปุ่นไหมคะ");
    expect(questions[0].sourceNote).toContain("教材案");
    const existing = conversationScenarios[0].steps[1].choices.find(
      (choice) => choice.id === "greeting-from-wish",
    )!;
    expect(questions[1].choices[0].phrase).toEqual(existing.phrase);
    expect(questions[1].choices[1].phrase.thai).toBe("อยากไปญี่ปุ่นค่ะ");
    expect(questions[2].id).toBe("greeting-origin-close");
  });

  it("独立した36語句を参照し、元の34語・本編40語を増減しない", () => {
    expect(romanceWords).toHaveLength(36);
    expect(new Set(romanceWords.map((word) => word.id)).size).toBe(36);
    expect(conversationWords).toHaveLength(34);
    expect(vocabularyEntries).toHaveLength(40);
    for (const word of romanceWords) {
      expect(word.verification).toBe("unreviewed");
      expect(word.ipa).not.toBe("");
    }
  });

  it("物語の好感度は各話の登録選択だけで、丁寧な断りや自分のペースも尊重する", () => {
    for (const character of romanceCharacters) {
      for (const episode of romanceEpisodes) {
        const choices = getRomanceStoryOptions(character.id, episode.id);
        expect(choices).toHaveLength(3);
        expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
        expect(choices.map((choice) => choice.affinityDelta)).toEqual([
          3, 1, -2,
        ]);
        expect(choices[2].label).toMatch(/遮|押しつけ|けな|否定|勝手/);
        for (const choice of choices) {
          expect(choice.label).not.toBe("");
          expect(choice.reaction).not.toBe("");
        }
      }
    }
    expect(getRomanceStoryOptions("mali", "cafe")[1].label).toContain(
      "無理せず",
    );
    expect(getRomanceStoryOptions("arun", "walk")[1].label).toContain("急がず");
  });

  it("未知の人物・話を、既存の会話から推測して補わない", () => {
    expect(getRomanceCharacter("unknown")).toBeUndefined();
    expect(getRomanceEpisode("unknown")).toBeUndefined();
    expect(getRomanceQuestions("unknown", "meet")).toEqual([]);
    expect(getRomanceQuestions("mali", "unknown")).toEqual([]);
    expect(getRomanceStoryOptions("unknown", "meet")).toEqual([]);
    expect(getRomanceStoryOptions("mali", "unknown")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  getRomanceCharacter,
  getRomanceQuestions,
  romanceEpisodes,
} from "@/data/romance";
import {
  getEnsembleCast,
  getEnsembleInvitation,
  getEnsembleNextEpisode,
  getEnsembleReaction,
  getEnsembleScene,
} from "@/data/romance-ensemble";
import {
  completeRomanceEpisode,
  createEmptyRomance,
  setRomanceProfile,
  type RomanceState,
} from "@/lib/romance";
import type { RomanceEpisodeId } from "@/lib/romance-types";

function clearEpisode(
  state: RomanceState,
  characterId: string,
  episodeId: RomanceEpisodeId,
) {
  return completeRomanceEpisode(state, {
    characterId,
    episodeId,
    sessionId: `ensemble-test-${characterId}-${episodeId}`,
    now: "2026-11-03T12:00:00.000Z",
    answers: getRomanceQuestions(characterId, episodeId).map((question) => ({
      stepId: question.id,
      choiceId: question.answerIds[0],
    })),
    storyChoiceId: `${episodeId}-gentle`,
  }).state;
}

describe("three-person invitation scenes", () => {
  it.each(["male", "female"] as const)(
    "offers three distinct adult characters opposite a %s protagonist",
    (gender) => {
      const ids = getEnsembleCast(gender);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        const person = getRomanceCharacter(id);
        expect(person).toBeDefined();
        expect(person!.gender).not.toBe(gender);
        expect(person!.age).toBeGreaterThanOrEqual(27);
        const reactions = getEnsembleReaction(id)!;
        expect(reactions).toHaveLength(3);
        expect(reactions[0].characterId).toBe(id);
        expect(new Set(reactions.map((line) => line.characterId))).toEqual(
          new Set(ids),
        );
        for (const setting of ["city", "campus"] as const) {
          for (const episode of romanceEpisodes) {
            expect(getEnsembleInvitation(setting, id, episode.id)).toBeTruthy();
          }
        }
      }
    },
  );

  it("keeps each group scene finite and includes the whole cast", () => {
    for (const setting of ["city", "campus"] as const) {
      for (const gender of ["male", "female"] as const) {
        const scene = getEnsembleScene(setting, gender)!;
        expect(scene.groupLines.length).toBeGreaterThanOrEqual(4);
        expect(scene.groupLines.length).toBeLessThanOrEqual(6);
        expect(
          new Set(scene.groupLines.map((line) => line.characterId)),
        ).toEqual(new Set(getEnsembleCast(gender)));
        expect(scene.groupLines.every((line) => line.text.length > 0)).toBe(
          true,
        );
      }
    }
  });

  it("rejects an unknown character or episode rather than inventing an invitation", () => {
    expect(getEnsembleReaction("unknown")).toBeUndefined();
    expect(getEnsembleReaction("__proto__")).toBeUndefined();
    expect(getEnsembleInvitation("city", "unknown", "meet")).toBeUndefined();
    expect(getEnsembleInvitation("campus", "mali", "unknown")).toBeUndefined();
  });

  it("offers only a profile-eligible route", () => {
    const empty = createEmptyRomance();
    expect(getEnsembleNextEpisode(empty, "mali")).toBeUndefined();
    const state = setRomanceProfile(empty, "male", "warm");
    expect(getEnsembleNextEpisode(state, "unknown")).toBeUndefined();
    expect(getEnsembleNextEpisode(state, "arun")).toBeUndefined();
    expect(getEnsembleNextEpisode(state, "mali")).toBe("meet");
  });

  it("invites to the next unfinished unlocked scene, preserving other routes", () => {
    let state = setRomanceProfile(createEmptyRomance(), "male", "warm");
    for (const [index, episode] of romanceEpisodes.entries()) {
      expect(getEnsembleNextEpisode(state, "mali")).toBe(episode.id);
      state = clearEpisode(state, "mali", episode.id);
      expect(getEnsembleNextEpisode(state, "rin")).toBe("meet");
      if (index < romanceEpisodes.length - 1) {
        expect(getEnsembleNextEpisode(state, "mali")).toBe(
          romanceEpisodes[index + 1].id,
        );
      }
    }
    expect(getEnsembleNextEpisode(state, "mali")).toBe("walk");
  });

  it("does not change progress when invitations and all group replies are read", () => {
    const state = clearEpisode(
      setRomanceProfile(createEmptyRomance(), "female", "calm"),
      "kiet",
      "meet",
    );
    const before = structuredClone(state);
    Object.freeze(state);
    Object.freeze(state.characters);
    for (const setting of ["city", "campus"] as const) {
      const scene = getEnsembleScene(setting, "female")!;
      for (const line of scene.groupLines) {
        getEnsembleReaction(line.characterId);
      }
      for (const id of getEnsembleCast("female")) {
        const next = getEnsembleNextEpisode(state, id)!;
        getEnsembleInvitation(setting, id, next);
      }
    }
    expect(state).toEqual(before);
  });
});

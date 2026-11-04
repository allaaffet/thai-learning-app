import { describe, expect, it } from "vitest";
import {
  getRomanceQuestions,
  romanceCharacters,
  romanceEpisodes,
  romanceWords,
} from "@/data/romance";
import { getJourneyChapter } from "@/data/romance-journey";
import { ROMANCE_DIALOGUE_CURRICULUM_ID } from "@/data/romance-dialogue";
import { getStoryJourneyRoute } from "@/data/romance-story";
import {
  ROMANCE_LEARNING_STORAGE_KEY,
  completeRomanceLearning,
  createEmptyRomanceLearning,
  getJourneyCoreAnswers,
  getJourneyKeepsakes,
  getJourneyLearningProgress,
  getJourneyPlan,
  getJourneyRecoveryActivities,
  getJourneyStoryChoice,
  getJourneyStoryEcho,
  getJourneyStoryEnding,
  gradeJourneyActivity,
  hasCurrentRomanceDialogue,
  isRomanceLearningState,
  loadRomanceLearning,
  replaceRomanceLearning,
  saveRomanceLearning,
  type JourneyActivity,
  type JourneyAttempt,
  type JourneyLearningInput,
  type JourneyPlan,
  type JourneyResponse,
} from "@/lib/romance-journey";

const now = "2026-11-03T09:00:00.000Z";
function answer(activity: JourneyActivity, correct = true): JourneyResponse {
  if (activity.kind === "model") throw new Error("Not a question");
  if (activity.kind === "build")
    return {
      kind: "build",
      wordIds: correct ? [...activity.acceptedWordIds[0]] : [],
    };
  const choice = activity.question.choices.find(
    (entry) => activity.question.answerIds.includes(entry.id) === correct,
  );
  if (!choice) throw new Error("Missing authored choice");
  return { kind: "choice", choiceId: choice.id };
}
function attempts(plan: JourneyPlan, correct = true): JourneyAttempt[] {
  return plan.activities
    .filter((activity) => activity.kind !== "model")
    .map((activity) => ({
      activityId: activity.id,
      response: answer(activity, correct),
      usedHint: false,
    }));
}
function input(
  episodeId = "meet",
  routeId: "listen" | "lead" = "listen",
  sessionId = "journey-test-1",
): JourneyLearningInput {
  const plan = getJourneyPlan("mali", episodeId, routeId, "male");
  return {
    characterId: "mali",
    episodeId,
    routeId,
    gender: "male",
    sessionId,
    attempts: attempts(plan),
    now,
  };
}
function recorded() {
  return completeRomanceLearning(createEmptyRomanceLearning(), input()).state;
}
function memoryStorage(initial: string | null = null) {
  let raw = initial;
  const writes: string[] = [];
  return {
    getItem(key: string) {
      expect(key).toBe(ROMANCE_LEARNING_STORAGE_KEY);
      return raw;
    },
    setItem(key: string, value: string) {
      writes.push(key);
      raw = value;
    },
    get raw() {
      return raw;
    },
    writes,
  };
}

describe("段階的な会話の活動計画", () => {
  it.each(
    romanceCharacters.map(
      (character) => [character.id, character.gender] as const,
    ),
  )(
    "%s の両ルートと全5話で既存Thai・3往復・正答を保つ",
    (characterId, gender) => {
      const player = gender === "female" ? "male" : "female";
      for (const episode of romanceEpisodes)
        for (const route of ["listen", "lead"] as const) {
          const plan = getJourneyPlan(characterId, episode.id, route, player);
          const original = getRomanceQuestions(characterId, episode.id);
          const core = plan.activities.filter(
            (activity) =>
              activity.kind === "respond" && activity.purpose === "core",
          );
          expect(core.map((activity) => activity.question.id)).toEqual(
            original.map((question) => question.id),
          );
          expect(core.map((activity) => activity.question.npc.thai)).toEqual(
            original.map((question) => question.npc.thai),
          );
          expect(core.map((activity) => activity.question.answerIds)).toEqual(
            original.map((question) => question.answerIds),
          );
          expect(
            new Set(plan.activities.map((activity) => activity.id)).size,
          ).toBe(plan.activities.length);
          expect(plan.activities).toHaveLength(episode.id === "meet" ? 5 : 6);
          const model = plan.activities[0];
          expect(model.kind).toBe("model");
          if (model.kind !== "model") throw new Error("Missing model");
          expect(model.models.map((question) => question.id)).toEqual(
            original.map((question) => question.id),
          );
          expect(getJourneyCoreAnswers(plan, attempts(plan))).toHaveLength(3);
        }
    },
  );

  it("語句bankと組立正答は登録した綴りをそのまま保持し、両方の丁寧な形を受け付ける", () => {
    for (const episode of romanceEpisodes)
      for (const route of ["listen", "lead"] as const) {
        const plan = getJourneyPlan("mali", episode.id, route, "male");
        const build = plan.activities.find(
          (activity) => activity.kind === "build",
        );
        if (!build || build.kind !== "build")
          throw new Error("Missing builder");
        expect(build.acceptedWordIds.length).toBeGreaterThanOrEqual(2);
        for (const ids of build.acceptedWordIds) {
          expect(
            gradeJourneyActivity(build, { kind: "build", wordIds: ids })
              .correct,
          ).toBe(true);
          expect(
            ids.every((id) => build.bank.some((word) => word.id === id)),
          ).toBe(true);
        }
        expect(new Set(build.bank.map((word) => word.id)).size).toBe(
          build.bank.length,
        );
        for (const word of build.bank)
          expect(word.thai).toBe(
            romanceWords.find((source) => source.id === word.id)?.thai,
          );
      }
  });

  it("ルートで組立・復習の順と対象が変わり、本番の因果順は変わらない", () => {
    const plans = [
      getJourneyPlan("mali", "cafe", "listen", "male"),
      getJourneyPlan("mali", "cafe", "lead", "male"),
    ];
    const kinds = plans.map((plan) =>
      plan.activities.map((activity) =>
        activity.kind === "respond" ? activity.purpose : activity.kind,
      ),
    );
    expect(kinds[0]).not.toEqual(kinds[1]);
    expect(plans[0].route.focusQuestionIndex).not.toBe(
      plans[1].route.focusQuestionIndex,
    );
    for (const plan of plans) {
      const core = plan.activities.filter(
        (activity) =>
          activity.kind === "respond" && activity.purpose === "core",
      );
      expect(core.map((activity) => activity.question.id)).toEqual(
        getRomanceQuestions("mali", "cafe").map((question) => question.id),
      );
    }
  });

  it("初回は既習のない復習を作らず、以後は前の話だけを復習する", () => {
    for (const episode of romanceEpisodes) {
      const plan = getJourneyPlan("mali", episode.id, "listen", "male");
      const recalls = plan.activities.filter(
        (activity) =>
          activity.kind === "respond" && activity.purpose === "recall",
      );
      expect(recalls).toHaveLength(episode.id === "meet" ? 0 : 1);
      for (const recall of recalls) {
        const sourceIndex = romanceEpisodes.findIndex(
          (entry) => entry.id === recall.sourceEpisodeId,
        );
        expect(sourceIndex).toBeLessThan(episode.number - 1);
        expect(plan.chapter.recallEpisodeIds).toContain(recall.sourceEpisodeId);
      }
    }
  });

  it("主人公・相手・話・ルートが不明なら推測した計画を作らない", () => {
    expect(() => getJourneyPlan("unknown", "meet", "listen", "male")).toThrow();
    expect(() => getJourneyPlan("mali", "unknown", "listen", "male")).toThrow();
    expect(() => getJourneyPlan("mali", "meet", "listen", "female")).toThrow();
    expect(() =>
      getJourneyPlan("mali", "meet", "unknown" as "listen", "male"),
    ).toThrow();
  });
});

describe("恋愛会話の教材更新と以前の活動記録", () => {
  it("旧版1の記録は、保存・思い出・物語選択を保持しながら新教材の実施と区別する", () => {
    const legacy = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-gentle",
    }).state;
    delete legacy.characters.mali.episodes.meet.curriculumId;
    const raw = JSON.stringify(legacy);
    const stored = memoryStorage(raw);
    const loaded = loadRomanceLearning(stored);
    expect(loaded.status).toBe("loaded");
    expect(loaded.state).toEqual(legacy);
    expect(isRomanceLearningState(loaded.state)).toBe(true);
    expect(
      hasCurrentRomanceDialogue(loaded.state.characters.mali.episodes.meet),
    ).toBe(false);
    expect(hasCurrentRomanceDialogue(undefined)).toBe(false);
    expect(getJourneyKeepsakes(loaded.state, "mali")).toHaveLength(1);
    expect(getJourneyStoryEcho(loaded.state, "mali", "cafe")).toBeDefined();
    expect(stored.raw).toBe(raw);
    expect(stored.writes).toEqual([]);
  });

  it("新しい教材の終了を受理したときだけ現行教材を記録し、旧履歴を引き継ぐ", () => {
    const legacy = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-gentle",
    }).state;
    delete legacy.characters.mali.episodes.meet.curriculumId;
    const copy = structuredClone(legacy);
    const result = completeRomanceLearning(legacy, {
      ...input("meet", "lead", "new-romantic-dialogue"),
      now: "2026-11-04T09:00:00.000Z",
    });
    expect(result.receipt.applied).toBe(true);
    expect(legacy).toEqual(copy);
    const entry = result.state.characters.mali.episodes.meet;
    expect(entry.curriculumId).toBe(ROMANCE_DIALOGUE_CURRICULUM_ID);
    expect(hasCurrentRomanceDialogue(entry)).toBe(true);
    expect(entry.firstCompletedAt).toBe(
      copy.characters.mali.episodes.meet.firstCompletedAt,
    );
    expect(entry.plays).toBe(2);
    expect(entry.routes).toEqual(["listen", "lead"]);
    expect(entry.lastStory).toEqual(
      copy.characters.mali.episodes.meet.lastStory,
    );
    const stored = memoryStorage();
    expect(saveRomanceLearning(result.state, stored)).toBe(true);
    expect(loadRomanceLearning(stored).state).toEqual(result.state);
  });

  it("以前のセッションを再送しただけでは、新教材の実施へ書き換えない", () => {
    const legacy = recorded();
    delete legacy.characters.mali.episodes.meet.curriculumId;
    const copy = structuredClone(legacy);
    const result = completeRomanceLearning(legacy, input());
    expect(result.receipt.applied).toBe(false);
    expect(result.state).toBe(legacy);
    expect(result.state).toEqual(copy);
    expect(
      hasCurrentRomanceDialogue(result.state.characters.mali.episodes.meet),
    ).toBe(false);
  });

  it.each(["future-romance", 1, null, {}, ""])(
    "未知・不正な教材IDは元データを保護する #%#",
    (curriculumId) => {
      const state = recorded();
      Reflect.set(
        state.characters.mali.episodes.meet,
        "curriculumId",
        curriculumId,
      );
      const raw = JSON.stringify(state);
      const stored = memoryStorage(raw);
      expect(isRomanceLearningState(state)).toBe(false);
      expect(loadRomanceLearning(stored).status).toBe("invalid");
      expect(saveRomanceLearning(recorded(), stored)).toBe(false);
      expect(stored.raw).toBe(raw);
      expect(stored.writes).toEqual([]);
    },
  );
});

describe("直近の物語選択の記憶と旧v1互換", () => {
  it("選択を持たない既存v1を有効なまま読み、記憶を推測生成しない", () => {
    const old = recorded();
    delete old.characters.mali.episodes.meet.curriculumId;
    expect(old.version).toBe(1);
    expect(old.characters.mali.episodes.meet.lastStory).toBeUndefined();
    expect(isRomanceLearningState(old)).toBe(true);
    expect(getJourneyStoryEcho(old, "mali", "cafe")).toBeUndefined();
    expect(getJourneyStoryEnding(old, "mali")).toBeUndefined();
    const stored = memoryStorage(JSON.stringify(old));
    expect(loadRomanceLearning(stored)).toEqual({
      state: old,
      status: "loaded",
    });
    expect(stored.writes).toEqual([]);
  });

  it("実際の終了時に選んだIDだけを保存し、集計は変えない", () => {
    const original = input();
    const withoutStory = completeRomanceLearning(
      createEmptyRomanceLearning(),
      original,
    );
    const result = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...original,
      storyChoiceId: "meet-thoughtful",
    });
    expect(result.receipt.summary).toEqual(withoutStory.receipt.summary);
    expect(result.state.characters.mali.episodes.meet.lastStory).toEqual({
      routeId: "listen",
      choiceId: "meet-thoughtful",
    });
    expect(isRomanceLearningState(result.state)).toBe(true);
    expect(
      Object.keys(result.state.characters.mali.episodes.meet.lastStory!),
    ).toEqual(["routeId", "choiceId"]);
    expect(Object.keys(result.state)).toEqual([
      "version",
      "characters",
      "recentSessionIds",
    ]);
    const stored = memoryStorage();
    expect(saveRomanceLearning(result.state, stored)).toBe(true);
    expect(loadRomanceLearning(stored).state).toEqual(result.state);
  });

  it("パスポートでは指定した話の選択だけを表示し、不明な話や未選択の話を補完しない", () => {
    const state = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-gentle",
    }).state;
    const choice = getStoryJourneyRoute("mali", "meet", "listen")!
      .wrapChoices[1];
    expect(getJourneyStoryChoice(state, "mali", "meet")).toMatchObject({
      episodeId: "meet",
      routeId: "listen",
      label: choice.label,
      reaction: choice.reaction,
      expression: choice.expression,
    });
    for (const episodeId of ["cafe", "walk", "unknown", "__proto__"])
      expect(getJourneyStoryChoice(state, "mali", episodeId)).toBeUndefined();
    expect(getJourneyStoryChoice(state, "unknown", "meet")).toBeUndefined();
  });

  it("不正な選択記憶の原文は、別の正常な終了を保存しようとしても上書きしない", () => {
    const invalid = recorded();
    Reflect.set(invalid.characters.mali.episodes.meet, "lastStory", {
      routeId: "listen",
      choiceId: "future-choice",
      reaction: "元データ",
    });
    const raw = JSON.stringify(invalid);
    const stored = memoryStorage(raw);
    expect(loadRomanceLearning(stored).status).toBe("invalid");
    const fresh = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-thoughtful",
    }).state;
    expect(saveRomanceLearning(fresh, stored)).toBe(false);
    expect(stored.getItem(ROMANCE_LEARNING_STORAGE_KEY)).toBe(raw);
    expect(stored.writes).toEqual([]);
    expect(getJourneyStoryChoice(fresh, "mali", "meet")).toBeDefined();
  });

  it("保存拒否でもこのタブの選択は参照でき、保存成功を返さない", () => {
    const state = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-gentle",
    }).state;
    expect(
      saveRomanceLearning(state, {
        getItem: () => null,
        setItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
    expect(getJourneyStoryEcho(state, "mali", "cafe")).toEqual(
      getJourneyStoryChoice(state, "mali", "meet"),
    );
  });

  it("別ルートの再演は最新の選択へ更新し、前の記録とコレクションを壊さない", () => {
    const first = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-thoughtful",
    }).state;
    const copy = structuredClone(first);
    const second = completeRomanceLearning(first, {
      ...input("meet", "lead", "another-choice"),
      storyChoiceId: "meet-gentle",
    }).state;
    expect(first).toEqual(copy);
    expect(second.characters.mali.episodes.meet.lastStory).toEqual({
      routeId: "lead",
      choiceId: "meet-gentle",
    });
    expect(second.characters.mali.episodes.meet.routes).toEqual([
      "listen",
      "lead",
    ]);
    expect(getJourneyKeepsakes(second, "mali")).toHaveLength(2);
    const route = getStoryJourneyRoute("mali", "meet", "lead")!;
    const choice = route.wrapChoices.find(
      (entry) => entry.storyChoiceId === "meet-gentle",
    )!;
    expect(getJourneyStoryEcho(second, "mali", "cafe")).toEqual({
      episodeId: "meet",
      routeId: "lead",
      label: choice.label,
      reaction: choice.reaction,
      nextHook: choice.nextHook ?? route.nextHook,
      expression: choice.expression,
    });
  });

  it("古い未保存の終了を再適用しても、他タブの新しい選択へ巻き戻らない", () => {
    const first = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input("meet", "lead", "newer-tab-choice"),
      now: "2026-11-03T10:00:00.000Z",
      storyChoiceId: "meet-gentle",
    }).state;
    const result = completeRomanceLearning(first, {
      ...input("meet", "listen", "older-pending-choice"),
      storyChoiceId: "meet-thoughtful",
    }).state;
    expect(result.characters.mali.episodes.meet.lastCompletedAt).toBe(
      "2026-11-03T10:00:00.000Z",
    );
    expect(result.characters.mali.episodes.meet.lastStory).toEqual({
      routeId: "lead",
      choiceId: "meet-gentle",
    });
    expect(getJourneyStoryEcho(result, "mali", "cafe")).toEqual(
      getJourneyStoryEcho(first, "mali", "cafe"),
    );
    expect(result.characters.mali.episodes.meet.routes).toEqual([
      "lead",
      "listen",
    ]);
  });

  it("新しい終了に選択がなければ、古い再送から過去の選択を推測しない", () => {
    const first = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input("meet", "lead", "newer-legacy-completion"),
      now: "2026-11-03T10:00:00.000Z",
    }).state;
    const result = completeRomanceLearning(first, {
      ...input("meet", "listen", "older-pending-completion"),
      storyChoiceId: "meet-thoughtful",
    }).state;
    expect(result.characters.mali.episodes.meet.lastStory).toBeUndefined();
    expect(getJourneyStoryEcho(result, "mali", "cafe")).toBeUndefined();
  });

  it("選択を送らない旧callerの再訪は、すでに記録した選択を消さない", () => {
    const first = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-thoughtful",
    }).state;
    const result = completeRomanceLearning(
      first,
      input("meet", "lead", "legacy-caller"),
    );
    expect(result.state.characters.mali.episodes.meet.lastStory).toEqual({
      routeId: "listen",
      choiceId: "meet-thoughtful",
    });
    expect(isRomanceLearningState(result.state)).toBe(true);
    expect(result.state.characters.mali.episodes.meet.lastStory).not.toBe(
      first.characters.mali.episodes.meet.lastStory,
    );
  });

  it("重複セッションは、違う選択の再送信でも物語を進め直さない", () => {
    const first = completeRomanceLearning(createEmptyRomanceLearning(), {
      ...input(),
      storyChoiceId: "meet-thoughtful",
    }).state;
    const repeated = completeRomanceLearning(first, {
      ...input("meet", "lead"),
      storyChoiceId: "meet-gentle",
    });
    expect(repeated.receipt.applied).toBe(false);
    expect(repeated.state).toBe(first);
    expect(repeated.state.characters.mali.episodes.meet.lastStory).toEqual({
      routeId: "listen",
      choiceId: "meet-thoughtful",
    });
  });

  it.each(["unknown", "cafe-thoughtful", "meet-dismiss", "", null, 7])(
    "選択IDでない入力 %s を保存しない",
    (bad) => {
      expect(() =>
        completeRomanceLearning(createEmptyRomanceLearning(), {
          ...input(),
          storyChoiceId: bad as unknown as string,
        }),
      ).toThrow();
    },
  );

  it.each([
    null,
    [],
    { routeId: "unknown", choiceId: "meet-thoughtful" },
    { routeId: "lead", choiceId: "meet-thoughtful" },
    { routeId: "listen", choiceId: "cafe-thoughtful" },
    { routeId: "listen", choiceId: "meet-dismiss" },
    { routeId: "listen", choiceId: "meet-thoughtful", prose: "keep out" },
    { routeId: "listen" },
  ])("参照先や記録ルートと整合しないlastStoryを信用しない #%#", (bad) => {
    const state = recorded();
    Reflect.set(state.characters.mali.episodes.meet, "lastStory", bad);
    expect(isRomanceLearningState(state)).toBe(false);
    expect(saveRomanceLearning(state, memoryStorage())).toBe(false);
  });

  it.each(["city", "campus"] as const)(
    "%s では選択した舞台の物語へ解決する",
    (setting) => {
      const plan = getJourneyPlan("mali", "meet", "listen", "male", setting);
      const result = completeRomanceLearning(createEmptyRomanceLearning(), {
        ...input(),
        setting,
        attempts: attempts(plan),
        storyChoiceId: "meet-thoughtful",
      });
      const route = getStoryJourneyRoute("mali", "meet", "listen", setting)!;
      const choice = route.wrapChoices.find(
        (entry) => entry.storyChoiceId === "meet-thoughtful",
      )!;
      expect(
        getJourneyStoryEcho(result.state, "mali", "cafe", setting),
      ).toEqual({
        episodeId: "meet",
        routeId: "listen",
        label: choice.label,
        reaction: choice.reaction,
        nextHook: choice.nextHook ?? route.nextHook,
        expression: choice.expression,
      });
      expect(
        getJourneyStoryEcho(result.state, "mali", "meet", setting),
      ).toBeUndefined();
      expect(
        getJourneyStoryEcho(result.state, "mali", "likes", setting),
      ).toBeUndefined();
      expect(
        getJourneyStoryEcho(result.state, "kiet", "cafe", setting),
      ).toBeUndefined();
      expect(
        getJourneyStoryEcho(result.state, "mali", "unknown", setting),
      ).toBeUndefined();
    },
  );

  it("最終話の記憶は選んだ締めへ解決し、未記録の結末は作らない", () => {
    const plan = getJourneyPlan("mali", "walk", "lead", "male", "campus");
    const state = completeRomanceLearning(recorded(), {
      ...input("walk", "lead", "ending-choice"),
      setting: "campus",
      attempts: attempts(plan),
      storyChoiceId: "walk-gentle",
    }).state;
    const choice = plan.route.wrapChoices.find(
      (entry) => entry.storyChoiceId === "walk-gentle",
    )!;
    expect(getJourneyStoryEnding(state, "mali", "campus")).toEqual({
      episodeId: "walk",
      routeId: "lead",
      label: choice.label,
      reaction: choice.reaction,
      nextHook: choice.nextHook ?? plan.route.nextHook,
      expression: choice.expression,
    });
    expect(getJourneyStoryEnding(state, "kiet", "campus")).toBeUndefined();
  });
});

describe("活動の初回採点と有限のリカバー", () => {
  it("組立では語順・重複・余分な語を正解にせず、未知語は記録しない", () => {
    const build = getJourneyPlan(
      "mali",
      "meet",
      "listen",
      "male",
    ).activities.find((activity) => activity.kind === "build");
    if (!build || build.kind !== "build") throw new Error("Missing builder");
    const right = build.acceptedWordIds[0];
    expect(
      gradeJourneyActivity(build, {
        kind: "build",
        wordIds: [...right].reverse(),
      }).correct,
    ).toBe(false);
    expect(
      gradeJourneyActivity(build, {
        kind: "build",
        wordIds: [...right, right[0]],
      }).correct,
    ).toBe(false);
    expect(
      gradeJourneyActivity(build, { kind: "build", wordIds: [] }).correct,
    ).toBe(false);
    expect(() =>
      gradeJourneyActivity(build, {
        kind: "build",
        wordIds: ["unknown-token"],
      }),
    ).toThrow();
    expect(() =>
      gradeJourneyActivity(build, {
        kind: "choice",
        choiceId: build.question.answerIds[0],
      }),
    ).toThrow();
  });

  it("モデルを採点せず、存在しない選択肢を正誤の対象にしない", () => {
    const plan = getJourneyPlan("mali", "meet", "listen", "male");
    expect(() =>
      gradeJourneyActivity(plan.activities[0], {
        kind: "choice",
        choiceId: "unknown",
      }),
    ).toThrow();
    const response = plan.activities.find(
      (activity) => activity.kind === "respond",
    );
    if (!response) throw new Error("Missing response");
    expect(() =>
      gradeJourneyActivity(response, { kind: "choice", choiceId: "unknown" }),
    ).toThrow();
    expect(() =>
      gradeJourneyActivity(response, { kind: "build", wordIds: [] }),
    ).toThrow();
  });

  it("旧好感度へは本番3問だけを渡し、組立と過去の想起を加算しない", () => {
    const plan = getJourneyPlan("mali", "market", "lead", "male");
    const first = attempts(plan, false);
    const core = getJourneyCoreAnswers(plan, first);
    expect(core).toHaveLength(3);
    expect(core.map((entry) => entry.stepId)).toEqual(
      getRomanceQuestions("mali", "market").map((question) => question.id),
    );
    expect(
      core.every(
        (entry) =>
          !getRomanceQuestions("mali", "market")
            .find((question) => question.id === entry.stepId)
            ?.answerIds.includes(entry.choiceId),
      ),
    ).toBe(true);
  });

  it("各誤答を一度ずつだけリカバーし、やり直しで初回成績を書き換えない", () => {
    const plan = getJourneyPlan("mali", "cafe", "listen", "male");
    const first = attempts(plan, false);
    const repairs = getJourneyRecoveryActivities(plan, first);
    expect(repairs).toHaveLength(5);
    expect(new Set(repairs.map((activity) => activity.id)).size).toBe(5);
    expect(repairs.every((activity) => activity.id.startsWith("repair:"))).toBe(
      true,
    );
    const before = getJourneyCoreAnswers(plan, first);
    repairs.forEach((activity) =>
      expect(gradeJourneyActivity(activity, answer(activity)).correct).toBe(
        true,
      ),
    );
    expect(getJourneyCoreAnswers(plan, first)).toEqual(before);
    expect(getJourneyRecoveryActivities(plan, attempts(plan))).toEqual([]);
    expect(() =>
      getJourneyCoreAnswers(plan, [
        ...first,
        {
          activityId: repairs[0].id,
          response: answer(repairs[0]),
          usedHint: true,
        },
      ]),
    ).toThrow();
  });

  it("未終了・二重回答・未知活動・不明なhint値を受け付けない", () => {
    const plan = getJourneyPlan("mali", "meet", "listen", "male");
    const complete = attempts(plan);
    expect(() => getJourneyCoreAnswers(plan, complete.slice(1))).toThrow();
    expect(() =>
      getJourneyCoreAnswers(plan, [
        complete[0],
        complete[0],
        ...complete.slice(2),
      ]),
    ).toThrow();
    expect(() =>
      getJourneyCoreAnswers(plan, [
        { ...complete[0], activityId: "unknown" },
        ...complete.slice(1),
      ]),
    ).toThrow();
    expect(() =>
      getJourneyCoreAnswers(plan, [
        { ...complete[0], usedHint: "yes" as unknown as boolean },
        ...complete.slice(1),
      ]),
    ).toThrow();
  });
});

describe("関係性とは別の練習と思い出の記録", () => {
  it("空の履歴から旧完了や能力を推定しない", () => {
    const state = createEmptyRomanceLearning();
    expect(getJourneyLearningProgress(state, "mali", "meet")).toBeUndefined();
    expect(getJourneyKeepsakes(state, "mali")).toEqual([]);
    expect(isRomanceLearningState(state)).toBe(true);
    expect(Object.keys(state)).toEqual([
      "version",
      "characters",
      "recentSessionIds",
    ]);
  });

  it("実際の初回活動だけを集計し、お手本常時表示をヒントなし正解としない", () => {
    const start = createEmptyRomanceLearning();
    const copy = structuredClone(start);
    const result = completeRomanceLearning(start, input());
    expect(start).toEqual(copy);
    expect(result.receipt).toEqual({
      applied: true,
      newKeepsake: true,
      summary: {
        correct: 4,
        total: 4,
        coreCorrect: 3,
        coreTotal: 3,
        buildCorrect: 1,
        buildTotal: 1,
        recallCorrect: 0,
        recallTotal: 0,
        hints: 0,
        withoutHintCorrect: 1,
      },
    });
    expect(result.state.characters.mali.episodes.meet).toMatchObject({
      plays: 1,
      routes: ["listen"],
      firstCompletedAt: now,
      lastCompletedAt: now,
    });
    expect(getJourneyKeepsakes(result.state, "mali")).toHaveLength(1);
  });

  it("後の課でもヒントを開いた回答はヒントなしの確認に含めない", () => {
    const next = input("walk");
    next.attempts = next.attempts.map((attempt) => ({
      ...attempt,
      usedHint: true,
    }));
    const result = completeRomanceLearning(createEmptyRomanceLearning(), next);
    expect(result.receipt.summary).toMatchObject({
      correct: 5,
      hints: 5,
      withoutHintCorrect: 0,
      recallTotal: 1,
    });
    expect(getJourneyChapter("walk")?.defaultSupport).toBe("recall");
  });

  it("同じセッションの重複保存は回数と思い出を増やさない", () => {
    const state = recorded();
    const result = completeRomanceLearning(state, input());
    expect(result.receipt.applied).toBe(false);
    expect(result.receipt.newKeepsake).toBe(false);
    expect(result.state).toBe(state);
    expect(
      getJourneyLearningProgress(result.state, "mali", "meet")?.plays,
    ).toBe(1);
  });

  it("別ルートの再訪で別の思い出を集め、同ルートの再演では複製しない", () => {
    const first = recorded();
    const alternate = completeRomanceLearning(
      first,
      input("meet", "lead", "another-session"),
    );
    expect(alternate.receipt.newKeepsake).toBe(true);
    expect(getJourneyKeepsakes(alternate.state, "mali")).toHaveLength(2);
    const repeated = completeRomanceLearning(
      alternate.state,
      input("meet", "lead", "third-session"),
    );
    expect(repeated.receipt.newKeepsake).toBe(false);
    expect(getJourneyKeepsakes(repeated.state, "mali")).toHaveLength(2);
    expect(
      getJourneyLearningProgress(repeated.state, "mali", "meet")?.plays,
    ).toBe(3);
    expect(
      getJourneyLearningProgress(repeated.state, "mali", "meet")
        ?.firstCompletedAt,
    ).toBe(now);
  });

  it("別の相手と話を記録しても先の履歴と思い出を失わない", () => {
    const first = recorded();
    const kiet = getJourneyPlan("kiet", "cafe", "lead", "female");
    const second = completeRomanceLearning(first, {
      characterId: "kiet",
      episodeId: "cafe",
      routeId: "lead",
      gender: "female",
      sessionId: "kiet-session",
      attempts: attempts(kiet),
      now,
    });
    const third = completeRomanceLearning(
      second.state,
      input("cafe", "listen", "cafe-session"),
    );
    expect(third.state.characters.mali.episodes.meet).toEqual(
      first.characters.mali.episodes.meet,
    );
    expect(third.state.characters.kiet).toEqual(second.state.characters.kiet);
    expect(getJourneyKeepsakes(third.state, "mali")).toHaveLength(2);
  });

  it("端末の時計が戻っても練習は続けられ、保存日時の順序は壊さない", () => {
    const state = recorded();
    const result = completeRomanceLearning(state, {
      ...input("meet", "lead", "clock-back"),
      now: "2026-11-01T09:00:00.000Z",
    });
    expect(result.receipt.applied).toBe(true);
    expect(result.state.characters.mali.episodes.meet.lastCompletedAt).toBe(
      now,
    );
    expect(result.state.characters.mali.episodes.meet.firstCompletedAt).toBe(
      now,
    );
    expect(isRomanceLearningState(result.state)).toBe(true);
  });

  it("直近100セッションへ制限しても話と思い出を消さない", () => {
    let state = createEmptyRomanceLearning();
    for (let index = 0; index < 105; index++)
      state = completeRomanceLearning(
        state,
        input("meet", "listen", `session-${index}`),
      ).state;
    expect(state.recentSessionIds).toHaveLength(100);
    expect(state.recentSessionIds[0]).toBe("session-5");
    expect(state.characters.mali.episodes.meet.plays).toBe(105);
    expect(getJourneyKeepsakes(state, "mali")).toHaveLength(1);
  });

  it.each([
    "not-date",
    "2026-02-30T00:00:00Z",
    "2026-11-03T24:00:00Z",
    "2026-11-03T00:60:00Z",
    "2026-11-03T00:00:00+24:00",
  ])("無効な日時%sを保存しない", (invalid) => {
    expect(() =>
      completeRomanceLearning(createEmptyRomanceLearning(), {
        ...input(),
        now: invalid,
      }),
    ).toThrow();
  });
});

describe("独立した保存の検証と原文保護", () => {
  it("有効な記録は新しいキーだけへ保存し、読込みでは書き込まない", () => {
    const storage = memoryStorage();
    expect(loadRomanceLearning(storage).status).toBe("empty");
    expect(storage.writes).toEqual([]);
    const state = recorded();
    expect(saveRomanceLearning(state, storage)).toBe(true);
    expect(storage.writes).toEqual([ROMANCE_LEARNING_STORAGE_KEY]);
    expect(loadRomanceLearning(storage)).toEqual({ state, status: "loaded" });
    expect(storage.writes).toHaveLength(1);
  });

  it.each([
    "{broken",
    '{"version":99,"future":"keep"}',
    '{"version":1,"characters":null,"recentSessionIds":[]}',
  ])("未知・壊れた元データを上書きしない: %s", (raw) => {
    const storage = memoryStorage(raw);
    expect(loadRomanceLearning(storage).status).toBe("invalid");
    expect(storage.raw).toBe(raw);
    expect(saveRomanceLearning(recorded(), storage)).toBe(false);
    expect(storage.writes).toEqual([]);
    expect(replaceRomanceLearning(recorded(), storage)).toBe(true);
    expect(loadRomanceLearning(storage).status).toBe("loaded");
  });

  it("拒否された読み書きとSSRを例外で落とさない", () => {
    const denied = {
      getItem() {
        throw new Error("Denied");
      },
      setItem() {
        throw new Error("Denied");
      },
    };
    expect(loadRomanceLearning(denied).status).toBe("unavailable");
    expect(saveRomanceLearning(recorded(), denied)).toBe(false);
    expect(replaceRomanceLearning(recorded(), denied)).toBe(false);
    expect(loadRomanceLearning().status).toBe("unavailable");
    expect(saveRomanceLearning(recorded())).toBe(false);
  });

  it.each([
    (value: Record<string, unknown>) => {
      value.version = 2;
    },
    (value: Record<string, unknown>) => {
      value.extra = "unknown";
    },
    (value: Record<string, unknown>) => {
      value.recentSessionIds = ["dup", "dup"];
    },
    (value: Record<string, unknown>) => {
      value.recentSessionIds = ["spaces invalid"];
    },
    (value: Record<string, unknown>) => {
      value.characters = { unknown: { episodes: {} } };
    },
  ])("不正なstate外形を信頼しない #%#", (corrupt) => {
    const value: Record<string, unknown> = { ...structuredClone(recorded()) };
    corrupt(value);
    expect(isRomanceLearningState(value)).toBe(false);
  });

  it.each([
    ["plays", 0],
    ["plays", -1],
    ["plays", Infinity],
    ["plays", NaN],
    ["routes", []],
    ["routes", ["listen", "listen"]],
    ["routes", ["unknown"]],
    ["firstCompletedAt", "2026-02-30T00:00:00Z"],
    ["lastCompletedAt", "2025-11-03T00:00:00Z"],
  ])("不正な話の記録 %s を拒む", (key, bad) => {
    const value = structuredClone(recorded());
    Reflect.set(value.characters.mali.episodes.meet, key, bad);
    expect(isRomanceLearningState(value)).toBe(false);
  });

  it.each([
    ["total", 99],
    ["correct", 99],
    ["coreCorrect", -1],
    ["buildCorrect", 2],
    ["recallCorrect", 1],
    ["hints", 99],
    ["withoutHintCorrect", 4],
    ["coreTotal", 4],
    ["buildTotal", 0],
    ["recallTotal", 1],
  ])("実施した活動と一致しない集計 %s を拒む", (key, bad) => {
    const value = structuredClone(recorded());
    Reflect.set(value.characters.mali.episodes.meet.last, key, bad);
    expect(isRomanceLearningState(value)).toBe(false);
  });

  it("未知の話・余分な保存項目・範囲外の回数では書き込まない", () => {
    const storage = memoryStorage();
    const value = structuredClone(recorded());
    value.characters.mali.episodes.unknown =
      value.characters.mali.episodes.meet;
    expect(isRomanceLearningState(value)).toBe(false);
    expect(saveRomanceLearning(value, storage)).toBe(false);
    expect(storage.writes).toEqual([]);
  });
});

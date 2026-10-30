import { describe, expect, it } from "vitest";
import { alphabetCharacters } from "@/data/alphabet";
import {
  CHARACTER_TRAINING_PRESETS,
  DEFAULT_CHARACTER_SELECTION,
  getCharacterTrainingCue,
  getCharacterTrainingReading,
} from "@/data/character-training";
import {
  createCharacterTrainingSession,
  getCharacterTrainingModeAvailability,
  gradeCharacterTrainingQuestion,
  MAX_TRAINING_CHARACTERS,
  MIN_TRAINING_CHARACTERS,
  TRAINING_ROUND_SIZE,
  type TrainerQuestion,
} from "@/lib/character-trainer";
import { isThaiSpeechText } from "@/lib/device-speech";

function entry(id: string) {
  const character = alphabetCharacters.find((item) => item.id === id);
  if (!character) throw new Error(`Missing test character: ${id}`);
  return character;
}

const defaultInput = {
  selectedIds: DEFAULT_CHARACTER_SELECTION,
  mode: "mixed" as const,
  seed: 42,
};

describe("文字トレーニングの教材参照", () => {
  it("44文字の名前の手掛かりを区別し、字母や廃用字の注記を漏らさない", () => {
    const cues = alphabetCharacters.map(getCharacterTrainingCue);
    expect(alphabetCharacters).toHaveLength(44);
    expect(cues).toEqual([
      "鶏",
      "卵",
      "瓶",
      "水牛",
      "人",
      "鐘",
      "蛇",
      "皿",
      "小型シンバル",
      "象",
      "鎖",
      "木",
      "女性",
      "冠",
      "突き棒",
      "台・基礎",
      "モントー夫人",
      "年長者",
      "沙弥",
      "子ども",
      "亀",
      "袋",
      "兵士",
      "旗",
      "ねずみ",
      "葉",
      "魚",
      "蜂",
      "蓋",
      "台付き盆",
      "歯",
      "ジャンク船",
      "馬",
      "鬼",
      "舟",
      "猿",
      "指輪",
      "東屋",
      "仙人",
      "虎",
      "箱",
      "星形の凧",
      "水鉢",
      "フクロウ",
    ]);
    expect(new Set(cues).size).toBe(44);
    for (const character of alphabetCharacters) {
      const cue = getCharacterTrainingCue(character.id);
      expect(cue).not.toMatch(/[\u0e00-\u0e7f]/u);
      expect(character.meaning).toContain(`${cue}の ${character.thai}`);
      expect(character.verification).toBe("unreviewed");
    }
  });

  it("未確認の名前の形式を推測で補わない", () => {
    expect(() => getCharacterTrainingCue("unknown")).toThrow();
    expect(() =>
      getCharacterTrainingCue({ ...entry("ko-kai"), meaning: "鶏" }),
    ).toThrow();
    expect(() =>
      getCharacterTrainingCue({ ...entry("ko-kai"), meaning: "กの ก" }),
    ).toThrow();
  });

  it("44文字の読みの手掛かりは既存の最初の音節のIPAと一意なUnicode名から取り出す", () => {
    const before = JSON.stringify(alphabetCharacters);
    const readings = alphabetCharacters.map(getCharacterTrainingReading);
    expect(new Set(readings.map((reading) => reading.romanizedName)).size).toBe(
      44,
    );
    for (const character of alphabetCharacters) {
      const reading = getCharacterTrainingReading(character.id);
      expect(reading.ipa).toBe(character.ipa);
      expect(`THAI CHARACTER ${reading.romanizedName.toUpperCase()}`).toBe(
        character.unicodeName,
      );
      expect(reading.romanizedName).toMatch(/^[a-z]+(?: [a-z]+)*$/);
      expect(reading.ipa + reading.romanizedName).not.toMatch(
        /[\u0e00-\u0e7f]/u,
      );
    }
    expect(getCharacterTrainingReading("ngo-ngu")).toEqual({
      ipa: entry("ngo-ngu").ipa,
      romanizedName: "ngo ngu",
    });
    expect(JSON.stringify(alphabetCharacters)).toBe(before);
  });

  it("Unicode名の非標準な形式や不明な文字の読みを推測しない", () => {
    expect(() => getCharacterTrainingReading("unknown")).toThrow();
    for (const unicodeName of [
      "THAI CHARACTER ngo ngu",
      "THAI CHARACTER  NGO NGU",
      "THAI CHAR NGO NGU",
      "THAI CHARACTER NGO NGU\n",
      "THAI CHARACTER NGO งู",
      "THAI CHARACTER NGO-NGU",
    ]) {
      expect(() =>
        getCharacterTrainingReading({ ...entry("ngo-ngu"), unicodeName }),
      ).toThrow();
    }
    expect(() =>
      getCharacterTrainingReading({ ...entry("ngo-ngu"), ipa: "" }),
    ).toThrow();
  });

  it("全プリセットが既存の2〜8文字だけを参照し、既定はก・ม・น・ง", () => {
    expect(DEFAULT_CHARACTER_SELECTION.map((id) => entry(id).thai)).toEqual([
      "ก",
      "ม",
      "น",
      "ง",
    ]);
    expect(
      CHARACTER_TRAINING_PRESETS.slice(0, 5).map((preset) => preset.id),
    ).toEqual(["first-four", "basic-eight", "shape-a", "shape-b", "shape-c"]);
    for (const preset of CHARACTER_TRAINING_PRESETS) {
      expect(preset.characterIds.length).toBeGreaterThanOrEqual(
        MIN_TRAINING_CHARACTERS,
      );
      expect(preset.characterIds.length).toBeLessThanOrEqual(
        MAX_TRAINING_CHARACTERS,
      );
      expect(new Set(preset.characterIds).size).toBe(
        preset.characterIds.length,
      );
      for (const id of preset.characterIds) expect(entry(id)).toBeDefined();
      expect(
        createCharacterTrainingSession({
          ...defaultInput,
          selectedIds: preset.characterIds,
        }).questions,
      ).toHaveLength(8);
    }
  });

  it("選択肢生成・採点が既存の結合文字、IPA、確認状況や選択配列を変更しない", () => {
    const before = JSON.stringify(alphabetCharacters);
    const selectedIds = Object.freeze([...DEFAULT_CHARACTER_SELECTION]);
    const session = createCharacterTrainingSession({
      ...defaultInput,
      selectedIds,
    });
    session.questions.forEach((question) =>
      gradeCharacterTrainingQuestion(question, question.correctOptionId),
    );
    expect(JSON.stringify(alphabetCharacters)).toBe(before);
    expect(selectedIds).toEqual(DEFAULT_CHARACTER_SELECTION);
    expect(session.selectedIds).not.toBe(selectedIds);
    expect(entry("mo-ma").name).toBe("ม ม้า");
    expect(entry("lo-chula").example?.thai).toBe("กีฬา");
  });
});

describe("出題順と選択範囲", () => {
  it("同じseedは再現でき、別seedでは出題を混ぜる", () => {
    const first = createCharacterTrainingSession(defaultInput);
    expect(createCharacterTrainingSession(defaultInput)).toEqual(first);
    expect(
      createCharacterTrainingSession({ ...defaultInput, seed: 43 }).questions,
    ).not.toEqual(first.questions);
    expect(
      createCharacterTrainingSession({ ...defaultInput, seed: 0 }).questions,
    ).toHaveLength(8);
    expect(
      createCharacterTrainingSession({ ...defaultInput, seed: 0xffffffff })
        .questions,
    ).toHaveLength(8);
    expect(first.questions.map((question) => question.id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `training-42:q${index + 1}`),
    );
    expect(
      createCharacterTrainingSession({
        ...defaultInput,
        sessionId: "custom-session",
      }).id,
    ).toBe("custom-session");
  });

  it("2〜8文字のどの選択でも8問に均等に登場し、文字選択肢は選択範囲内", () => {
    for (let size = 2; size <= 8; size += 1) {
      const selectedIds = alphabetCharacters
        .slice(0, size)
        .map((character) => character.id);
      for (const seed of [0, 17, 255]) {
        const session = createCharacterTrainingSession({
          selectedIds,
          mode: "name-to-letter",
          seed,
        });
        expect(session.questions).toHaveLength(TRAINING_ROUND_SIZE);
        const counts = selectedIds.map(
          (id) =>
            session.questions.filter((question) => question.targetId === id)
              .length,
        );
        expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
          1,
        );
        for (const question of session.questions) {
          expect(selectedIds).toContain(question.targetId);
          expect(question.options.length).toBeGreaterThanOrEqual(2);
          expect(question.options.length).toBeLessThanOrEqual(4);
          expect(
            new Set(question.options.map((option) => option.id)).size,
          ).toBe(question.options.length);
          expect(
            question.options.filter(
              (option) => option.id === question.correctOptionId,
            ),
          ).toHaveLength(1);
          expect(question.prompt).not.toContain(entry(question.targetId).thai);
          expect(question.cue).toBe(entry(question.targetId).ipa);
          expect(question.readingName).toBe(
            getCharacterTrainingReading(question.targetId).romanizedName,
          );
          for (const option of question.options) {
            expect(selectedIds).toContain(option.id);
            expect(option.label).toBe(entry(option.id).thai);
          }
        }
      }
    }
  });

  it("廃用字を含めた44文字すべてをカスタム選択で練習できる", () => {
    for (const target of alphabetCharacters) {
      const companion = target.id === "ko-kai" ? "mo-ma" : "ko-kai";
      const session = createCharacterTrainingSession({
        selectedIds: [target.id, companion],
        mode: "name-to-letter",
        seed: 1,
      });
      expect(
        session.questions.some((question) => question.targetId === target.id),
      ).toBe(true);
    }
    expect(entry("kho-khuat").usage).toBe("obsolete");
    expect(entry("kho-khon").usage).toBe("obsolete");
  });

  it("mixedは両形式を4問ずつ、単独モードは指定形式だけ出す", () => {
    const mixed = createCharacterTrainingSession(defaultInput);
    expect(
      mixed.questions.filter((question) => question.kind === "name-to-letter"),
    ).toHaveLength(4);
    expect(
      mixed.questions.filter((question) => question.kind === "letter-to-sound"),
    ).toHaveLength(4);
    expect(mixed.soundFallback).toBe(false);
    for (const mode of ["name-to-letter", "letter-to-sound"] as const) {
      expect(
        createCharacterTrainingSession({
          ...defaultInput,
          mode,
        }).questions.every((question) => question.kind === mode),
      ).toBe(true);
    }
  });
});

describe("同音字と別読みの扱い", () => {
  it("同じ音の選択肢を重複させず、音から字母を一意に選ばせない", () => {
    const selectedIds = ["kho-khai", "kho-khwai", "ko-kai"];
    const session = createCharacterTrainingSession({
      selectedIds,
      mode: "letter-to-sound",
      seed: 7,
    });
    for (const question of session.questions) {
      expect(question.cue).toBe(entry(question.targetId).thai);
      expect(question.options.map((option) => option.label).sort()).toEqual([
        "/k/",
        "/kʰ/",
      ]);
      expect(question.correctOptionId).toBe(
        `ipa:${entry(question.targetId).initialIpa}`,
      );
      expect(
        gradeCharacterTrainingQuestion(question, question.correctOptionId)
          .correct,
      ).toBe(true);
    }
  });

  it("同音だけのセットでは音モードを開始せず、mixedは名前問題に切り替える", () => {
    const selectedIds = ["kho-khai", "kho-khwai"];
    expect(getCharacterTrainingModeAvailability(selectedIds)).toEqual({
      soundAvailable: false,
      soundFallbackReason: expect.any(String),
    });
    expect(() =>
      createCharacterTrainingSession({
        selectedIds,
        mode: "letter-to-sound",
        seed: 1,
      }),
    ).toThrow();
    const mixed = createCharacterTrainingSession({
      selectedIds,
      mode: "mixed",
      seed: 1,
    });
    expect(mixed.soundFallback).toBe(true);
    expect(mixed.mode).toBe("mixed");
    expect(
      mixed.questions.every((question) => question.kind === "name-to-letter"),
    ).toBe(true);
  });

  it("ฑの別読み/d/を誤答に使わず、対立できる音がないセットでは音問題を停止する", () => {
    for (const selectedIds of [
      ["tho-nangmontho", "do-dek"],
      ["tho-nangmontho", "do-dek", "tho-thung"],
    ]) {
      expect(
        getCharacterTrainingModeAvailability(selectedIds).soundAvailable,
      ).toBe(false);
      expect(() =>
        createCharacterTrainingSession({
          selectedIds,
          mode: "letter-to-sound",
          seed: 3,
        }),
      ).toThrow();
    }
    const selectedIds = ["tho-nangmontho", "do-dek", "ko-kai"];
    expect(
      getCharacterTrainingModeAvailability(selectedIds).soundAvailable,
    ).toBe(true);
    const session = createCharacterTrainingSession({
      selectedIds,
      mode: "letter-to-sound",
      seed: 3,
    });
    const questions = session.questions.filter(
      (question) => question.targetId === "tho-nangmontho",
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      expect(question.options.map((option) => option.label).sort()).toEqual([
        "/k/",
        "/tʰ/",
      ]);
      expect(() =>
        gradeCharacterTrainingQuestion(question, "ipa:/d/"),
      ).toThrow();
    }
  });

  it("全44文字のペアで、提示された音に正解が一つだけある", () => {
    for (let first = 0; first < alphabetCharacters.length; first += 1) {
      for (
        let second = first + 1;
        second < alphabetCharacters.length;
        second += 1
      ) {
        const selectedIds = [
          alphabetCharacters[first].id,
          alphabetCharacters[second].id,
        ];
        if (!getCharacterTrainingModeAvailability(selectedIds).soundAvailable)
          continue;
        const session = createCharacterTrainingSession({
          selectedIds,
          mode: "letter-to-sound",
          seed: 10,
        });
        for (const question of session.questions) {
          const target = entry(question.targetId);
          const accepted = [
            target.initialIpa,
            ...(target.alternateInitialIpa ?? []),
          ];
          expect(
            question.options.filter((option) =>
              accepted.includes(option.label),
            ),
          ).toHaveLength(1);
          expect(
            question.options.filter(
              (option) => !accepted.includes(option.label),
            ),
          ).toHaveLength(1);
          for (const option of question.options)
            expect(
              selectedIds.some((id) => entry(id).initialIpa === option.label),
            ).toBe(true);
        }
      }
    }
  });
});

describe("読み方から文字を選ぶ練習", () => {
  it("全44文字の問題には既存IPAと英字名を示し、日本語の意味やThai名を手掛かりにしない", () => {
    for (const target of alphabetCharacters) {
      const companion = target.id === "ko-kai" ? "mo-ma" : "ko-kai";
      const session = createCharacterTrainingSession({
        selectedIds: [target.id, companion],
        mode: "name-to-letter",
        seed: 9,
      });
      for (const question of session.questions) {
        const character = entry(question.targetId);
        const reading = getCharacterTrainingReading(character);
        expect(question.prompt).toBe("この読み方の文字は？");
        expect(question.cue).toBe(reading.ipa);
        expect(question.readingName).toBe(reading.romanizedName);
        expect(question.audioText).toBeUndefined();
        const text = question.prompt + question.cue + question.readingName;
        expect(text).not.toContain(getCharacterTrainingCue(character));
        expect(text).not.toMatch(/[\u0e00-\u0e7f]/u);
        expect(
          gradeCharacterTrainingQuestion(question, question.targetId).correct,
        ).toBe(true);
      }
    }
  });

  it("最初の音節のIPAが同じでもUnicode名全体で文字を区別する", () => {
    const selectedIds = ["kho-khwai", "kho-rakhang"];
    expect(entry(selectedIds[0]).ipa).toBe(entry(selectedIds[1]).ipa);
    for (const mode of ["name-to-letter", "mixed"] as const) {
      const session = createCharacterTrainingSession({
        selectedIds,
        mode,
        seed: 8,
      });
      expect(
        session.questions.every(
          (question) => question.kind === "name-to-letter",
        ),
      ).toBe(true);
      expect(
        new Set(session.questions.map((question) => question.readingName)).size,
      ).toBe(2);
      for (const question of session.questions) {
        expect(question.prompt).toBe("この読み方の文字は？");
        expect(
          gradeCharacterTrainingQuestion(question, question.targetId).correct,
        ).toBe(true);
      }
    }
  });

  it("IPAや英字名の欠落・改変、日本語の意味への差戻しを採点しない", () => {
    const question = createCharacterTrainingSession({
      ...defaultInput,
      mode: "name-to-letter",
    }).questions[0];
    const target = entry(question.targetId);
    const other = entry(
      DEFAULT_CHARACTER_SELECTION.find((id) => id !== question.targetId)!,
    );
    const brokenQuestions: TrainerQuestion[] = [
      { ...question, readingName: undefined },
      {
        ...question,
        readingName: getCharacterTrainingReading(other).romanizedName,
      },
      { ...question, readingName: target.name },
      { ...question, readingName: `${question.readingName} ` },
      { ...question, cue: target.initialIpa },
      { ...question, cue: `${target.ipa} ` },
      { ...question, cue: getCharacterTrainingCue(target) },
      {
        ...question,
        prompt: `「${getCharacterTrainingCue(target)}」の文字は？`,
      },
    ];
    for (const broken of brokenQuestions) {
      expect(() =>
        gradeCharacterTrainingQuestion(broken, question.correctOptionId),
      ).toThrow();
    }
  });
});

describe("字母名を聞いて文字を選ぶ練習", () => {
  it("44文字の既存の字母名は区別でき、Thai合成音声の入力形式を満たす", () => {
    const before = JSON.stringify(alphabetCharacters);
    expect(
      new Set(alphabetCharacters.map((character) => character.name)).size,
    ).toBe(44);
    for (const target of alphabetCharacters) {
      expect(isThaiSpeechText(target.name)).toBe(true);
      const companion = target.id === "ko-kai" ? "mo-ma" : "ko-kai";
      const session = createCharacterTrainingSession({
        selectedIds: [target.id, companion],
        mode: "audio-to-letter",
        seed: 4,
      });
      const question = session.questions.find(
        (item) => item.targetId === target.id,
      )!;
      expect(question.audioText).toBe(target.name);
      expect(question.cue).toBe("");
      expect(question.prompt).toBe("聞こえた名前の文字は？");
      expect(question.prompt).not.toContain(target.thai);
      expect(question.prompt).not.toContain(getCharacterTrainingCue(target));
      expect(gradeCharacterTrainingQuestion(question, target.id)).toMatchObject(
        {
          characterId: target.id,
          kind: "audio-to-letter",
          correct: true,
        },
      );
    }
    expect(JSON.stringify(alphabetCharacters)).toBe(before);
  });

  it("音声モードでも2〜8の選択文字だけを均等に出題し、2〜4つの字形から選ぶ", () => {
    for (let size = 2; size <= 8; size += 1) {
      const selectedIds = alphabetCharacters
        .slice(0, size)
        .map((character) => character.id);
      const input = { selectedIds, mode: "audio-to-letter" as const, seed: 12 };
      const session = createCharacterTrainingSession(input);
      expect(session).toEqual(createCharacterTrainingSession(input));
      expect(session.questions).toHaveLength(TRAINING_ROUND_SIZE);
      expect(session.soundFallback).toBe(false);
      const counts = selectedIds.map(
        (id) =>
          session.questions.filter((question) => question.targetId === id)
            .length,
      );
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      for (const question of session.questions) {
        expect(question.kind).toBe("audio-to-letter");
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.options.length).toBeLessThanOrEqual(4);
        expect(question.correctOptionId).toBe(question.targetId);
        expect(new Set(question.options.map((option) => option.id)).size).toBe(
          question.options.length,
        );
        for (const option of question.options) {
          expect(selectedIds).toContain(option.id);
          expect(option.label).toBe(entry(option.id).thai);
        }
      }
    }
  });

  it("初頭音が同じ文字や別読みを持つ文字も、全文の字母名で区別する", () => {
    for (const selectedIds of [
      ["kho-khai", "kho-khwai"],
      ["tho-nangmontho", "do-dek"],
    ]) {
      expect(
        getCharacterTrainingModeAvailability(selectedIds).soundAvailable,
      ).toBe(false);
      const session = createCharacterTrainingSession({
        selectedIds,
        mode: "audio-to-letter",
        seed: 5,
      });
      expect(session.soundFallback).toBe(false);
      expect(
        new Set(session.questions.map((question) => question.audioText)).size,
      ).toBe(2);
      for (const question of session.questions) {
        expect(question.kind).toBe("audio-to-letter");
        expect(question.options.map((option) => option.id).sort()).toEqual(
          [...selectedIds].sort(),
        );
        expect(
          gradeCharacterTrainingQuestion(question, question.targetId).correct,
        ).toBe(true);
        const wrong = selectedIds.find((id) => id !== question.targetId)!;
        expect(gradeCharacterTrainingQuestion(question, wrong).correct).toBe(
          false,
        );
        expect(gradeCharacterTrainingQuestion(question, null).correct).toBe(
          false,
        );
      }
    }
  });

  it("音声文の欠落・改変、文字の手掛かりの混入、全文名を表示した選択肢を採点しない", () => {
    const question = createCharacterTrainingSession({
      ...defaultInput,
      mode: "audio-to-letter",
    }).questions[0];
    const target = entry(question.targetId);
    const brokenQuestions: TrainerQuestion[] = [
      { ...question, audioText: undefined },
      { ...question, audioText: target.name.normalize("NFD") + " " },
      { ...question, audioText: target.thai },
      { ...question, audioText: target.initialIpa },
      { ...question, cue: target.thai },
      { ...question, cue: getCharacterTrainingCue(target) },
      { ...question, prompt: target.name },
      {
        ...question,
        options: question.options.map((option) => ({
          ...option,
          label: entry(option.id).name,
        })),
      },
    ];
    for (const broken of brokenQuestions) {
      expect(() =>
        gradeCharacterTrainingQuestion(broken, question.correctOptionId),
      ).toThrow();
    }
  });
});

describe("入力の検証と採点", () => {
  it("不正な選択数、重複、存在しない文字を開始時に拒否する", () => {
    const invalidSelections = [
      [],
      ["ko-kai"],
      ["ko-kai", "ko-kai"],
      ["ko-kai", "unknown"],
      alphabetCharacters.slice(0, 9).map((character) => character.id),
    ];
    for (const selectedIds of invalidSelections) {
      expect(() =>
        createCharacterTrainingSession({ ...defaultInput, selectedIds }),
      ).toThrow();
      expect(
        getCharacterTrainingModeAvailability(selectedIds).soundAvailable,
      ).toBe(false);
    }
    expect(() =>
      createCharacterTrainingSession({
        ...defaultInput,
        // @ts-expect-error 保存データ等から不正な実行時の値が渡された場合も拒否する。
        selectedIds: null,
      }),
    ).toThrow();
    expect(() =>
      createCharacterTrainingSession({
        ...defaultInput,
        // @ts-expect-error 不正なモードを実行時にも検証する。
        mode: "listening",
      }),
    ).toThrow();
  });

  it("有限な32bit整数以外のseed、不正なセッションIDを拒否する", () => {
    for (const seed of [
      -1,
      0.2,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0x100000000,
    ]) {
      expect(() =>
        createCharacterTrainingSession({ ...defaultInput, seed }),
      ).toThrow();
    }
    expect(() =>
      createCharacterTrainingSession({
        ...defaultInput,
        // @ts-expect-error 数字文字列も整数seedとは扱わない。
        seed: "1",
      }),
    ).toThrow();
    for (const sessionId of [
      "",
      "a b",
      "a".repeat(101),
      "constructor",
      "prototype",
      "__proto__",
    ]) {
      expect(() =>
        createCharacterTrainingSession({ ...defaultInput, sessionId }),
      ).toThrow();
    }
  });

  it("確定回答・誤答・スキップを区別し、問題を書き換えない", () => {
    for (const question of createCharacterTrainingSession(defaultInput)
      .questions) {
      const snapshot = JSON.stringify(question);
      expect(
        gradeCharacterTrainingQuestion(question, question.correctOptionId),
      ).toEqual({
        questionId: question.id,
        characterId: question.targetId,
        kind: question.kind,
        selectedOptionId: question.correctOptionId,
        correct: true,
      });
      const wrong = question.options.find(
        (option) => option.id !== question.correctOptionId,
      )!;
      expect(gradeCharacterTrainingQuestion(question, wrong.id).correct).toBe(
        false,
      );
      expect(gradeCharacterTrainingQuestion(question, null)).toMatchObject({
        correct: false,
        selectedOptionId: null,
      });
      expect(() =>
        gradeCharacterTrainingQuestion(question, "not-offered"),
      ).toThrow();
      expect(JSON.stringify(question)).toBe(snapshot);
    }
  });

  it("正答の改変、選択肢の欠落・重複、字形や音との不整合を採点しない", () => {
    const question = createCharacterTrainingSession({
      ...defaultInput,
      mode: "name-to-letter",
    }).questions[0];
    const brokenQuestions: TrainerQuestion[] = [
      { ...question, targetId: "unknown" },
      { ...question, correctOptionId: "not-offered" },
      { ...question, options: [question.options[0]] },
      { ...question, options: [question.options[0], question.options[0]] },
      {
        ...question,
        options: question.options.map((option) => ({
          ...option,
          label: "wrong glyph",
        })),
      },
    ];
    for (const broken of brokenQuestions)
      expect(() => gradeCharacterTrainingQuestion(broken, null)).toThrow();
    const alternateQuestion = createCharacterTrainingSession({
      selectedIds: ["tho-nangmontho", "do-dek", "ko-kai"],
      mode: "letter-to-sound",
      seed: 3,
    }).questions.find((item) => item.targetId === "tho-nangmontho")!;
    expect(() =>
      gradeCharacterTrainingQuestion(
        {
          ...alternateQuestion,
          options: [
            ...alternateQuestion.options,
            { id: "ipa:/d/", label: "/d/" },
          ],
        },
        "ipa:/d/",
      ),
    ).toThrow();
  });
});

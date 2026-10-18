import { describe, expect, it } from "vitest";
import { compareThaiAnswer } from "@/lib/answer-comparison";

describe("Thai文字列の完全一致（発音採点ではない）", () => {
  it("前後の空白だけを除き、登録した回答のどれかと比較する", () => {
    expect(compareThaiAnswer(" \tข้าว\n", ["ข่าว", "ข้าว"])).toEqual({
      status: "correct",
      value: "ข้าว",
    });
    expect(compareThaiAnswer("กา", [" กา "])).toEqual({
      status: "correct",
      value: "กา",
    });
  });

  it("声調記号・母音記号・子音の違いを取り除かない", () => {
    for (const input of ["ข่าว", "ขาว", "ข่า", "ข้าวว", "เข้า"]) {
      expect(compareThaiAnswer(input, ["ข้าว"])).toEqual({
        status: "incorrect",
        value: input,
      });
    }
  });

  it("語中の空白・改行・ゼロ幅文字を結合も除去もしない", () => {
    for (const input of ["ข้ าว", "ข้  าว", "ข้\nาว", "ข้าว\u200b"]) {
      expect(compareThaiAnswer(input, ["ข้าว"]).status).toBe("incorrect");
    }
  });

  it("Unicode正規化や結合記号の並べ替えをしない", () => {
    // U+0E33をNFKDで分解した列や、声調記号の順序が違う列は同一にしない。
    expect(compareThaiAnswer("น\u0e4d\u0e32", ["นำ"])).toEqual({
      status: "incorrect",
      value: "น\u0e4d\u0e32",
    });
    expect(compareThaiAnswer("น\u0e33\u0e49", ["น้ำ"])).toEqual({
      status: "incorrect",
      value: "น\u0e33\u0e49",
    });
    const decomposed = "e\u0301";
    expect(compareThaiAnswer(decomposed, ["é"])).toEqual({
      status: "incorrect",
      value: decomposed,
    });
  });

  it("空入力は未回答として返す", () => {
    expect(compareThaiAnswer(" \n\t", ["กา"])).toEqual({
      status: "empty",
      value: "",
    });
  });

  it("上限200文字を守り、長すぎる入力・回答データは不正とする", () => {
    const boundary = "ก".repeat(200);
    expect(compareThaiAnswer(boundary, [boundary]).status).toBe("correct");
    expect(compareThaiAnswer(`${boundary}ก`, ["กา"]).status).toBe("invalid");
    expect(compareThaiAnswer("กา", [`${boundary}ก`]).status).toBe("invalid");
    expect(compareThaiAnswer(` ${boundary}`, [boundary]).status).toBe(
      "invalid",
    );
  });

  it("回答データに空欄が混ざっていれば、偶然の一致を正解にしない", () => {
    expect(compareThaiAnswer("กา", [])).toEqual({
      status: "invalid",
      value: "กา",
    });
    expect(compareThaiAnswer("กา", ["กา", " "])).toEqual({
      status: "invalid",
      value: "กา",
    });
    expect(compareThaiAnswer("", [])).toEqual({ status: "invalid", value: "" });
    expect(compareThaiAnswer("กา", Array<string>(1)).status).toBe("invalid");
  });

  it("外部データが型に違反しても文字列へ勝手に変換しない", () => {
    expect(
      Reflect.apply(compareThaiAnswer, undefined, [undefined, ["กา"]]),
    ).toEqual({ status: "invalid", value: "" });
    expect(Reflect.apply(compareThaiAnswer, undefined, ["กา", null])).toEqual({
      status: "invalid",
      value: "กา",
    });
    expect(
      Reflect.apply(compareThaiAnswer, undefined, ["กา", ["กา", 3]]),
    ).toEqual({ status: "invalid", value: "กา" });
  });

  it("入力や登録済み回答を変更しない", () => {
    const answers = Object.freeze(["ข้าว", "ข่าว"]);
    expect(compareThaiAnswer(" ข้าว ", answers).status).toBe("correct");
    expect(answers).toEqual(["ข้าว", "ข่าว"]);
  });
});

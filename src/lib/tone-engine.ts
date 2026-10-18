import type { ConsonantClass } from "@/lib/content-types";
import {
  consonantClassLabels,
  toneLabels,
  toneMarkLabels,
  type SyllableAnalysis,
  type Tone,
  type ToneResult,
} from "@/lib/tone-types";

const analysisKeys = [
  "consonantClass",
  "vowelLength",
  "codaType",
  "toneMark",
  "onsetRule",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 保存値や外部データに対しても、型アサーションで検証を省略しない。 */
export function isSyllableAnalysis(value: unknown): value is SyllableAnalysis {
  return (
    isRecord(value) &&
    Object.keys(value).length === analysisKeys.length &&
    analysisKeys.every((key) => Object.hasOwn(value, key)) &&
    (value.consonantClass === "mid" ||
      value.consonantClass === "high" ||
      value.consonantClass === "low") &&
    (value.vowelLength === "short" || value.vowelLength === "long") &&
    (value.codaType === "none" ||
      value.codaType === "sonorant" ||
      value.codaType === "stop") &&
    (value.toneMark === "none" ||
      value.toneMark === "mai-ek" ||
      value.toneMark === "mai-tho" ||
      value.toneMark === "mai-tri" ||
      value.toneMark === "mai-chattawa") &&
    (value.onsetRule === "single" ||
      value.onsetRule === "true-cluster" ||
      value.onsetRule === "ho-nam" ||
      value.onsetRule === "o-nam")
  );
}

/**
 * 現代標準タイ語の基本表を適用する。タイ語文字列の自動分解は行わない。
 * 単一の発音済み音節について、母音長・末音・子音クラス等が既知であることが前提。
 * ho-nam / o-nam が使える綴りかどうかは、呼出側の辞書・教材で確認する。
 */
export function determineTone(value: unknown): ToneResult {
  if (!isSyllableAnalysis(value)) {
    return {
      status: "unknown",
      reason:
        "この音節の分析情報が不足しているか、対応する形式ではありません。",
      steps: [],
    };
  }

  const analysis = value;
  const steps: string[] = [];
  let effectiveClass: ConsonantClass = analysis.consonantClass;

  if (analysis.onsetRule === "ho-nam" || analysis.onsetRule === "o-nam") {
    if (analysis.consonantClass !== "low") {
      return {
        status: "unknown",
        reason:
          "この先行子音規則では、発音する側の子音を低子音として指定してください。",
        steps,
      };
    }
    effectiveClass = analysis.onsetRule === "ho-nam" ? "high" : "mid";
    steps.push(
      analysis.onsetRule === "ho-nam"
        ? "ห นำ：発音する低子音に、高子音の声調規則を適用します。ห 自体の音は加えません。"
        : "อ นำ：辞書で確認した対象語に、中子音の声調規則を適用します。อ 自体の音は加えません。",
    );
  } else {
    steps.push(
      analysis.onsetRule === "true-cluster"
        ? `真の子音連続：先頭子音のクラス（${consonantClassLabels[effectiveClass]}）を使います。`
        : `初頭子音は${consonantClassLabels[effectiveClass]}です。`,
    );
  }

  const syllableType =
    analysis.codaType === "sonorant" ||
    (analysis.codaType === "none" && analysis.vowelLength === "long")
      ? "live"
      : "dead";

  if (analysis.codaType === "sonorant") {
    steps.push("末音が鼻音・接近音なので、母音の長短にかかわらず生音節です。");
  } else if (analysis.codaType === "stop") {
    steps.push("末音が閉鎖音 /p̚・t̚・k̚/ なので、死音節です。");
  } else {
    steps.push(
      analysis.vowelLength === "long"
        ? "末子音がなく、長母音で終わるので生音節です。"
        : "末子音字がなくても、短母音が声門閉鎖で終わるので死音節です。",
    );
  }

  steps.push(toneMarkLabels[analysis.toneMark]);

  let tone: Tone;
  if (analysis.toneMark === "mai-tri" || analysis.toneMark === "mai-chattawa") {
    if (effectiveClass !== "mid") {
      return {
        status: "unknown",
        reason:
          "ไม้ตรี・ไม้จัตวา は、この基本判定では中子音に対してのみ扱います。例外的な綴りは辞書確認が必要です。",
        steps,
      };
    }
    if (analysis.toneMark === "mai-chattawa" && syllableType === "dead") {
      return {
        status: "unknown",
        reason:
          "死音節にไม้จัตวาが付く組み合わせは、この基本判定の対応範囲外です。推測せず辞書で確認してください。",
        steps,
      };
    }
    tone = analysis.toneMark === "mai-tri" ? "high" : "rising";
    steps.push(
      `${consonantClassLabels[effectiveClass]}に${toneMarkLabels[analysis.toneMark]}が付くため、${toneLabels[tone]}です。`,
    );
  } else if (
    analysis.toneMark === "mai-ek" ||
    analysis.toneMark === "mai-tho"
  ) {
    tone =
      analysis.toneMark === "mai-ek"
        ? effectiveClass === "low"
          ? "falling"
          : "low"
        : effectiveClass === "low"
          ? "high"
          : "falling";
    steps.push(
      `${consonantClassLabels[effectiveClass]}と${toneMarkLabels[analysis.toneMark]}の組み合わせから、${toneLabels[tone]}です。`,
    );
  } else if (syllableType === "live") {
    tone = effectiveClass === "high" ? "rising" : "mid";
    steps.push(
      `声調記号のない${consonantClassLabels[effectiveClass]}の生音節なので、${toneLabels[tone]}です。`,
    );
  } else if (effectiveClass !== "low") {
    tone = "low";
    steps.push(
      `声調記号のない${consonantClassLabels[effectiveClass]}の死音節なので、低調です。`,
    );
  } else {
    tone = analysis.vowelLength === "short" ? "high" : "falling";
    steps.push(
      `声調記号のない低子音の死音節では、${analysis.vowelLength === "short" ? "短母音なので高調" : "長母音なので下降調"}です。`,
    );
  }

  return {
    status: "determined",
    tone,
    syllableType,
    effectiveClass,
    steps,
    method: "rule",
  };
}

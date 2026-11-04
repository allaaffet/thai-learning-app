/** 台本の表情。音声や実在の感情を推定する値ではない。 */
export const romanceExpressionIds = [
  "neutral",
  "happy",
  "thoughtful",
  "concerned",
  "romantic",
  "blushing",
] as const;

export type RomanceExpression = (typeof romanceExpressionIds)[number];

/** 画像は同じ6人を3列×2行に並べた、区画を切り替えるPNG。 */
export const romanceExpressions: Record<
  RomanceExpression,
  { readonly src: string; readonly label: string }
> = {
  neutral: { src: "/romance/cast.png", label: "通常の表情" },
  happy: { src: "/romance/cast-happy.png", label: "笑顔" },
  thoughtful: { src: "/romance/cast-thoughtful.png", label: "考える表情" },
  concerned: { src: "/romance/cast-concerned.png", label: "優しく戸惑う表情" },
  romantic: { src: "/romance/cast-romantic.png", label: "見つめる表情" },
  blushing: { src: "/romance/cast-blushing.png", label: "照れた表情" },
};

export function isRomanceExpression(
  value: unknown,
): value is RomanceExpression {
  return romanceExpressionIds.some((id) => id === value);
}

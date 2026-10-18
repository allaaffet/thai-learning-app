import { useId } from "react";
import type { Tone } from "@/lib/tone-types";

export const toneDescriptions: Record<
  Tone,
  {
    label: string;
    ipa: string;
    chao: string;
    description: string;
    path: string;
  }
> = {
  mid: {
    label: "中平調",
    ipa: "˧",
    chao: "33",
    description: "中ほどの高さを保つ",
    path: "M 35 70 Q 110 71 185 70",
  },
  low: {
    label: "低調",
    ipa: "˨˩",
    chao: "21",
    description: "低めから、さらに下がる",
    path: "M 35 89 Q 105 101 185 111",
  },
  falling: {
    label: "下降調",
    ipa: "˥˩",
    chao: "51",
    description: "高いところから、下がる",
    path: "M 35 29 Q 94 33 120 67 T 185 111",
  },
  high: {
    label: "高調",
    ipa: "˦˥",
    chao: "45",
    description: "高めから、さらに上がる",
    path: "M 35 49 Q 110 43 185 29",
  },
  rising: {
    label: "上昇調",
    ipa: "˩˩˦",
    chao: "114",
    description: "低く始まり、後半で上がる",
    path: "M 35 108 Q 90 121 119 101 T 185 49",
  },
};

export function ToneContour({
  tone,
  compact = false,
}: {
  tone: Tone;
  compact?: boolean;
}) {
  const id = useId();
  const info = toneDescriptions[tone];
  return (
    <svg
      className={`tone-contour${compact ? " tone-contour-compact" : ""}`}
      viewBox="0 0 220 150"
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>{info.label}の模式図</title>
      <desc id={`${id}-description`}>
        {info.description}。高さは1が低く、5が高い。時間は左から右へ進みます。
      </desc>
      {[29, 49, 70, 90, 111].map((y, index) => (
        <g key={y}>
          <line x1="29" y1={y} x2="193" y2={y} className="tone-contour-grid" />
          {!compact && (
            <text x="18" y={y + 4} className="tone-contour-label">
              {5 - index}
            </text>
          )}
        </g>
      ))}
      <path d={info.path} className="tone-contour-line" />
      {!compact && (
        <text
          x="110"
          y="141"
          textAnchor="middle"
          className="tone-contour-label"
        >
          時間 →
        </text>
      )}
    </svg>
  );
}

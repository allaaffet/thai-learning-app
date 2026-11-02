import Image from "next/image";
import type { RomanceCharacter } from "@/lib/romance-types";

/** One original six-panel illustration, displayed through a cell-sized window. */
export function RomancePortrait({
  character,
  className = "",
}: {
  character: RomanceCharacter;
  className?: string;
}) {
  return (
    <div
      className={`romance-portrait ${className}`}
      role="img"
      aria-label={`${character.name}（${character.age}歳）のイラスト`}
    >
      <Image
        src="/romance/cast.png"
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        sizes="(max-width: 600px) 900px, 1200px"
        style={{
          position: "absolute",
          maxWidth: "none",
          width: "300%",
          height: "200%",
          left: `${character.portrait.column * -100}%`,
          top: `${character.portrait.row * -100}%`,
          objectFit: "fill",
        }}
      />
    </div>
  );
}

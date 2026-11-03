"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Heart, MessagesSquare, Users } from "lucide-react";
import { getRomanceEpisode } from "@/data/romance";
import {
  getEnsembleCast,
  getEnsembleInvitation,
  getEnsembleNextEpisode,
  getEnsembleReaction,
  getEnsembleScene,
  type EnsembleLine,
} from "@/data/romance-ensemble";
import { RomancePortrait } from "@/components/romance-portrait";
import { Button } from "@/components/ui/button";
import type { RomanceState } from "@/lib/romance";
import type { RomanceSetting } from "@/lib/romance-setting";
import type { RomanceCharacter, RomanceGender } from "@/lib/romance-types";

type EnsembleStage = "invites" | "reaction" | "group";

export interface RomanceEnsembleProps {
  setting: RomanceSetting;
  gender: RomanceGender;
  people: RomanceCharacter[];
  progress: RomanceState;
  onPick: (characterId: string) => void;
}

/** A short fiction scene; only the parent starts a personal learning episode. */
export function RomanceEnsemble({
  setting,
  gender,
  people,
  progress,
  onPick,
}: RomanceEnsembleProps) {
  const [stage, setStage] = useState<EnsembleStage>("invites");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  const scene = getEnsembleScene(setting, gender);
  const castIds = getEnsembleCast(gender);
  const invited = people.flatMap((person) => {
    if (!castIds.includes(person.id)) return [];
    const episodeId = getEnsembleNextEpisode(progress, person.id);
    const invitation = episodeId
      ? getEnsembleInvitation(setting, person.id, episodeId)
      : undefined;
    return episodeId && invitation ? [{ person, episodeId, invitation }] : [];
  });
  const selected = invited.find(({ person }) => person.id === selectedId);
  const visibleStage = stage === "reaction" && !selected ? "invites" : stage;
  const reactions = selected ? getEnsembleReaction(selected.person.id) : [];

  useEffect(() => {
    if (interacted.current) heading.current?.focus();
  }, [stage, selectedId]);

  if (!scene || invited.length === 0) return null;

  function choosePerson(characterId: string) {
    interacted.current = true;
    setSelectedId(characterId);
    setStage("reaction");
  }

  function changeStage(next: EnsembleStage) {
    interacted.current = true;
    setSelectedId(null);
    setStage(next);
  }

  function dialogue(lines: readonly EnsembleLine[]) {
    return (
      <ol className="re-dialogue">
        {lines.map((line, index) => {
          const speaker = invited.find(
            ({ person }) => person.id === line.characterId,
          )?.person;
          if (!speaker) return null;
          return (
            <li key={`${line.characterId}-${index}`}>
              <RomancePortrait
                character={speaker}
                expression={line.expression}
                className="re-small-portrait"
              />
              <div className="re-speech">
                <strong>{speaker.name}</strong>
                <p>{line.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section
      className="romance-ensemble"
      role="region"
      aria-label="三人からのお誘い"
      data-ensemble-stage={visibleStage}
    >
      <header className="re-heading">
        <span className="re-kicker">
          <Heart size={17} aria-hidden="true" /> あなたを待つ、三つのお誘い
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {visibleStage === "reaction" && selected
            ? `${selected.person.name}を選ぶと……`
            : visibleStage === "group"
              ? "今は、みんなと一緒に。"
              : scene.title}
        </h2>
        {visibleStage === "invites" && <p>{scene.intro}</p>}
      </header>

      {visibleStage === "reaction" && selected && (
        <div className="re-scene">
          {dialogue(reactions ?? [])}
          <Button
            className="re-continue"
            onClick={() => onPick(selected.person.id)}
          >
            二人の場面へ <ArrowRight size={19} aria-hidden="true" />
          </Button>
          <p className="re-scene-note">
            {selected.person.name}との会話練習を始めます。
          </p>
        </div>
      )}

      {visibleStage === "group" && (
        <div className="re-scene">
          {dialogue(scene.groupLines)}
          <p className="re-scene-note">
            三人の視線が、あなたに集まる。次は誰と二人で話そう？
          </p>
        </div>
      )}

      <div className="re-people">
        {invited.map(({ person, episodeId, invitation }) => {
          const episode = getRomanceEpisode(episodeId);
          const reaction =
            visibleStage === "reaction"
              ? reactions?.find((line) => line.characterId === person.id)
              : undefined;
          return (
            <article
              className={`re-person${selected?.person.id === person.id ? " is-picked" : ""}`}
              key={person.id}
            >
              <div className="re-person-header">
                <RomancePortrait
                  character={person}
                  expression={reaction?.expression ?? "happy"}
                  className="re-invite-portrait"
                />
                <div>
                  <h3>{person.name}</h3>
                  <span className="re-person-age">{person.age}歳</span>
                  <span className="re-episode">会話 {episode?.number} / 5</span>
                </div>
              </div>
              <p className="re-invitation">{invitation}</p>
              <Button
                variant="outline"
                data-ensemble-person-id={person.id}
                aria-pressed={
                  visibleStage === "reaction" && selectedId === person.id
                }
                onClick={() => choosePerson(person.id)}
              >
                {person.name}の誘いに乗る
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </article>
          );
        })}
      </div>

      <footer className="re-footer">
        {visibleStage !== "group" && (
          <Button variant="secondary" onClick={() => changeStage("group")}>
            <Users size={18} aria-hidden="true" /> みんなと話す
          </Button>
        )}
        {visibleStage !== "invites" && (
          <Button variant="ghost" onClick={() => changeStage("invites")}>
            <MessagesSquare size={18} aria-hidden="true" /> お誘いをもう一度見る
          </Button>
        )}
        <p>一人に決めなくても、3人の個別ストーリーを並行して進められます。</p>
      </footer>
    </section>
  );
}

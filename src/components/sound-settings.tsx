"use client";

import { useRef } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSoundEffects } from "@/components/sound-effects-provider";

export function SoundSettings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const sound = useSoundEffects();
  return (
    <>
      <button
        type="button"
        className="sound-settings-trigger"
        aria-label="効果音の設定"
        title={`効果音 ${sound.preferences.enabled ? "オン" : "オフ"}`}
        onClick={() => dialog.current?.showModal()}
      >
        {sound.preferences.enabled ? (
          <Volume2 size={18} aria-hidden="true" />
        ) : (
          <VolumeX size={18} aria-hidden="true" />
        )}
        <span>効果音</span>
      </button>
      <dialog
        ref={dialog}
        className="sound-settings-dialog"
        aria-labelledby="sound-settings-heading"
      >
        <div className="sound-settings-heading">
          <h2 id="sound-settings-heading">効果音の設定</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="設定を閉じる"
            onClick={() => dialog.current?.close()}
          >
            <X size={19} aria-hidden="true" />
          </Button>
        </div>
        <p>正誤を知らせる短い音と、学習を終えたときのチャイムです。</p>
        <label className="sound-settings-toggle">
          <span>効果音を使う</span>
          <button
            type="button"
            role="switch"
            aria-label="効果音を有効にする"
            aria-checked={sound.preferences.enabled}
            disabled={!sound.ready}
            onClick={() => sound.setEnabled(!sound.preferences.enabled)}
          >
            <span />
          </button>
        </label>
        <label className="sound-settings-volume" htmlFor="sound-volume">
          音量 <output>{Math.round(sound.preferences.volume * 100)}%</output>
        </label>
        <input
          id="sound-volume"
          aria-label="効果音の音量"
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(sound.preferences.volume * 100)}
          disabled={!sound.ready}
          onChange={(event) =>
            sound.setVolume(Number(event.target.value) / 100)
          }
        />
        <Button
          type="button"
          variant="outline"
          disabled={
            !sound.ready ||
            !sound.supported ||
            !sound.preferences.enabled ||
            sound.preferences.volume === 0
          }
          onClick={() => sound.playEffect("correct")}
        >
          <Volume2 size={16} aria-hidden="true" />
          効果音を試す
        </Button>
        {!sound.supported && sound.ready && (
          <p role="status">
            このブラウザは効果音に対応していません。学習はそのまま使えます。
          </p>
        )}
        {sound.message && <p role="status">{sound.message}</p>}
        <p className="sound-settings-note">
          初期設定はオフです。設定はこのブラウザに保存します。教材の読み上げや録音・音声認識中は効果音を鳴らしません。
        </p>
      </dialog>
    </>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

type ThaiFont = "looped" | "loopless";
const STORAGE_KEY = "thai-learning.thai-font.v1";

function storedFont(value: string | null): ThaiFont {
  return value === "loopless" ? "loopless" : "looped";
}

export function ThaiFontToggle() {
  const [font, setFont] = useState<ThaiFont>("looped");
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const descriptionId = useId();

  useEffect(() => {
    let preference: ThaiFont = "looped";
    let message: string | null = null;
    try {
      preference = storedFont(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      message =
        "フォント設定を読み込めませんでした。保存できない場合も、この画面で切り替えられます。";
    }
    document.documentElement.dataset.thaiFont = preference;
    // Read browser preferences after hydration, keeping the server markup stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFont(preference);
    setStorageMessage(message);
    setReady(true);

    function syncPreference(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = storedFont(event.newValue);
      document.documentElement.dataset.thaiFont = next;
      setFont(next);
      setStorageMessage(null);
    }
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  function toggleFont() {
    const next = font === "looped" ? "loopless" : "looped";
    document.documentElement.dataset.thaiFont = next;
    setFont(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      setStorageMessage(null);
    } catch {
      setStorageMessage(
        "フォント設定を保存できませんでした。この画面では切り替えられます。",
      );
    }
  }

  return (
    <div className="font-preference">
      <div className="font-preference-control">
        <span className="font-preference-label">タイ語の字体</span>
        <span
          className={cn(
            "font-preference-option",
            font === "looped" && "active",
          )}
          aria-hidden="true"
        >
          標準
        </span>
        <button
          type="button"
          role="switch"
          aria-label="ループなしのタイ語フォント"
          aria-checked={font === "loopless"}
          aria-describedby={descriptionId}
          disabled={!ready}
          onClick={toggleFont}
          className="font-switch"
        >
          <span className="font-switch-track">
            <span className="font-switch-thumb" />
          </span>
        </button>
        <span
          className={cn(
            "font-preference-option",
            font === "loopless" && "active",
          )}
          aria-hidden="true"
        >
          ループなし
        </span>
        <span id={descriptionId} className="sr-only">
          オフは標準のループあり、オンはループなしの字体です。タイ語の文字だけを切り替え、選択をこのブラウザに保存します。
        </span>
      </div>
      {storageMessage && (
        <p className="font-preference-notice" role="status">
          {storageMessage}
        </p>
      )}
    </div>
  );
}

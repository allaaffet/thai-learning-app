/** Sound settings are separate from learning progress and are off by default. */
export interface SoundPreferences {
  version: 1;
  enabled: boolean;
  volume: number;
}

export const SOUND_PREFERENCES_KEY = "thai-learning.sound.v1";
export const DEFAULT_SOUND_PREFERENCES: Readonly<SoundPreferences> =
  Object.freeze({
    version: 1,
    enabled: false,
    volume: 0.35,
  });

export function isSoundPreferences(value: unknown): value is SoundPreferences {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    "volume" in value &&
    typeof value.volume === "number" &&
    Number.isFinite(value.volume) &&
    value.volume >= 0 &&
    value.volume <= 1
  );
}

export function parseSoundPreferences(
  raw: string | null,
): SoundPreferences | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSoundPreferences(parsed)) return undefined;
    return { version: 1, enabled: parsed.enabled, volume: parsed.volume };
  } catch {
    return undefined;
  }
}

export interface SoundPreferencesLoadResult {
  preferences: SoundPreferences;
  status: "default" | "saved" | "invalid" | "unavailable";
}

export function loadSoundPreferences(
  storage?: Pick<Storage, "getItem">,
): SoundPreferencesLoadResult {
  const fallback: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
  try {
    const source =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!source) return { preferences: fallback, status: "unavailable" };
    const raw = source.getItem(SOUND_PREFERENCES_KEY);
    if (raw === null) return { preferences: fallback, status: "default" };
    const parsed = parseSoundPreferences(raw);
    return parsed
      ? { preferences: parsed, status: "saved" }
      : { preferences: fallback, status: "invalid" };
  } catch {
    return { preferences: fallback, status: "unavailable" };
  }
}

/** Call only after an explicit setting change; mounting never repairs stored data. */
export function saveSoundPreferences(
  preferences: SoundPreferences,
  storage?: Pick<Storage, "setItem">,
): boolean {
  if (!isSoundPreferences(preferences)) return false;
  try {
    const target =
      storage ??
      (typeof window === "undefined" ? undefined : window.localStorage);
    if (!target) return false;
    target.setItem(
      SOUND_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        enabled: preferences.enabled,
        volume: preferences.volume,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

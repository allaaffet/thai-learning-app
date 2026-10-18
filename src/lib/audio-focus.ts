/** Keep learning audio and microphones clear of short interface sound effects. */
export function createAudioFocus() {
  const owners = new Set<symbol>();
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Optional sound feedback must never interrupt learning or device cleanup.
      }
    }
  }

  return {
    acquire(): () => void {
      const owner = Symbol("learning-audio");
      const wasBusy = owners.size > 0;
      owners.add(owner);
      if (!wasBusy) notify();
      return () => {
        if (!owners.delete(owner)) return;
        if (owners.size === 0) notify();
      };
    },
    isBusy: () => owners.size > 0,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type AudioFocus = ReturnType<typeof createAudioFocus>;
export const audioFocus = createAudioFocus();

import { useEffect, useRef } from "react";
import { loadCompanionWorld, saveCompanionWorld } from "./persist";
import { toSyncedWorld, useCompanion } from "./store";

const SAVE_DEBOUNCE_MS = 1500;

/**
 * Bridges the client-only Zustand/localStorage store to the server-side
 * `companion_world` table. Mount this ONCE, near the app root, after
 * localStorage hydration has settled.
 *
 * - On first mount: fetch the server's copy. If one exists, it wins over
 *   localStorage (the server is the durable source of truth across devices)
 *   via `importWorld`. If none exists yet, push the current local world up
 *   instead, so existing on-device data isn't discarded.
 * - After that, any store change is saved back to the server, debounced so a
 *   burst of mutations (e.g. one chat reply touching several entities)
 *   produces one write instead of several.
 *
 * Single-user, no auth — see persist.ts. Does NOT attempt conflict
 * resolution across two simultaneously-open sessions (e.g. desktop + phone
 * open at once) — last save wins.
 */
export function useCompanionSync(): void {
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadCompanionWorld().then((res) => {
      const state = useCompanion.getState();
      if (res.worldJson) {
        // importWorld -> normalizeWorld() validates/defaults every field, so
        // an untyped blob from the server is safe to hand off here.
        const parsed: unknown = JSON.parse(res.worldJson);
        const localSettings = {
          ambientModeEnabled: state.ambientModeEnabled,
          launchOnStartup: state.launchOnStartup,
          screenContextEnabled: state.screenContextEnabled,
          localFileAccessEnabled: state.localFileAccessEnabled,
        };
        state.importWorld({
          ...(parsed as Parameters<typeof state.importWorld>[0]),
          ...localSettings,
        });
      } else {
        // Nothing saved server-side yet — seed it from whatever's already in
        // the local store (fresh onboarding, or pre-existing localStorage
        // data from before sync existed).
        void saveCompanionWorld({ data: { worldJson: JSON.stringify(toSyncedWorld(state)) } });
      }
      loadedRef.current = true;
    });

    const unsubscribe = useCompanion.subscribe(() => {
      if (!loadedRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const world = toSyncedWorld(useCompanion.getState());
        void saveCompanionWorld({ data: { worldJson: JSON.stringify(world) } });
      }, SAVE_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);
}

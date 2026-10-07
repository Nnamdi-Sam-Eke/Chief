// window.chief is injected by the Electron shell's preload script
// (electron/preload.js) — undefined in a normal browser tab. Declared here
// as the one canonical spot rather than duplicated per file that touches it.
declare global {
  interface Window {
    chief?: {
      openMain: () => void;
      openExternal: (url: string) => void;
      moveTo: (x: number, y: number) => void;
      getBounds: () => { x: number; y: number; width: number; height: number };
      setMousePassthrough: (passthrough: boolean) => void;
      getLaunchOnStartup: () => Promise<boolean>;
      setLaunchOnStartup: (enabled: boolean) => Promise<boolean>;
      getBackgroundPresence: () => Promise<boolean>;
      setBackgroundPresence: (enabled: boolean) => Promise<boolean>;
    };
  }
}

/** True when running inside the Electron shell, false in any normal browser tab. */
export function isElectronRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.chief);
}

import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PresenceOrb } from "@/components/presence/orb";
import { WakeWordListener } from "@/components/companion/wake-word-listener";
import { useCompanion } from "@/lib/companion/store";
import "@/lib/electron-bridge"; // window.chief type declaration

export const Route = createFileRoute("/orb")({
  component: OrbPage,
});

function OrbPage() {
  const presence = useCompanion((s) => s.presence);
  const dragRef = useRef<{
    startScreenX: number;
    startScreenY: number;
    startWindowX: number;
    startWindowY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const orbRef = useRef<HTMLButtonElement>(null);

  const setPassthroughForPosition = (clientX: number, clientY: number) => {
    if (!window.chief || dragRef.current) return;
    const orb = orbRef.current;
    if (!orb) return;
    const bounds = orb.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const overOrb =
      (clientX - centerX) ** 2 + (clientY - centerY) ** 2 <= radius ** 2;
    window.chief.setMousePassthrough(!overOrb);
  };

  // This route is the entire contents of a frameless, transparent Electron
  // window (see electron/main.js) — only the orb itself should be visible,
  // not a page background. Also relevant if someone just opens /orb in a
  // normal browser tab to test it.
  useEffect(() => {
    const { style } = document.documentElement;
    const bodyStyle = document.body.style;
    const prevHtml = style.background;
    const prevBody = bodyStyle.background;
    style.background = "transparent";
    bodyStyle.background = "transparent";
    return () => {
      style.background = prevHtml;
      bodyStyle.background = prevBody;
    };
  }, []);

  return (
    <div
      className="flex h-dvh w-dvw items-center justify-center bg-transparent"
      onMouseMove={(event) => {
        setPassthroughForPosition(event.clientX, event.clientY);
      }}
    >
      <WakeWordListener />
      <button
        ref={orbRef}
        type="button"
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (window.chief) {
            window.chief.openMain();
          } else {
            window.location.href = "/";
          }
        }}
        onPointerDown={(event) => {
          if (!window.chief) return;
          suppressClickRef.current = false;
          const bounds = window.chief.getBounds();
          dragRef.current = {
            startScreenX: event.screenX,
            startScreenY: event.screenY,
            startWindowX: bounds.x,
            startWindowY: bounds.y,
            moved: false,
          };
          window.chief.setMousePassthrough(false);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || !window.chief) return;
          const deltaX = event.screenX - drag.startScreenX;
          const deltaY = event.screenY - drag.startScreenY;
          if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            drag.moved = true;
          }
          window.chief.moveTo(
            drag.startWindowX + deltaX,
            drag.startWindowY + deltaY,
          );
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || !window.chief) return;
          suppressClickRef.current = drag.moved;
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragRef.current = null;
          setPassthroughForPosition(event.clientX, event.clientY);
        }}
        onPointerCancel={() => {
          if (!dragRef.current || !window.chief) return;
          window.chief.setMousePassthrough(true);
          dragRef.current = null;
          suppressClickRef.current = false;
        }}
        className="cursor-grab border-none bg-transparent p-0 active:cursor-grabbing"
        aria-label="Open Chief"
      >
        <PresenceOrb state={presence} className="size-16" />
      </button>
    </div>
  );
}

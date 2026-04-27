"use client";

import { useEffect, useState, type RefObject } from "react";

import { cn } from "@/lib/utils";

export function FullscreenToggle({
  className,
  targetRef,
}: {
  className?: string;
  targetRef: RefObject<HTMLElement | null>;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [targetRef]);

  const handleToggle = async () => {
    const element = targetRef.current;

    if (!element) {
      return;
    }

    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  };

  return (
    <button
      className={cn(
        "pointer-events-auto absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/70",
        className,
      )}
      onClick={() => {
        void handleToggle();
      }}
      type="button"
    >
      {isFullscreen ? "Exit full screen" : "Full screen"}
    </button>
  );
}

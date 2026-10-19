"use client";

import { useEffect, useState, type RefObject } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument;
  return (
    document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null
  );
}

export function useBoardFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isActive = isBrowserFullscreen || isExpanded;

  useEffect(() => {
    const syncFullscreen = () => {
      setIsBrowserFullscreen(fullscreenElement() === targetRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, [targetRef]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previousBody = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const previousOverflow = root.style.overflow;

    // Fix the page behind the board so iOS cannot scroll it through the overlay.
    Object.assign(body.style, {
      position: "fixed",
      top: `${-scrollY}px`,
      left: `${-scrollX}px`,
      width: "100%",
      overflow: "hidden",
    });
    root.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      Object.assign(body.style, previousBody);
      root.style.overflow = previousOverflow;
      window.scrollTo(scrollX, scrollY);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isActive]);

  const toggleFullscreen = async () => {
    const target = targetRef.current as FullscreenElement | null;

    if (!target || isPending) {
      return;
    }

    setErrorMessage(null);

    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsPending(true);
    const fullscreenDocument = document as FullscreenDocument;
    const isExiting = fullscreenElement() === target;

    try {
      if (isExiting) {
        if (
          document.fullscreenElement === target &&
          typeof document.exitFullscreen === "function"
        ) {
          await document.exitFullscreen();
        } else {
          await fullscreenDocument.webkitExitFullscreen?.();
        }
        setIsBrowserFullscreen(fullscreenElement() === target);
      } else if (
        typeof target.requestFullscreen === "function" &&
        document.fullscreenEnabled !== false
      ) {
        await target.requestFullscreen();
        setIsBrowserFullscreen(fullscreenElement() === target);
      } else if (
        typeof target.webkitRequestFullscreen === "function" &&
        fullscreenDocument.webkitFullscreenEnabled !== false
      ) {
        await target.webkitRequestFullscreen();
        setIsBrowserFullscreen(fullscreenElement() === target);
      } else {
        setIsExpanded(true);
      }
    } catch {
      if (isExiting) {
        setErrorMessage("Use your browser's exit control to leave full screen.");
      } else {
        setIsExpanded(true);
      }
    } finally {
      setIsPending(false);
    }
  };

  return {
    buttonLabel: isExpanded
      ? "Exit expanded view"
      : isBrowserFullscreen
        ? "Exit full screen"
        : "Full screen",
    errorMessage,
    isActive,
    isExpanded,
    isPending,
    toggleFullscreen,
  };
}

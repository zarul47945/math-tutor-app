"use client";

import { useEffect, useRef } from "react";

import { FullscreenToggle } from "@/components/room/fullscreen-toggle";
import { Badge } from "@/components/ui/badge";

type PreviewTrack = {
  attach: (element: HTMLMediaElement) => unknown;
  detach: (element: HTMLMediaElement) => unknown;
};

export function LocalVideoPreview({
  cameraEnabled,
  microphoneEnabled,
  participantLabel,
  track,
}: {
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  participantLabel: string;
  track?: PreviewTrack | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;

    if (!element || !track) {
      return;
    }

    track.attach(element);
    element.muted = true;
    element.playsInline = true;
    void element.play().catch(() => {
      // Keep the preview mounted even if autoplay needs another user gesture.
    });

    return () => {
      track.detach(element);
    };
  }, [track]);

  return (
    <div
      className="lesson-video-tile relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-strong)] shadow-[var(--shadow-card)]"
      ref={containerRef}
    >
      <FullscreenToggle targetRef={containerRef} />
      {track ? (
        <video
          autoPlay
          className="lesson-video-media h-full min-h-[280px] w-full bg-[var(--color-surface-strong)] object-cover"
          muted
          playsInline
          ref={videoRef}
        />
      ) : (
        <div className="lesson-video-fallback flex min-h-[280px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(22,93,255,0.38),_rgba(15,23,42,0.96)_55%)] px-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl font-semibold text-white">
              {participantLabel.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-medium text-white/80">
              Camera is currently off
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 py-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">{participantLabel}</p>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/15 text-white">You</Badge>
            {!microphoneEnabled ? (
              <Badge className="bg-black/35 text-white">Mic off</Badge>
            ) : null}
            {!cameraEnabled ? (
              <Badge className="bg-black/35 text-white">Camera off</Badge>
            ) : null}
          </div>
        </div>
        <Badge className="bg-[var(--color-primary)] text-[var(--color-text-inverse)]">
          Live
        </Badge>
      </div>
    </div>
  );
}

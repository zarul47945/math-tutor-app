"use client";

import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  VideoTrack,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "@/lib/livekit/signals";
import type { LiveKitRole } from "@/lib/types";

const TEACHER_STROKE = "#165dff";
const STUDENT_STROKE = "#f97316";
const WHITEBOARD_COLORS = [
  "#111827",
  "#165dff",
  "#f97316",
  "#16a34a",
  "#dc2626",
  "#7c3aed",
];
const WHITEBOARD_SIZES = [2, 4, 8, 12];

function drawWhiteboardStroke(
  context: CanvasRenderingContext2D,
  height: number,
  stroke: WhiteboardStroke,
  width: number,
) {
  if (stroke.points.length === 0) {
    return;
  }

  const firstPoint = stroke.points[0];
  const lastPoint = stroke.points[stroke.points.length - 1] ?? firstPoint;
  context.save();
  context.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.size;

  if (stroke.tool === "line") {
    context.beginPath();
    context.moveTo(firstPoint.x * width, firstPoint.y * height);
    context.lineTo(lastPoint.x * width, lastPoint.y * height);
    context.stroke();
    context.restore();
    return;
  }

  if (stroke.tool === "rectangle") {
    const x = Math.min(firstPoint.x, lastPoint.x) * width;
    const y = Math.min(firstPoint.y, lastPoint.y) * height;
    const rectWidth = Math.abs(lastPoint.x - firstPoint.x) * width;
    const rectHeight = Math.abs(lastPoint.y - firstPoint.y) * height;
    context.strokeRect(x, y, rectWidth, rectHeight);
    context.restore();
    return;
  }

  if (stroke.tool === "ellipse") {
    const centerX = ((firstPoint.x + lastPoint.x) / 2) * width;
    const centerY = ((firstPoint.y + lastPoint.y) / 2) * height;
    const radiusX = (Math.abs(lastPoint.x - firstPoint.x) * width) / 2;
    const radiusY = (Math.abs(lastPoint.y - firstPoint.y) * height) / 2;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(firstPoint.x * width, firstPoint.y * height);

  stroke.points.slice(1).forEach((point) => {
    context.lineTo(point.x * width, point.y * height);
  });

  if (stroke.points.length === 1) {
    context.lineTo(firstPoint.x * width + 0.5, firstPoint.y * height + 0.5);
  }

  context.stroke();
  context.restore();
}

function toolLabel(tool: WhiteboardTool) {
  switch (tool) {
    case "ellipse":
      return "Circle";
    case "eraser":
      return "Eraser";
    case "line":
      return "Line";
    case "pen":
      return "Pen";
    case "rectangle":
      return "Box";
    default:
      return tool;
  }
}

function participantLabel(participant: Participant) {
  const name = participant.name?.trim();
  return name && name.length > 0 ? name : participant.identity;
}

function isTrackReference(
  trackRef: TrackReferenceOrPlaceholder | null,
): trackRef is TrackReference {
  return trackRef !== null && trackRef.publication !== undefined;
}

function WhiteboardCameraTile({
  participant,
  trackRef,
}: {
  participant: Participant;
  trackRef: TrackReferenceOrPlaceholder | null;
}) {
  const label = participantLabel(participant);
  const resolvedTrackRef = isTrackReference(trackRef) ? trackRef : null;

  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-strong)]">
      <div className="relative aspect-[4/3] bg-[#0f172a]">
        {resolvedTrackRef ? (
          <VideoTrack
            className="absolute inset-0 h-full w-full object-cover"
            trackRef={resolvedTrackRef}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white">
              {label.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{label}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">
              {participant.isLocal ? "You" : "Remote"}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
            {participant.isCameraEnabled ? "Cam on" : "Cam off"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WhiteboardOverlay({
  cameraParticipants,
  canUndo,
  enabled,
  onClear,
  onClose,
  onStrokeComplete,
  onUndo,
  role,
  strokes,
}: {
  cameraParticipants: Array<{
    participant: Participant;
    trackRef: TrackReferenceOrPlaceholder | null;
  }>;
  canUndo: boolean;
  enabled: boolean;
  onClear: () => void;
  onClose: () => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  onUndo: () => void;
  role: LiveKitRole;
  strokes: WhiteboardStroke[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const [activePoints, setActivePoints] = useState<WhiteboardPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ height: 0, width: 0 });
  const [selectedColor, setSelectedColor] = useState(
    role === "teacher" ? TEACHER_STROKE : STUDENT_STROKE,
  );
  const [isCameraDockHidden, setIsCameraDockHidden] = useState(false);
  const [isCameraDockMinimized, setIsCameraDockMinimized] = useState(false);
  const [selectedSize, setSelectedSize] = useState(4);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("pen");
  const strokeColor = useMemo(
    () => (selectedTool === "eraser" ? "#ffffff" : selectedColor),
    [selectedColor, selectedTool],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper || !enabled) {
      return;
    }

    const syncCanvasSize = () => {
      setCanvasSize({
        height: wrapper.clientHeight,
        width: wrapper.clientWidth,
      });
    };

    syncCanvasSize();

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((stroke) =>
      drawWhiteboardStroke(context, canvas.height, stroke, canvas.width),
    );

    if (currentStrokeRef.current) {
      drawWhiteboardStroke(
        context,
        canvas.height,
        currentStrokeRef.current,
        canvas.width,
      );
    }
  }, [activePoints, canvasSize.height, canvasSize.width, strokes]);

  const makePoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return null;
    }

    return {
      x: Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1),
      y: Math.min(Math.max((clientY - bounds.top) / bounds.height, 0), 1),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) {
      return;
    }

    const point = makePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const nextStroke: WhiteboardStroke = {
      author: role,
      color: strokeColor,
      id: crypto.randomUUID(),
      points: [point],
      size: selectedSize,
      tool: selectedTool,
    };

    currentStrokeRef.current = nextStroke;
    setActivePoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !currentStrokeRef.current) {
      return;
    }

    const point = makePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points:
        selectedTool === "pen" || selectedTool === "eraser"
          ? [...currentStrokeRef.current.points, point]
          : [currentStrokeRef.current.points[0], point],
    };
    setActivePoints([...currentStrokeRef.current.points]);
  };

  const finishStroke = () => {
    if (!currentStrokeRef.current) {
      return;
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setActivePoints([]);
    onStrokeComplete(completedStroke);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) {
      return;
    }

    finishStroke();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[var(--color-bg)]">
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 shadow-[var(--shadow-card)] lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-[var(--color-primary-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-strong)]">
                  Classroom whiteboard
                </div>
                <div className="rounded-full bg-[var(--color-surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  {role}
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)] lg:text-3xl">
                Live teaching board
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={!canUndo} onClick={onUndo} variant="secondary">
                Undo
              </Button>
              <Button
                disabled={strokes.length === 0}
                onClick={onClear}
                variant="danger"
              >
                Clear whiteboard
              </Button>
              <Button onClick={onClose} variant="secondary">
                Close whiteboard
              </Button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
          <aside className="max-h-[34dvh] overflow-y-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 lg:max-h-none lg:border-b-0 lg:border-r">
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Tool
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    ["pen", "eraser", "line", "rectangle", "ellipse"] as WhiteboardTool[]
                  ).map((tool) => (
                    <button
                      key={tool}
                      className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold transition ${
                        selectedTool === tool
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                          : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-soft)]"
                      }`}
                      onClick={() => setSelectedTool(tool)}
                      type="button"
                    >
                      {toolLabel(tool)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Color
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {WHITEBOARD_COLORS.map((color) => (
                    <button
                      key={color}
                      aria-label={`Use ${color}`}
                      className={`h-11 rounded-2xl border transition ${
                        selectedColor === color
                          ? "border-[var(--color-text)] ring-2 ring-[var(--color-primary-soft)]"
                          : "border-[var(--color-border)]"
                      } ${selectedTool === "eraser" ? "opacity-50" : ""}`}
                      onClick={() => setSelectedColor(color)}
                      style={{ backgroundColor: color }}
                      type="button"
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                    Weight
                  </p>
                  <span className="font-mono text-sm text-[var(--color-text)]">
                    {selectedSize}px
                  </span>
                </div>
                <input
                  className="w-full accent-[var(--color-primary)]"
                  max={16}
                  min={1}
                  onChange={(event) => setSelectedSize(Number(event.target.value))}
                  step={1}
                  type="range"
                  value={selectedSize}
                />
                <div className="grid grid-cols-4 gap-2">
                  {WHITEBOARD_SIZES.map((size) => (
                    <button
                      key={size}
                      className={`min-h-11 rounded-2xl border text-sm font-semibold transition ${
                        selectedSize === size
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                          : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-surface-soft)]"
                      }`}
                      onClick={() => setSelectedSize(size)}
                      type="button"
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                  Board status
                </p>
                <div className="space-y-2 text-sm text-[var(--color-text-soft)]">
                  <p>Elements: {strokes.length}</p>
                  <p>Selected tool: {toolLabel(selectedTool)}</p>
                  <p>Current writer: {role}</p>
                </div>
              </section>
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden bg-[var(--color-surface-strong)] p-3 lg:p-5">
            <div
              className="relative h-full min-h-0 overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]"
              ref={wrapperRef}
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(22,93,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,93,255,0.07) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            >
              {isCameraDockHidden ? (
                <button
                  className="absolute right-3 top-3 z-20 rounded-full border border-[var(--color-border)] bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text)] shadow-[var(--shadow-card)] backdrop-blur"
                  onClick={() => setIsCameraDockHidden(false)}
                  type="button"
                >
                  Show cameras
                </button>
              ) : (
                <div className="absolute right-3 top-3 z-20 w-[220px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-white/96 shadow-[var(--shadow-card)] backdrop-blur lg:w-[240px]">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                        Classroom cameras
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                        Teacher and student
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]"
                        onClick={() =>
                          setIsCameraDockMinimized((currentValue) => !currentValue)
                        }
                        type="button"
                      >
                        {isCameraDockMinimized ? "Open" : "Min"}
                      </button>
                      <button
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]"
                        onClick={() => setIsCameraDockHidden(true)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {!isCameraDockMinimized ? (
                    <div className="max-h-[calc(100dvh-15rem)] space-y-2 overflow-y-auto p-2.5">
                      {cameraParticipants.length > 0 ? (
                        cameraParticipants.map(({ participant, trackRef }) => (
                          <WhiteboardCameraTile
                            key={participant.identity}
                            participant={participant}
                            trackRef={trackRef}
                          />
                        ))
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-6 text-center text-sm leading-6 text-[var(--color-text-soft)]">
                          No cameras are available in this lesson yet.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              <canvas
                className="absolute inset-0 h-full w-full cursor-crosshair"
                onPointerDown={handlePointerDown}
                onPointerLeave={finishStroke}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                ref={canvasRef}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

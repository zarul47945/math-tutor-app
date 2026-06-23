"use client";

import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  VideoTrack,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "@/lib/livekit/signals";
import type { LiveKitRole } from "@/lib/types";
import { formatSeconds } from "@/lib/utils";

const CONSULTATION_COLORS = [
  "#111827",
  "#dc2626",
  "#165dff",
  "#16a34a",
  "#7c3aed",
];

function isTrackReference(
  trackRef: TrackReferenceOrPlaceholder | null,
): trackRef is TrackReference {
  return trackRef !== null && trackRef.publication !== undefined;
}

function drawStroke(
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
    context.strokeRect(
      x,
      y,
      Math.abs(lastPoint.x - firstPoint.x) * width,
      Math.abs(lastPoint.y - firstPoint.y) * height,
    );
    context.restore();
    return;
  }

  if (stroke.tool === "ellipse") {
    context.beginPath();
    context.ellipse(
      ((firstPoint.x + lastPoint.x) / 2) * width,
      ((firstPoint.y + lastPoint.y) / 2) * height,
      (Math.abs(lastPoint.x - firstPoint.x) * width) / 2,
      (Math.abs(lastPoint.y - firstPoint.y) * height) / 2,
      0,
      0,
      Math.PI * 2,
    );
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

function participantName(participant?: Participant | null) {
  if (!participant) {
    return "";
  }

  return participant.name?.trim() || participant.identity;
}

function ConsultationVideoTile({
  label,
  participant,
  roleLabel,
  trackRef,
}: {
  label: string;
  participant?: Participant | null;
  roleLabel: string;
  trackRef?: TrackReferenceOrPlaceholder | null;
}) {
  const resolvedTrackRef = trackRef && isTrackReference(trackRef) ? trackRef : null;
  const displayName = participantName(participant) || label;

  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl lg:min-h-[260px]">
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white shadow-lg">
        {roleLabel}
      </div>
      <div className="absolute right-4 top-4 z-10 rounded-lg bg-black/50 px-3 py-2 text-emerald-300 shadow-lg backdrop-blur">
        ||||
      </div>
      {resolvedTrackRef ? (
        <VideoTrack
          className="absolute inset-0 h-full w-full object-cover"
          trackRef={resolvedTrackRef}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#1d4ed8,#111827_55%)]">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-black text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-semibold text-white/80">
              Camera is currently off
            </p>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/30 to-transparent px-5 py-4">
        <p className="font-bold text-white">{displayName}</p>
        <div className="rounded-full bg-black/45 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
          {participant?.isCameraEnabled ? "Cam on" : "Cam off"}
        </div>
      </div>
    </div>
  );
}

export function ConsultationRoom({
  canUndo,
  cameraEnabled,
  connectionState,
  displayedElapsedSeconds,
  isBusy,
  joinCode,
  localCameraTrackRef,
  localParticipant,
  microphoneEnabled,
  onClearWhiteboard,
  onLeave,
  onStrokeComplete,
  onToggleCamera,
  onToggleMicrophone,
  onUndoWhiteboard,
  participantCount,
  remoteCameraTrackByIdentity,
  remoteParticipants,
  role,
  roomMessage,
  sessionTitle,
  whiteboardStrokes,
}: {
  canUndo: boolean;
  cameraEnabled: boolean;
  connectionState: string;
  displayedElapsedSeconds: number;
  isBusy: boolean;
  joinCode: string;
  localCameraTrackRef: TrackReferenceOrPlaceholder | null;
  localParticipant: Participant;
  microphoneEnabled: boolean;
  onClearWhiteboard: () => void;
  onLeave: () => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onUndoWhiteboard: () => void;
  participantCount: number;
  remoteCameraTrackByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  remoteParticipants: Participant[];
  role: LiveKitRole;
  roomMessage?: string | null;
  sessionTitle: string;
  whiteboardStrokes: WhiteboardStroke[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const [activePoints, setActivePoints] = useState<WhiteboardPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ height: 0, width: 0 });
  const [selectedColor, setSelectedColor] = useState("#165dff");
  const [selectedSize, setSelectedSize] = useState(4);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("pen");
  const remoteParticipant = remoteParticipants[0] ?? null;
  const tutorParticipant = role === "teacher" ? localParticipant : remoteParticipant;
  const studentParticipant = role === "student" ? localParticipant : remoteParticipant;
  const tutorTrackRef =
    role === "teacher"
      ? localCameraTrackRef
      : tutorParticipant
        ? remoteCameraTrackByIdentity.get(tutorParticipant.identity) ?? null
        : null;
  const studentTrackRef =
    role === "student"
      ? localCameraTrackRef
      : studentParticipant
        ? remoteCameraTrackByIdentity.get(studentParticipant.identity) ?? null
        : null;
  const currentStrokeColor = selectedTool === "eraser" ? "#ffffff" : selectedColor;
  const canClear = whiteboardStrokes.length > 0;

  const tools = useMemo(
    () =>
      [
        ["pen", "Pen"],
        ["eraser", "Eraser"],
        ["line", "Line"],
        ["rectangle", "Box"],
        ["ellipse", "Circle"],
      ] as Array<[WhiteboardTool, string]>,
    [],
  );

  useEffect(() => {
    const board = boardRef.current;

    if (!board) {
      return;
    }

    const syncSize = () => {
      setCanvasSize({
        height: board.clientHeight,
        width: board.clientWidth,
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(board);

    return () => observer.disconnect();
  }, []);

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
    whiteboardStrokes.forEach((stroke) =>
      drawStroke(context, canvas.height, stroke, canvas.width),
    );

    if (currentStrokeRef.current) {
      drawStroke(context, canvas.height, currentStrokeRef.current, canvas.width);
    }
  }, [activePoints, canvasSize.height, canvasSize.width, whiteboardStrokes]);

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

  const finishStroke = () => {
    if (!currentStrokeRef.current) {
      return;
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setActivePoints([]);
    onStrokeComplete(completedStroke);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = makePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    currentStrokeRef.current = {
      author: role,
      color: currentStrokeColor,
      id: crypto.randomUUID(),
      points: [point],
      size: selectedSize,
      tool: selectedTool,
    };
    setActivePoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) {
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

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    finishStroke();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="min-h-screen bg-[#07111d] px-4 py-4 text-white lg:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 shadow-2xl backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
              <span className="text-2xl text-blue-400">[M]</span>
              Terapi Matematik Online
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-emerald-300">
              Class Code: {joinCode}
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              {sessionTitle}
            </div>
            <Badge className="bg-white/10 text-white">{connectionState}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-black/35 px-4 py-2 font-semibold">
              Class Timer:{" "}
              <span className="font-mono">{formatSeconds(displayedElapsedSeconds)}</span>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2 font-semibold">
              Participants: {participantCount}
            </div>
            <Button onClick={onLeave} variant="danger">
              End Class
            </Button>
          </div>
        </header>

        {roomMessage ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {roomMessage}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
          <ConsultationVideoTile
            label="Tutor"
            participant={tutorParticipant}
            roleLabel="Tutor"
            trackRef={tutorTrackRef}
          />

          <div className="rounded-2xl bg-white p-6 text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="font-bold text-blue-700">SPM Mathematics</p>
                <p className="mt-1 text-sm text-slate-700">
                  Topic: Quadratic Equations
                </p>
              </div>
              <p className="text-sm text-slate-700">Question: 1 of 5</p>
            </div>
            <div className="space-y-6 pt-5">
              <p className="text-sm">1. Solve the following quadratic equation.</p>
              <div className="text-center text-3xl font-semibold italic">
                x^2 - 5x + 6 = 0
              </div>
              <div className="text-right text-sm">[3 marks]</div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm leading-6 text-slate-800">
                Hint: Find two numbers that multiply to 6 and add to -5.
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="secondary">Previous</Button>
                <Button>Next Question</Button>
              </div>
            </div>
          </div>

          <ConsultationVideoTile
            label="Student"
            participant={studentParticipant}
            roleLabel={role === "student" ? "You (Student)" : "Student"}
            trackRef={studentTrackRef}
          />
        </section>

        <section
          className="relative min-h-[46vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
          ref={boardRef}
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          <canvas
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerLeave={finishStroke}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={canvasRef}
          />
        </section>

        <footer className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 shadow-2xl backdrop-blur xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <div className="flex flex-wrap gap-2">
            {tools.map(([tool, label]) => (
              <button
                className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition ${
                  selectedTool === tool
                    ? "border-blue-400 bg-blue-600 text-white"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
                key={tool}
                onClick={() => setSelectedTool(tool)}
                type="button"
              >
                {label}
              </button>
            ))}
            {CONSULTATION_COLORS.map((color) => (
              <button
                aria-label={`Use color ${color}`}
                className={`h-12 w-12 rounded-full border-2 ${
                  selectedColor === color ? "border-white" : "border-white/20"
                }`}
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
            <select
              className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white"
              onChange={(event) => setSelectedSize(Number(event.target.value))}
              value={selectedSize}
            >
              {[2, 4, 8, 12, 16].map((size) => (
                <option className="text-slate-950" key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
            <Button disabled={!canUndo} onClick={onUndoWhiteboard} variant="secondary">
              Undo
            </Button>
            <Button disabled={!canClear} onClick={onClearWhiteboard} variant="secondary">
              Clear All
            </Button>
          </div>

          <div className="rounded-xl bg-white/5 px-5 py-3 text-sm">
            <p className="text-white/70">Time Left</p>
            <p className="font-mono text-lg font-bold">
              {formatSeconds(displayedElapsedSeconds)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isBusy} onClick={onToggleMicrophone} variant="secondary">
              {microphoneEnabled ? "Mute Mic" : "Unmute Mic"}
            </Button>
            <Button disabled={isBusy} onClick={onToggleCamera} variant="secondary">
              {cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
            </Button>
            <Button>Submit Answer</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

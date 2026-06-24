"use client";

import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  VideoTrack,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ClassroomDocumentViewer } from "@/components/room/classroom-document-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "@/lib/livekit/signals";
import type { LessonWorksheet, LiveKitRole } from "@/lib/types";
import { formatSeconds } from "@/lib/utils";

const CONSULTATION_COLORS = [
  "#111827",
  "#dc2626",
  "#165dff",
  "#16a34a",
  "#7c3aed",
];

const QUESTION_PANEL_PADDING = 16;
const QUESTION_PANEL_MIN_HEIGHT = 260;
const QUESTION_PANEL_MIN_WIDTH = 320;

type FloatingQuestionPanelState = {
  height: number;
  isLocked: boolean;
  width: number;
  x: number;
  y: number;
};

type FloatingQuestionPanelInteraction = {
  mode: "drag" | "resize";
  startHeight: number;
  startPointerX: number;
  startPointerY: number;
  startWidth: number;
  startX: number;
  startY: number;
};

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
    <div className="relative min-h-[150px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl lg:min-h-[170px]">
      <div className="absolute left-3 top-3 z-10 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg">
        {roleLabel}
      </div>
      <div className="absolute right-3 top-3 z-10 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs text-emerald-300 shadow-lg backdrop-blur">
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl font-black text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-semibold text-white/80">
              Camera is currently off
            </p>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/30 to-transparent px-4 py-3">
        <p className="text-sm font-bold text-white">{displayName}</p>
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
  onUploadWorksheetFile,
  participantCount,
  remoteCameraTrackByIdentity,
  remoteParticipants,
  role,
  roomMessage,
  sessionTitle,
  whiteboardStrokes,
  worksheet,
  worksheetFileUrl,
  worksheetUploadPending,
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
  onUploadWorksheetFile?: (file: File) => void;
  participantCount: number;
  remoteCameraTrackByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  remoteParticipants: Participant[];
  role: LiveKitRole;
  roomMessage?: string | null;
  sessionTitle: string;
  whiteboardStrokes: WhiteboardStroke[];
  worksheet: LessonWorksheet | null;
  worksheetFileUrl: string | null;
  worksheetUploadPending: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const questionPanelInteractionRef =
    useRef<FloatingQuestionPanelInteraction | null>(null);
  const [activePoints, setActivePoints] = useState<WhiteboardPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ height: 0, width: 0 });
  const [floatingQuestionPanel, setFloatingQuestionPanel] =
    useState<FloatingQuestionPanelState>({
      height: 420,
      isLocked: false,
      width: 560,
      x: 24,
      y: 92,
    });
  const [selectedColor, setSelectedColor] = useState("#165dff");
  const [selectedSize, setSelectedSize] = useState(4);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("pen");
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false);
  const [fullscreenErrorMessage, setFullscreenErrorMessage] = useState<
    string | null
  >(null);
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
  const boardClassName = isBoardFullscreen
    ? "relative h-screen w-screen overflow-hidden rounded-none bg-white shadow-2xl"
    : "relative min-h-[58vh] overflow-hidden rounded-2xl bg-white shadow-2xl lg:min-h-[62vh]";

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

  const clampFloatingQuestionPanel = useCallback(
    (panel: FloatingQuestionPanelState): FloatingQuestionPanelState => {
      const board = boardRef.current;
      const boardWidth = board?.clientWidth ?? window.innerWidth;
      const boardHeight = board?.clientHeight ?? window.innerHeight;
      const maxWidth = Math.max(
        QUESTION_PANEL_MIN_WIDTH,
        boardWidth - QUESTION_PANEL_PADDING * 2,
      );
      const maxHeight = Math.max(
        QUESTION_PANEL_MIN_HEIGHT,
        boardHeight - QUESTION_PANEL_PADDING * 2,
      );
      const width = Math.min(Math.max(panel.width, QUESTION_PANEL_MIN_WIDTH), maxWidth);
      const height = Math.min(
        Math.max(panel.height, QUESTION_PANEL_MIN_HEIGHT),
        maxHeight,
      );
      const maxX = Math.max(QUESTION_PANEL_PADDING, boardWidth - width - QUESTION_PANEL_PADDING);
      const maxY = Math.max(
        QUESTION_PANEL_PADDING,
        boardHeight - height - QUESTION_PANEL_PADDING,
      );

      return {
        ...panel,
        height,
        width,
        x: Math.min(Math.max(panel.x, QUESTION_PANEL_PADDING), maxX),
        y: Math.min(Math.max(panel.y, QUESTION_PANEL_PADDING), maxY),
      };
    },
    [],
  );

  const resizeBoardCanvas = useCallback(() => {
    const board = boardRef.current;

    if (!board) {
      return;
    }

    setCanvasSize({
      height: board.clientHeight,
      width: board.clientWidth,
    });
  }, []);

  const queueBoardResize = useCallback(() => {
    window.requestAnimationFrame(() => {
      resizeBoardCanvas();
      setFloatingQuestionPanel((panel) => clampFloatingQuestionPanel(panel));
      window.setTimeout(resizeBoardCanvas, 120);
    });
  }, [clampFloatingQuestionPanel, resizeBoardCanvas]);

  useEffect(() => {
    const board = boardRef.current;

    if (!board) {
      return;
    }

    resizeBoardCanvas();
    const observer = new ResizeObserver(resizeBoardCanvas);
    observer.observe(board);

    return () => observer.disconnect();
  }, [resizeBoardCanvas]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const isFullscreen = document.fullscreenElement === boardRef.current;

      setIsBoardFullscreen(isFullscreen);
      if (isFullscreen) {
        setFullscreenErrorMessage(null);
      }
      queueBoardResize();
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, [queueBoardResize]);

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

  const handleToggleBrowserFullscreen = async () => {
    const board = boardRef.current;

    if (!board) {
      return;
    }

    setFullscreenErrorMessage(null);

    try {
      if (document.fullscreenElement === board) {
        await document.exitFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await board.requestFullscreen();
      }

      queueBoardResize();
    } catch {
      setFullscreenErrorMessage(
        "Could not open browser fullscreen. Please press F11 manually.",
      );
      queueBoardResize();
    }
  };

  const handleFloatingQuestionPanelPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    mode: FloatingQuestionPanelInteraction["mode"],
  ) => {
    if (floatingQuestionPanel.isLocked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    questionPanelInteractionRef.current = {
      mode,
      startHeight: floatingQuestionPanel.height,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startWidth: floatingQuestionPanel.width,
      startX: floatingQuestionPanel.x,
      startY: floatingQuestionPanel.y,
    };
  };

  const handleFloatingQuestionPanelPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const interaction = questionPanelInteractionRef.current;

    if (!interaction) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - interaction.startPointerX;
    const deltaY = event.clientY - interaction.startPointerY;

    setFloatingQuestionPanel((panel) =>
      clampFloatingQuestionPanel({
        ...panel,
        height:
          interaction.mode === "resize"
            ? interaction.startHeight + deltaY
            : panel.height,
        width:
          interaction.mode === "resize"
            ? interaction.startWidth + deltaX
            : panel.width,
        x:
          interaction.mode === "drag"
            ? interaction.startX + deltaX
            : panel.x,
        y:
          interaction.mode === "drag"
            ? interaction.startY + deltaY
            : panel.y,
      }),
    );
  };

  const handleFloatingQuestionPanelPointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!questionPanelInteractionRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    questionPanelInteractionRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetFloatingQuestionPanel = () => {
    setFloatingQuestionPanel((panel) =>
      clampFloatingQuestionPanel({
        ...panel,
        height: 420,
        width: 560,
        x: 24,
        y: 92,
      }),
    );
  };

  const renderToolControls = (compact = false) => (
    <div className={`flex flex-wrap gap-2 ${compact ? "max-w-5xl" : ""}`}>
      {tools.map(([tool, label]) => (
        <button
          className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition ${
            selectedTool === tool
              ? "border-blue-400 bg-blue-600 text-white"
              : compact
                ? "border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-50"
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
            selectedColor === color
              ? compact
                ? "border-slate-950"
                : "border-white"
              : compact
                ? "border-slate-200"
                : "border-white/20"
          }`}
          key={color}
          onClick={() => setSelectedColor(color)}
          style={{ backgroundColor: color }}
          type="button"
        />
      ))}
      <select
        className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${
          compact
            ? "border-slate-200 bg-white text-slate-950"
            : "border-white/10 bg-white/5 text-white"
        }`}
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
      <Button
        onClick={handleToggleBrowserFullscreen}
        variant={isBoardFullscreen ? "primary" : "secondary"}
      >
        {isBoardFullscreen ? "Exit full screen" : "Full screen"}
      </Button>
    </div>
  );

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

        <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
          <ConsultationVideoTile
            label="Tutor"
            participant={tutorParticipant}
            roleLabel="Tutor"
            trackRef={tutorTrackRef}
          />

          <ClassroomDocumentViewer
            canUpload={role === "teacher"}
            isUploading={worksheetUploadPending}
            onUploadFile={onUploadWorksheetFile}
            signedUrl={worksheetFileUrl}
            worksheet={worksheet}
          />

          <ConsultationVideoTile
            label="Student"
            participant={studentParticipant}
            roleLabel={role === "student" ? "You (Student)" : "Student"}
            trackRef={studentTrackRef}
          />
        </section>

        <section
          className={boardClassName}
          ref={boardRef}
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg backdrop-blur">
              Consultation whiteboard
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-2">
              <Button onClick={onUndoWhiteboard} disabled={!canUndo} variant="secondary">
                Undo
              </Button>
              <Button
                disabled={!canClear}
                onClick={onClearWhiteboard}
                variant="secondary"
              >
                Clear board
              </Button>
              <Button
                onClick={handleToggleBrowserFullscreen}
                variant={isBoardFullscreen ? "primary" : "secondary"}
              >
                {isBoardFullscreen ? "Exit full screen" : "Full screen"}
              </Button>
            </div>
          </div>
          {fullscreenErrorMessage ? (
            <div className="absolute left-4 top-24 z-10 max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg">
              {fullscreenErrorMessage}
            </div>
          ) : null}
          <canvas
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerLeave={finishStroke}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={canvasRef}
          />
          {isBoardFullscreen ? (
            <div
              className="absolute z-20 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              style={{
                height: floatingQuestionPanel.height,
                left: floatingQuestionPanel.x,
                top: floatingQuestionPanel.y,
                width: floatingQuestionPanel.width,
              }}
            >
              <div
                className={`flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white ${
                  floatingQuestionPanel.isLocked
                    ? "cursor-default"
                    : "cursor-move touch-none"
                }`}
                onPointerDown={(event) =>
                  handleFloatingQuestionPanelPointerDown(event, "drag")
                }
                onPointerMove={handleFloatingQuestionPanelPointerMove}
                onPointerUp={handleFloatingQuestionPanelPointerUp}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">Floating question</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    {floatingQuestionPanel.isLocked
                      ? "Position locked"
                      : "Drag header to move"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFloatingQuestionPanel((panel) => ({
                        ...panel,
                        isLocked: !panel.isLocked,
                      }));
                    }}
                    type="button"
                  >
                    {floatingQuestionPanel.isLocked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    disabled={floatingQuestionPanel.isLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      resetFloatingQuestionPanel();
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ClassroomDocumentViewer
                  canUpload={role === "teacher"}
                  compact
                  isUploading={worksheetUploadPending}
                  onUploadFile={onUploadWorksheetFile}
                  signedUrl={worksheetFileUrl}
                  worksheet={worksheet}
                />
              </div>
              {!floatingQuestionPanel.isLocked ? (
                <div
                  aria-label="Resize floating question"
                  className="absolute bottom-2 right-2 h-8 w-8 cursor-nwse-resize rounded-br-2xl rounded-tl-xl border-b-4 border-r-4 border-blue-600 bg-white/80 shadow-lg touch-none"
                  onPointerDown={(event) =>
                    handleFloatingQuestionPanelPointerDown(event, "resize")
                  }
                  onPointerMove={handleFloatingQuestionPanelPointerMove}
                  onPointerUp={handleFloatingQuestionPanelPointerUp}
                  title="Resize floating question"
                />
              ) : null}
            </div>
          ) : null}
          {isBoardFullscreen ? (
            <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
              {renderToolControls(true)}
            </div>
          ) : null}
        </section>

        <footer className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 shadow-2xl backdrop-blur xl:grid-cols-[1fr_auto_auto] xl:items-center">
          {renderToolControls()}

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

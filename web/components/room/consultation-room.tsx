"use client";

import {
  type TrackReference,
  type TrackReferenceOrPlaceholder,
  VideoTrack,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
import { validateWorksheetFile } from "@/lib/worksheet-files";

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

type DocumentSize = {
  height: number;
  key: string;
  width: number;
};

type QuestionPosition = "center" | "left" | "right";

type PanInteraction = {
  pointerX: number;
  pointerY: number;
  scrollLeft: number;
  scrollTop: number;
};

const PDF_WORKER_SRC = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

const CONSULTATION_COLORS = [
  "#111827",
  "#dc2626",
  "#f97316",
  "#facc15",
  "#165dff",
  "#16a34a",
  "#7c3aed",
];

function isTrackReference(
  trackRef: TrackReferenceOrPlaceholder | null,
): trackRef is TrackReference {
  return trackRef !== null && trackRef.publication !== undefined;
}

function isPdfWorksheet(worksheet: LessonWorksheet | null) {
  return worksheet?.file_mime_type === "application/pdf";
}

function isImageWorksheet(worksheet: LessonWorksheet | null) {
  return worksheet?.file_mime_type?.startsWith("image/") ?? false;
}

function drawStroke(
  context: CanvasRenderingContext2D,
  height: number,
  lineScale: number,
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
  context.lineWidth = Math.max(1, stroke.size * lineScale);

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
  canRedo,
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
  onRedoWhiteboard,
  onStrokeComplete,
  onToggleCamera,
  onToggleMicrophone,
  onUndoWhiteboard,
  onUploadWorksheetFile,
  onWorksheetPageChange,
  participantCount,
  remoteCameraTrackByIdentity,
  remoteParticipants,
  role,
  roomMessage,
  sessionTitle,
  whiteboardStrokes,
  worksheet,
  worksheetFileUrl,
  worksheetPageNumber,
  worksheetUploadPending,
}: {
  canRedo: boolean;
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
  onRedoWhiteboard: () => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onUndoWhiteboard: () => void;
  onUploadWorksheetFile?: (file: File) => void;
  onWorksheetPageChange: (pageNumber: number) => void;
  participantCount: number;
  remoteCameraTrackByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  remoteParticipants: Participant[];
  role: LiveKitRole;
  roomMessage?: string | null;
  sessionTitle: string;
  whiteboardStrokes: WhiteboardStroke[];
  worksheet: LessonWorksheet | null;
  worksheetFileUrl: string | null;
  worksheetPageNumber: number;
  worksheetUploadPending: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const worksheetSurfaceRef = useRef<HTMLDivElement | null>(null);
  const worksheetPdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const worksheetPdfRenderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const panInteractionRef = useRef<PanInteraction | null>(null);
  const uploadInputId = useId();
  const [activePoints, setActivePoints] = useState<WhiteboardPoint[]>([]);
  const [imageNaturalSize, setImageNaturalSize] = useState<DocumentSize | null>(
    null,
  );
  const [isWorksheetPdfLoading, setIsWorksheetPdfLoading] = useState(false);
  const [questionPosition, setQuestionPosition] =
    useState<QuestionPosition>("center");
  const [questionZoom, setQuestionZoom] = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);
  const [worksheetSurfaceSize, setWorksheetSurfaceSize] = useState({
    height: 0,
    width: 0,
  });
  const [worksheetPageCount, setWorksheetPageCount] = useState(0);
  const [worksheetPdfDocument, setWorksheetPdfDocument] =
    useState<PdfDocumentProxy | null>(null);
  const [worksheetPdfError, setWorksheetPdfError] = useState<string | null>(null);
  const [worksheetPdfPageSize, setWorksheetPdfPageSize] =
    useState<DocumentSize | null>(null);
  const [selectedColor, setSelectedColor] = useState("#165dff");
  const [selectedSize, setSelectedSize] = useState(4);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("pen");
  const [isPanning, setIsPanning] = useState(false);
  const [showBottomToolbar, setShowBottomToolbar] = useState(true);
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
  const isWorksheetPdf = isPdfWorksheet(worksheet);
  const isWorksheetImage = isImageWorksheet(worksheet);
  const canUploadWorksheet = role === "teacher" && Boolean(onUploadWorksheetFile);
  const uploadLabel = worksheet?.file_path ? "Replace question" : "Upload question";
  const worksheetFileKey = worksheet?.file_path ?? "sample-question";
  const worksheetPageKey = `${worksheetFileKey}:${worksheetPageNumber}`;
  const worksheetDocumentSize =
    isWorksheetImage && imageNaturalSize?.key === worksheetFileKey
      ? imageNaturalSize
      : isWorksheetPdf && worksheetPdfPageSize?.key === worksheetPageKey
        ? worksheetPdfPageSize
        : null;
  const worksheetAvailableSize = useMemo(
    () => ({
      height: Math.max((worksheetSurfaceSize.height || 620) - 32, 240),
      width: Math.max((worksheetSurfaceSize.width || 900) - 32, 320),
    }),
    [worksheetSurfaceSize.height, worksheetSurfaceSize.width],
  );

  const worksheetQuestionSize = useMemo(() => {
    if (!worksheetDocumentSize?.width || !worksheetDocumentSize.height) {
      return {
        height: Math.round(worksheetAvailableSize.height * questionZoom),
        width: Math.round(worksheetAvailableSize.width * questionZoom),
      };
    }

    const fitScale = Math.min(
      worksheetAvailableSize.width / worksheetDocumentSize.width,
      worksheetAvailableSize.height / worksheetDocumentSize.height,
    );

    return {
      height: Math.max(
        1,
        Math.round(worksheetDocumentSize.height * fitScale * questionZoom),
      ),
      width: Math.max(
        1,
        Math.round(worksheetDocumentSize.width * fitScale * questionZoom),
      ),
    };
  }, [questionZoom, worksheetAvailableSize, worksheetDocumentSize]);

  const worksheetContentSize = useMemo(() => {
    // The writable paper is at least the visible board size, so blank side space is drawable.
    return {
      height: Math.max(
        Math.round(worksheetAvailableSize.height * questionZoom),
        worksheetQuestionSize.height,
      ),
      width: Math.max(
        Math.round(worksheetAvailableSize.width * questionZoom),
        worksheetQuestionSize.width,
      ),
    };
  }, [
    questionZoom,
    worksheetAvailableSize,
    worksheetQuestionSize.height,
    worksheetQuestionSize.width,
  ]);
  const boardClassName = isBoardFullscreen
    ? "relative h-screen w-screen overflow-hidden rounded-none bg-white shadow-2xl"
    : "relative min-h-[58vh] overflow-hidden rounded-2xl bg-white shadow-2xl lg:min-h-[62vh]";
  const worksheetSurfaceClassName = isBoardFullscreen
    ? "absolute inset-x-4 bottom-28 top-20 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-inner"
    : "absolute inset-x-4 bottom-4 top-20 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-inner";
  const worksheetContentFrameClassName =
    questionZoom > 1.01
      ? "flex min-h-full min-w-full items-start justify-start p-4"
      : "flex min-h-full min-w-full items-center justify-center p-4";
  const worksheetQuestionPositionClassName =
    questionPosition === "left"
      ? "justify-start"
      : questionPosition === "right"
        ? "justify-end"
        : "justify-center";

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

  const resizeBoardCanvas = useCallback(() => {
    const surface = worksheetSurfaceRef.current;

    if (!surface) {
      return;
    }

    setWorksheetSurfaceSize({
      height: surface.clientHeight,
      width: surface.clientWidth,
    });
  }, []);

  const queueBoardResize = useCallback(() => {
    window.requestAnimationFrame(() => {
      resizeBoardCanvas();
      window.setTimeout(resizeBoardCanvas, 120);
    });
  }, [resizeBoardCanvas]);

  useEffect(() => {
    const surface = worksheetSurfaceRef.current;

    if (!surface) {
      return;
    }

    resizeBoardCanvas();
    const observer = new ResizeObserver(resizeBoardCanvas);
    observer.observe(surface);

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
    const sourceUrl = isWorksheetPdf && worksheetFileUrl ? worksheetFileUrl : "";

    worksheetPdfRenderTaskRef.current?.cancel();

    if (!sourceUrl) {
      return;
    }

    let isMounted = true;

    async function loadPdf() {
      setWorksheetPdfError(null);
      setIsWorksheetPdfLoading(true);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const loadingTask = pdfjs.getDocument({ url: sourceUrl });
        const loadedDocument = await loadingTask.promise;

        if (!isMounted) {
          return;
        }

        setWorksheetPdfDocument(loadedDocument);
        setWorksheetPageCount(loadedDocument.numPages);

        if (worksheetPageNumber > loadedDocument.numPages) {
          onWorksheetPageChange(1);
        }
      } catch (error) {
        if (isMounted) {
          setWorksheetPdfError(
            error instanceof Error
              ? error.message
              : "Unable to render this PDF on the whiteboard.",
          );
        }
      } finally {
        if (isMounted) {
          setIsWorksheetPdfLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      isMounted = false;
      worksheetPdfRenderTaskRef.current?.cancel();
    };
  }, [
    isWorksheetPdf,
    onWorksheetPageChange,
    worksheetFileUrl,
    worksheetPageNumber,
  ]);

  useEffect(() => {
    if (!worksheetPdfDocument || !isWorksheetPdf) {
      return;
    }

    const pdfDocument = worksheetPdfDocument;
    let isMounted = true;

    async function loadPageSize() {
      try {
        const safePageNumber = Math.max(
          1,
          Math.min(worksheetPageNumber, pdfDocument.numPages),
        );
        const page = await pdfDocument.getPage(safePageNumber);
        const viewport = page.getViewport({ scale: 1 });

        if (isMounted) {
          setWorksheetPdfPageSize({
            height: viewport.height,
            key: worksheetPageKey,
            width: viewport.width,
          });
        }
      } catch (error) {
        if (isMounted) {
          setWorksheetPdfError(
            error instanceof Error
              ? error.message
              : "Unable to measure this PDF page.",
          );
        }
      }
    }

    void loadPageSize();

    return () => {
      isMounted = false;
    };
  }, [
    isWorksheetPdf,
    worksheetPageKey,
    worksheetPageNumber,
    worksheetPdfDocument,
  ]);

  const renderWorksheetPdfPage = useCallback(async () => {
    const canvas = worksheetPdfCanvasRef.current;

    if (!canvas || !worksheetPdfDocument) {
      return;
    }

    worksheetPdfRenderTaskRef.current?.cancel();
    setWorksheetPdfError(null);
    setIsWorksheetPdfLoading(true);

    try {
      const safePageNumber = Math.max(
        1,
        Math.min(worksheetPageNumber, worksheetPdfDocument.numPages),
      );
      const page = await worksheetPdfDocument.getPage(safePageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.max(0.1, worksheetQuestionSize.width / unscaledViewport.width),
      });
      const pixelRatio = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("This browser cannot render the PDF worksheet.");
      }

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${worksheetQuestionSize.width}px`;
      canvas.style.height = `${worksheetQuestionSize.height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });

      worksheetPdfRenderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (error) {
      if (error instanceof Error && error.name === "RenderingCancelledException") {
        return;
      }

      setWorksheetPdfError(
        error instanceof Error
          ? error.message
          : "Unable to render this PDF page on the whiteboard.",
      );
    } finally {
      setIsWorksheetPdfLoading(false);
    }
  }, [
    worksheetPageNumber,
    worksheetQuestionSize.height,
    worksheetQuestionSize.width,
    worksheetPdfDocument,
  ]);

  useEffect(() => {
    if (!worksheetPdfDocument) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void renderWorksheetPdfPage();
    });
    const surface = worksheetSurfaceRef.current;

    if (!surface) {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(() => {
      void renderWorksheetPdfPage();
    });
    observer.observe(surface);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [renderWorksheetPdfPage, worksheetPdfDocument]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.width = worksheetContentSize.width;
    canvas.height = worksheetContentSize.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    whiteboardStrokes.forEach((stroke) =>
      drawStroke(context, canvas.height, questionZoom, stroke, canvas.width),
    );

    if (currentStrokeRef.current) {
      drawStroke(
        context,
        canvas.height,
        questionZoom,
        currentStrokeRef.current,
        canvas.width,
      );
    }
  }, [
    activePoints,
    questionZoom,
    whiteboardStrokes,
    worksheetContentSize.height,
    worksheetContentSize.width,
  ]);

  const handleBoardUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !onUploadWorksheetFile) {
      return;
    }

    try {
      validateWorksheetFile(file);
      onUploadWorksheetFile(file);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Please upload a PNG, JPEG, or PDF worksheet file.",
      );
    }
  };

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
    if (isPanMode) {
      const surface = worksheetSurfaceRef.current;

      if (!surface) {
        return;
      }

      panInteractionRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scrollLeft: surface.scrollLeft,
        scrollTop: surface.scrollTop,
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

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
    const panInteraction = panInteractionRef.current;

    if (panInteraction) {
      const surface = worksheetSurfaceRef.current;

      if (!surface) {
        return;
      }

      surface.scrollLeft =
        panInteraction.scrollLeft - (event.clientX - panInteraction.pointerX);
      surface.scrollTop =
        panInteraction.scrollTop - (event.clientY - panInteraction.pointerY);
      return;
    }

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
    if (panInteractionRef.current) {
      panInteractionRef.current = null;
      setIsPanning(false);
    } else {
      finishStroke();
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerLeave = () => {
    if (panInteractionRef.current) {
      panInteractionRef.current = null;
      setIsPanning(false);
      return;
    }

    finishStroke();
  };

  const handleTogglePanMode = () => {
    panInteractionRef.current = null;
    setIsPanning(false);
    currentStrokeRef.current = null;
    setActivePoints([]);
    setIsPanMode((isMoving) => !isMoving);
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

  const setClampedQuestionZoom = (nextZoom: number) => {
    setQuestionZoom(Math.min(3, Math.max(0.5, Number(nextZoom.toFixed(2)))));
    queueBoardResize();
  };

  const handleZoomOut = () => {
    setClampedQuestionZoom(questionZoom - 0.25);
  };

  const handleZoomIn = () => {
    setClampedQuestionZoom(questionZoom + 0.25);
  };

  const handleFitQuestion = () => {
    setClampedQuestionZoom(1);
  };

  const scrollWorksheetSurface = (direction: "left" | "right") => {
    const surface = worksheetSurfaceRef.current;

    if (!surface) {
      return;
    }

    surface.scrollBy({
      behavior: "smooth",
      left:
        direction === "left"
          ? -Math.max(240, surface.clientWidth * 0.55)
          : Math.max(240, surface.clientWidth * 0.55),
    });
  };

  const handleWorksheetWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const surface = worksheetSurfaceRef.current;

    if (!surface || !event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    surface.scrollLeft += event.deltaY;
  };

  const renderToolControls = (compact = false) => (
    <div className={`flex flex-wrap gap-2 ${compact ? "max-w-5xl" : ""}`}>
      {tools.map(([tool, label]) => (
        <button
          className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition ${
            !isPanMode && selectedTool === tool
              ? "border-blue-400 bg-blue-600 text-white"
              : compact
                ? "border-slate-200 bg-white text-slate-950 shadow-sm hover:bg-slate-50"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
          }`}
          key={tool}
          onClick={() => {
            setIsPanMode(false);
            setSelectedTool(tool);
          }}
          type="button"
        >
          {label}
        </button>
      ))}
      <Button
        onClick={handleTogglePanMode}
        variant={isPanMode ? "primary" : "secondary"}
      >
        {isPanMode ? "Write mode" : "Move board"}
      </Button>
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
      <Button disabled={!canRedo} onClick={onRedoWhiteboard} variant="secondary">
        Redo
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
        >
          <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg backdrop-blur">
              Question whiteboard
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-2">
              {canUploadWorksheet ? (
                <>
                  <label
                    className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 ${
                      worksheetUploadPending ? "pointer-events-none opacity-60" : ""
                    }`}
                    htmlFor={uploadInputId}
                  >
                    {worksheetUploadPending ? "Uploading..." : uploadLabel}
                  </label>
                  <input
                    accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
                    className="sr-only"
                    disabled={worksheetUploadPending}
                    id={uploadInputId}
                    onChange={handleBoardUploadChange}
                    type="file"
                  />
                </>
              ) : null}
              {isWorksheetPdf && worksheetFileUrl && worksheetPageCount > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/90 px-2 py-1 shadow-lg">
                  {role === "teacher" ? (
                    <Button
                      disabled={worksheetPageNumber <= 1}
                      onClick={() => onWorksheetPageChange(worksheetPageNumber - 1)}
                      variant="secondary"
                    >
                      Prev page
                    </Button>
                  ) : null}
                  <span className="px-2 text-sm font-bold text-slate-700">
                    Page {worksheetPageNumber} / {worksheetPageCount}
                  </span>
                  {role === "teacher" ? (
                    <Button
                      disabled={worksheetPageNumber >= worksheetPageCount}
                      onClick={() => onWorksheetPageChange(worksheetPageNumber + 1)}
                      variant="secondary"
                    >
                      Next page
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center gap-2 rounded-xl bg-white/90 px-2 py-1 shadow-lg">
                <Button
                  disabled={questionZoom <= 0.5}
                  onClick={handleZoomOut}
                  variant="secondary"
                >
                  Zoom -
                </Button>
                <span className="min-w-14 text-center text-sm font-black text-slate-700">
                  {Math.round(questionZoom * 100)}%
                </span>
                <Button
                  disabled={questionZoom >= 3}
                  onClick={handleZoomIn}
                  variant="secondary"
                >
                  Zoom +
                </Button>
                <Button
                  disabled={questionZoom === 1}
                  onClick={handleFitQuestion}
                  variant="secondary"
                >
                  Fit
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/90 px-2 py-1 shadow-lg">
                <span className="px-2 text-sm font-black text-slate-700">
                  Position
                </span>
                {(["left", "center", "right"] as const).map((position) => (
                  <Button
                    key={position}
                    onClick={() => setQuestionPosition(position)}
                    variant={
                      questionPosition === position ? "primary" : "secondary"
                    }
                  >
                    {position === "left"
                      ? "Left"
                      : position === "right"
                        ? "Right"
                        : "Center"}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/90 px-2 py-1 shadow-lg">
                <span className="px-2 text-sm font-black text-slate-700">
                  Move
                </span>
                <Button
                  onClick={handleTogglePanMode}
                  variant={isPanMode ? "primary" : "secondary"}
                >
                  {isPanMode ? "Write" : "Drag"}
                </Button>
                <Button
                  onClick={() => scrollWorksheetSurface("left")}
                  variant="secondary"
                >
                  Left
                </Button>
                <Button
                  onClick={() => scrollWorksheetSurface("right")}
                  variant="secondary"
                >
                  Right
                </Button>
              </div>
              <Button onClick={onUndoWhiteboard} disabled={!canUndo} variant="secondary">
                Undo
              </Button>
              <Button onClick={onRedoWhiteboard} disabled={!canRedo} variant="secondary">
                Redo
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
              <Button
                onClick={() => setShowBottomToolbar((isVisible) => !isVisible)}
                variant="secondary"
              >
                {showBottomToolbar ? "Hide tools" : "Show tools"}
              </Button>
            </div>
          </div>
          {fullscreenErrorMessage ? (
            <div className="absolute left-4 top-24 z-30 max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg">
              {fullscreenErrorMessage}
            </div>
          ) : null}
          <div
            className={worksheetSurfaceClassName}
            onWheel={handleWorksheetWheel}
            ref={worksheetSurfaceRef}
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            <div className={worksheetContentFrameClassName}>
              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  height: worksheetContentSize.height,
                  width: worksheetContentSize.width,
                }}
              >
                <div
                  className={`pointer-events-none absolute inset-0 flex items-center ${worksheetQuestionPositionClassName}`}
                >
                  {!worksheet?.file_path ? (
                    <div className="mx-6 max-w-md rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-5 py-4 text-center text-sm font-semibold text-slate-700">
                      {role === "teacher"
                        ? "Upload a PNG, JPEG, or PDF question to turn this board into a writable worksheet."
                        : "Waiting for the teacher to upload a question page."}
                    </div>
                  ) : !worksheetFileUrl ? (
                    <p className="rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-lg">
                      Preparing question page...
                    </p>
                  ) : isWorksheetImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={worksheet.file_name ?? "Uploaded question page"}
                      className="rounded-lg bg-white object-contain shadow-lg"
                      onLoad={(event) => {
                        setImageNaturalSize({
                          height: event.currentTarget.naturalHeight,
                          key: worksheetFileKey,
                          width: event.currentTarget.naturalWidth,
                        });
                      }}
                      style={{
                        height: worksheetQuestionSize.height,
                        width: worksheetQuestionSize.width,
                      }}
                      src={worksheetFileUrl}
                    />
                  ) : isWorksheetPdf ? (
                    <canvas
                      className="rounded-lg bg-white shadow-lg"
                      ref={worksheetPdfCanvasRef}
                      style={{
                        height: worksheetQuestionSize.height,
                        width: worksheetQuestionSize.width,
                      }}
                    />
                  ) : (
                    <a
                      className="pointer-events-auto rounded-2xl bg-white px-5 py-4 text-sm font-bold text-blue-700 underline shadow-lg"
                      href={worksheetFileUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open uploaded question file
                    </a>
                  )}
                  {isWorksheetPdf && isWorksheetPdfLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-slate-500">
                      Rendering question page...
                    </div>
                  ) : null}
                  {isWorksheetPdf && worksheetPdfError ? (
                    <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                      {worksheetPdfError}
                    </div>
                  ) : null}
                </div>
                <canvas
                  className={`absolute inset-0 z-10 h-full w-full touch-none ${
                    isPanMode
                      ? isPanning
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : "cursor-crosshair"
                  }`}
                  onPointerDown={handlePointerDown}
                  onPointerLeave={handlePointerLeave}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  ref={canvasRef}
                />
              </div>
            </div>
          </div>
          {isBoardFullscreen && showBottomToolbar ? (
            <div className="absolute inset-x-4 bottom-4 z-30 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
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

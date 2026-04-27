"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { WhiteboardPoint, WhiteboardStroke } from "@/lib/livekit/signals";
import type { LiveKitRole } from "@/lib/types";

const TEACHER_STROKE = "#165dff";
const STUDENT_STROKE = "#f97316";

function drawStroke(
  context: CanvasRenderingContext2D,
  height: number,
  stroke: WhiteboardStroke,
  width: number,
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.strokeStyle = stroke.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.size;

  const [firstPoint, ...restPoints] = stroke.points;
  context.beginPath();
  context.moveTo(firstPoint.x * width, firstPoint.y * height);

  restPoints.forEach((point) => {
    context.lineTo(point.x * width, point.y * height);
  });

  if (restPoints.length === 0) {
    context.lineTo(firstPoint.x * width + 0.5, firstPoint.y * height + 0.5);
  }

  context.stroke();
}

export function WhiteboardOverlay({
  enabled,
  onClear,
  onStrokeComplete,
  role,
  strokes,
}: {
  enabled: boolean;
  onClear: () => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  role: LiveKitRole;
  strokes: WhiteboardStroke[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const [activePoints, setActivePoints] = useState<WhiteboardPoint[]>([]);
  const [canvasSize, setCanvasSize] = useState({ height: 0, width: 0 });
  const strokeColor = useMemo(
    () => (role === "teacher" ? TEACHER_STROKE : STUDENT_STROKE),
    [role],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
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
    strokes.forEach((stroke) =>
      drawStroke(context, canvas.height, stroke, canvas.width),
    );

    if (currentStrokeRef.current) {
      drawStroke(context, canvas.height, currentStrokeRef.current, canvas.width);
    }
  }, [canvasSize.height, canvasSize.width, strokes, activePoints]);

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
      size: 4,
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
      points: [...currentStrokeRef.current.points, point],
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

  return (
    <div className="absolute inset-0 z-20" ref={wrapperRef}>
      <div className="pointer-events-none absolute left-4 top-4 z-30 flex gap-3">
        <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-xs text-white backdrop-blur">
          Shared whiteboard {enabled ? "is active" : "is hidden"}
        </div>
        {role === "teacher" && enabled ? (
          <div className="pointer-events-auto">
            <Button onClick={onClear} variant="danger">
              Clear board
            </Button>
          </div>
        ) : null}
      </div>
      <canvas
        className={`absolute inset-0 h-full w-full ${enabled ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"}`}
        onPointerDown={handlePointerDown}
        onPointerLeave={finishStroke}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
      />
    </div>
  );
}

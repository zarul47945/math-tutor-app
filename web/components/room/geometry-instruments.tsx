"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  angleDelta,
  arcPath,
  constructionStroke,
  GEOMETRY_LABELS,
  instrumentPoint,
  rotateGeometryPoint,
  type GeometryInstrument,
  type GeometryTool,
} from "@/lib/geometry-tools";
import type { WhiteboardStroke } from "@/lib/livekit/signals";

type InstrumentProps = {
  instrument: GeometryInstrument;
  onChange: (instrument: GeometryInstrument) => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  color: string;
  size: number;
  onFitToView?: () => void;
};

export function GeometryInstrumentPanel({
  instrument,
  onChange,
  onStrokeComplete,
  color,
  size,
  onFitToView,
}: InstrumentProps) {
  const updateNumber = (
    key: "rotation" | "angle" | "sweep" | "radius" | "size",
    value: number,
  ) => {
    if (Number.isFinite(value)) onChange({ ...instrument, [key]: value });
  };
  return (
    <div
      className="geometry-instrument-panel"
      aria-label={`${GEOMETRY_LABELS[instrument.kind]} controls`}
    >
      <strong className="shrink-0">{GEOMETRY_LABELS[instrument.kind]}</strong>
      <label className="inline-flex shrink-0 items-center gap-1">
        Rotate
        <input
          aria-label="Instrument rotation"
          type="number"
          step="1"
          disabled={instrument.locked}
          value={Math.round(((instrument.rotation % 360) + 360) % 360)}
          onChange={(event) =>
            updateNumber("rotation", event.target.valueAsNumber)
          }
        />
        <span>°</span>
      </label>
      <label className="inline-flex shrink-0 items-center gap-1">
        {instrument.kind === "compass" ? "Opening" : "Size"}
        <input
          aria-label={
            instrument.kind === "compass"
              ? "Compass opening"
              : "Instrument size"
          }
          type="range"
          min={instrument.kind === "compass" ? 0.01 : 0.02}
          max="0.8"
          step="0.005"
          disabled={instrument.locked}
          value={
            instrument.kind === "compass" ? instrument.radius : instrument.size
          }
          onChange={(event) =>
            updateNumber(
              instrument.kind === "compass" ? "radius" : "size",
              event.target.valueAsNumber,
            )
          }
        />
      </label>
      {instrument.kind === "protractor" ? (
        <label className="inline-flex shrink-0 items-center gap-1">
          Angle
          <input
            aria-label="Measured angle"
            type="number"
            min="0"
            max="180"
            step="1"
            value={instrument.angle}
            onChange={(event) =>
              updateNumber(
                "angle",
                Math.max(0, Math.min(180, event.target.valueAsNumber)),
              )
            }
          />
          °
        </label>
      ) : null}
      {instrument.kind === "compass" ? (
        <label className="inline-flex shrink-0 items-center gap-1">
          Arc
          <input
            aria-label="Compass arc angle"
            type="number"
            min="-360"
            max="360"
            step="1"
            value={instrument.sweep}
            onChange={(event) =>
              updateNumber(
                "sweep",
                Math.max(-360, Math.min(360, event.target.valueAsNumber)),
              )
            }
          />
          °
        </label>
      ) : null}
      <button
        type="button"
        aria-pressed={instrument.locked}
        onClick={() => onChange({ ...instrument, locked: !instrument.locked })}
      >
        {instrument.locked ? "Unlock position" : "Lock position"}
      </button>
      {onFitToView ? (
        <button
          type="button"
          disabled={instrument.locked}
          onClick={onFitToView}
        >
          Fit instrument
        </button>
      ) : null}
      <button
        className="geometry-draw-action"
        type="button"
        onClick={() =>
          onStrokeComplete(constructionStroke(instrument, color, size))
        }
      >
        {instrument.kind === "compass"
          ? "Draw arc"
          : instrument.kind === "protractor"
            ? "Draw angle"
            : instrument.kind === "set-square"
              ? "Draw triangle"
              : "Draw line"}
      </button>
      {instrument.kind === "compass" ? (
        <button
          type="button"
          onClick={() =>
            onStrokeComplete(
              constructionStroke(instrument, color, size, "circle"),
            )
          }
        >
          Draw circle
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onChange({ ...instrument, visible: false })}
      >
        Hide instrument
      </button>
      <span className="shrink-0 text-slate-500">
        {instrument.kind === "compass"
          ? "Drag the needle to move, the pencil to open, and the round handle to draw."
          : instrument.kind === "protractor"
            ? "Move the body, rotate the blue handle, and drag the gold marker to measure."
            : "Move the body. Rotate with the blue handle. Trace along an edge to draw."}
      </span>
    </div>
  );
}

type Point = { x: number; y: number };
type Action =
  "move" | "rotate" | "resize" | "open" | "measure" | "sweep" | "trace";
type Interaction = {
  action: Action;
  instrument: GeometryInstrument;
  pointer: Point;
  previousAngle: number;
  totalAngle: number;
  strokeId: string;
  edge?: [Point, Point];
  startFraction: number;
};

export function GeometryInstruments({
  instruments,
  role,
  width,
  height,
  color,
  size,
  lineScale = 1,
  onChange,
  onStrokeComplete,
  onSelect,
}: {
  instruments: GeometryInstrument[];
  role: GeometryInstrument["owner"];
  width: number;
  height: number;
  color: string;
  size: number;
  lineScale?: number;
  onChange: (instrument: GeometryInstrument) => void;
  onStrokeComplete: (stroke: WhiteboardStroke) => void;
  onSelect: (kind: GeometryTool) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const draftRef = useRef<GeometryInstrument | null>(null);
  const strokeRef = useRef<WhiteboardStroke | null>(null);
  const publishTimeRef = useRef(0);
  const [draft, setDraft] = useState<GeometryInstrument | null>(null);
  const [preview, setPreview] = useState<WhiteboardStroke | null>(null);

  const pointer = (event: ReactPointerEvent) => {
    const bounds = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) * width) / bounds.width,
      y: ((event.clientY - bounds.top) * height) / bounds.height,
    };
  };
  const relativePoint = (point: Point, instrument: GeometryInstrument) =>
    rotateGeometryPoint(
      (point.x - instrument.x * width) / width,
      (point.y - instrument.y * height) / width,
      -instrument.rotation,
    );
  const edgeFraction = (
    point: Point,
    instrument: GeometryInstrument,
    edge: [Point, Point],
  ) => {
    const local = relativePoint(point, instrument);
    const dx = edge[1].x - edge[0].x;
    const dy = edge[1].y - edge[0].y;
    return Math.max(
      0,
      Math.min(
        1,
        ((local.x - edge[0].x) * dx + (local.y - edge[0].y) * dy) /
          (dx * dx + dy * dy),
      ),
    );
  };
  const begin = (
    event: ReactPointerEvent,
    instrument: GeometryInstrument,
    action: Action,
    edge?: [Point, Point],
  ) => {
    if (
      instrument.owner !== role ||
      (instrument.locked && !["trace", "sweep", "measure"].includes(action))
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(instrument.kind);
    const point = pointer(event);
    interactionRef.current = {
      action,
      instrument,
      pointer: point,
      previousAngle:
        (Math.atan2(
          point.y - instrument.y * height,
          point.x - instrument.x * width,
        ) *
          180) /
        Math.PI,
      totalAngle: 0,
      edge,
      startFraction: edge ? edgeFraction(point, instrument, edge) : 0,
      strokeId: crypto.randomUUID(),
    };
    draftRef.current = instrument;
    setDraft(instrument);
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const update = (next: GeometryInstrument, timestamp: number) => {
    draftRef.current = next;
    setDraft(next);
    if (timestamp - publishTimeRef.current > 60) {
      publishTimeRef.current = timestamp;
      onChange(next);
    }
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    event.preventDefault();
    const original = interaction.instrument;
    const point = pointer(event);
    const dx = point.x - original.x * width;
    const dy = point.y - original.y * height;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (interaction.action === "move") {
      update(
        {
          ...original,
          x: Math.max(
            0,
            Math.min(1, original.x + (point.x - interaction.pointer.x) / width),
          ),
          y: Math.max(
            0,
            Math.min(
              1,
              original.y + (point.y - interaction.pointer.y) / height,
            ),
          ),
        },
        event.timeStamp,
      );
    } else if (
      interaction.action === "rotate" ||
      interaction.action === "sweep"
    ) {
      interaction.totalAngle += angleDelta(interaction.previousAngle, angle);
      interaction.previousAngle = angle;
      const total =
        interaction.action === "sweep"
          ? Math.max(-360, Math.min(360, interaction.totalAngle))
          : interaction.totalAngle;
      update(
        { ...original, rotation: original.rotation + total },
        event.timeStamp,
      );
      if (interaction.action === "sweep") {
        const stroke = constructionStroke(original, color, size);
        stroke.id = interaction.strokeId;
        stroke.construction = {
          kind: "arc",
          radius: original.radius,
          startAngle: original.rotation,
          sweep: total,
        };
        strokeRef.current = stroke;
        setPreview(stroke);
      }
    } else if (interaction.action === "open") {
      update(
        {
          ...original,
          radius: Math.max(0.01, Math.min(1, Math.hypot(dx, dy) / width)),
          rotation: angle,
        },
        event.timeStamp,
      );
    } else if (interaction.action === "resize") {
      const startingDistance = Math.hypot(
        interaction.pointer.x - original.x * width,
        interaction.pointer.y - original.y * height,
      );
      update(
        {
          ...original,
          size: Math.max(
            0.02,
            Math.min(
              1,
              (original.size * Math.hypot(dx, dy)) /
                Math.max(1, startingDistance),
            ),
          ),
        },
        event.timeStamp,
      );
    } else if (interaction.action === "measure") {
      const local = relativePoint(point, original);
      update(
        {
          ...original,
          angle: Math.round(
            Math.max(
              0,
              Math.min(180, (Math.atan2(-local.y, local.x) * 180) / Math.PI),
            ),
          ),
        },
        event.timeStamp,
      );
    } else if (interaction.edge) {
      const fraction = edgeFraction(point, original, interaction.edge);
      const [start, end] = interaction.edge;
      const ex = end.x - start.x;
      const ey = end.y - start.y;
      const anchor = instrumentPoint(
        original,
        {
          x: start.x + ex * interaction.startFraction,
          y: start.y + ey * interaction.startFraction,
        },
        width,
        height,
      );
      const stroke: WhiteboardStroke = {
        id: interaction.strokeId,
        author: role,
        color,
        size,
        tool: "line",
        points: [anchor],
        construction: {
          kind: "segment",
          length:
            Math.hypot(ex, ey) * Math.abs(fraction - interaction.startFraction),
          rotation:
            original.rotation +
            (Math.atan2(ey, ex) * 180) / Math.PI +
            (fraction < interaction.startFraction ? 180 : 0),
        },
      };
      strokeRef.current = stroke;
      setPreview(stroke);
    }
  };
  const finish = (
    event: ReactPointerEvent<SVGSVGElement>,
    cancelled = false,
  ) => {
    if (!interactionRef.current) return;
    if (draftRef.current) onChange(draftRef.current);
    const stroke = strokeRef.current;
    if (
      !cancelled &&
      stroke?.construction &&
      ((stroke.construction.kind === "arc" &&
        Math.abs(stroke.construction.sweep) > 0.3) ||
        (stroke.construction.kind === "segment" &&
          stroke.construction.length > 0.001))
    )
      onStrokeComplete(stroke);
    interactionRef.current = null;
    draftRef.current = null;
    strokeRef.current = null;
    setDraft(null);
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!width || !height) return null;

  const handle = (
    instrument: GeometryInstrument,
    action: Action,
    x: number,
    y: number,
    label: string,
    scale = 1,
    fill = "#1769aa",
  ) => (
    <g
      role="button"
      aria-label={label}
      tabIndex={instrument.owner === role ? 0 : undefined}
      aria-disabled={
        instrument.owner !== role ||
        (instrument.locked && !["measure", "sweep"].includes(action))
      }
      style={{
        pointerEvents: instrument.owner === role ? "auto" : "none",
        cursor:
          instrument.locked && !["measure", "sweep"].includes(action)
            ? "not-allowed"
            : "grab",
      }}
      onPointerDown={(event) => begin(event, instrument, action)}
      onKeyDown={(event) => {
        if (
          instrument.owner !== role ||
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        if (instrument.locked && action !== "measure") return;
        const step =
          event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
        onChange(
          action === "measure"
            ? {
                ...instrument,
                angle: Math.max(0, Math.min(180, instrument.angle + step)),
              }
            : action === "open"
              ? {
                  ...instrument,
                  radius: Math.max(
                    0.01,
                    Math.min(1, instrument.radius + step * 0.005),
                  ),
                }
              : action === "resize"
                ? {
                    ...instrument,
                    size: Math.max(
                      0.02,
                      Math.min(1, instrument.size + step * 0.005),
                    ),
                  }
                : { ...instrument, rotation: instrument.rotation + step },
        );
      }}
    >
      <title>{label}</title>
      <circle
        cx={x}
        cy={y}
        r={Math.max(12 / scale, 11)}
        fill={fill}
        stroke="white"
        strokeWidth={2 / scale}
      />
      <path
        d={`M ${x - 4 / scale} ${y} h ${8 / scale} M ${x} ${y - 4 / scale} v ${8 / scale}`}
        stroke="white"
        strokeWidth={1.5 / scale}
      />
    </g>
  );
  const trace = (
    instrument: GeometryInstrument,
    start: Point,
    end: Point,
    scale: number,
  ) => (
    <line
      x1={(start.x * 400) / instrument.size}
      y1={(start.y * 400) / instrument.size}
      x2={(end.x * 400) / instrument.size}
      y2={(end.y * 400) / instrument.size}
      stroke="transparent"
      strokeWidth={18 / scale}
      style={{
        pointerEvents: instrument.owner === role ? "stroke" : "none",
        cursor: "crosshair",
      }}
      onPointerDown={(event) => begin(event, instrument, "trace", [start, end])}
    >
      <title>Drag along this edge to draw a straight line</title>
    </line>
  );

  let previewPath = "";
  if (preview?.construction?.kind === "arc") {
    const shape = preview.construction;
    previewPath = arcPath(
      preview.points[0].x * width,
      preview.points[0].y * height,
      shape.radius * width,
      shape.startAngle,
      shape.sweep,
    );
  } else if (preview?.construction?.kind === "segment") {
    const start = preview.points[0];
    const vector = rotateGeometryPoint(
      preview.construction.length * width,
      0,
      preview.construction.rotation,
    );
    previewPath = `M ${start.x * width} ${start.y * height} l ${vector.x} ${vector.y}`;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="geometry-instruments"
      aria-label="Movable geometry instruments"
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={(event) => finish(event, true)}
    >
      {previewPath ? (
        <path
          d={previewPath}
          fill="none"
          stroke={color}
          strokeWidth={size * lineScale}
          strokeLinecap="round"
        />
      ) : null}
      {instruments
        .filter((item) => item.visible)
        .map((saved) => {
          const instrument = draft?.id === saved.id ? draft : saved;
          const scale = (instrument.size * width) / 400;
          const owner = instrument.owner === role;
          const body = {
            style: {
              pointerEvents: owner ? ("auto" as const) : ("none" as const),
              cursor: instrument.locked ? "default" : "move",
            },
            onPointerDown: (event: ReactPointerEvent) =>
              begin(event, instrument, "move"),
          };
          const rotation = `translate(${instrument.x * width} ${instrument.y * height}) rotate(${instrument.rotation})`;
          if (instrument.kind === "compass") {
            const radius = instrument.radius * width;
            const visualScale = Math.max(0.6, Math.min(1.4, radius / 160));
            const hingeX = radius / 2;
            const hingeY = -Math.max(55, radius * 0.8);
            return (
              <g
                key={instrument.id}
                transform={rotation}
                opacity={owner ? 1 : 0.7}
                data-instrument={instrument.id}
              >
                <circle
                  r={radius}
                  fill="none"
                  stroke="#64748b"
                  strokeDasharray="5 6"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <path
                  d={`M 0 -4 L ${hingeX} ${hingeY} L ${radius} -8`}
                  fill="none"
                  stroke="#10233f"
                  strokeWidth={17 * visualScale}
                  strokeLinejoin="round"
                  {...body}
                />
                <path
                  d={`M 0 -4 L ${hingeX} ${hingeY} L ${radius} -8`}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={10 * visualScale}
                  strokeLinejoin="round"
                  {...body}
                />
                <path
                  d={`M ${radius} ${-62 * visualScale} V -9`}
                  stroke="#92400e"
                  strokeWidth={14 * visualScale}
                  {...body}
                />
                <path
                  d={`M ${radius} ${-60 * visualScale} V -12`}
                  stroke="#fbbf24"
                  strokeWidth={9 * visualScale}
                  {...body}
                />
                <path
                  d={`M ${radius - 6 * visualScale} -10 L ${radius} 0 L ${radius + 6 * visualScale} -10`}
                  fill="#10233f"
                />
                <circle
                  r="6"
                  fill="#10233f"
                  stroke="white"
                  strokeWidth="2"
                  {...body}
                />
                {handle(
                  instrument,
                  "sweep",
                  hingeX,
                  hingeY,
                  "Sweep compass to draw an arc",
                  1,
                  "#10233f",
                )}
                {handle(
                  instrument,
                  "open",
                  radius,
                  0,
                  "Adjust compass opening",
                  1,
                  "#d97706",
                )}
                <text
                  x="0"
                  y="25"
                  fontSize="12"
                  fill="#334155"
                  stroke="white"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {owner ? "Compass" : `${instrument.owner}'s compass`}
                  {instrument.locked ? " (locked)" : ""}
                </text>
              </g>
            );
          }
          return (
            <g
              key={instrument.id}
              transform={`${rotation} scale(${scale})`}
              opacity={owner ? 1 : 0.7}
              data-instrument={instrument.id}
            >
              {instrument.kind === "ruler" ? (
                <>
                  <rect
                    x="-12"
                    y="0"
                    width="424"
                    height="64"
                    rx="6"
                    fill="rgba(14,165,233,0.13)"
                    stroke="#0c4a6e"
                    strokeWidth="2"
                    {...body}
                  />
                  {Array.from({ length: 41 }, (_, index) => (
                    <g key={index}>
                      <line
                        x1={index * 10}
                        y1="0"
                        x2={index * 10}
                        y2={index % 4 === 0 ? 24 : index % 2 === 0 ? 17 : 11}
                        stroke="#0c4a6e"
                        strokeWidth="1.5"
                      />
                      {index % 4 === 0 ? (
                        <text
                          x={index * 10}
                          y="45"
                          fontSize="15"
                          textAnchor="middle"
                          fill="#0c4a6e"
                        >
                          {index / 4}
                        </text>
                      ) : null}
                    </g>
                  ))}
                  {trace(
                    instrument,
                    { x: 0, y: 0 },
                    { x: instrument.size, y: 0 },
                    scale,
                  )}
                  {handle(
                    instrument,
                    "rotate",
                    400,
                    -30,
                    "Rotate ruler",
                    scale,
                  )}
                  {handle(
                    instrument,
                    "resize",
                    412,
                    64,
                    "Resize ruler",
                    scale,
                    "#64748b",
                  )}
                </>
              ) : instrument.kind === "protractor" ? (
                <>
                  <path
                    d="M -200 0 A 200 200 0 0 1 200 0 Z"
                    fill="rgba(14,165,233,0.11)"
                    stroke="#0c4a6e"
                    strokeWidth="2"
                    {...body}
                  />
                  <path
                    d="M -120 0 A 120 120 0 0 1 120 0"
                    fill="none"
                    stroke="#0c4a6e"
                    strokeWidth="1"
                  />
                  {Array.from({ length: 181 }, (_, degree) => {
                    const angle = (-degree * Math.PI) / 180;
                    const inner =
                      degree % 10 === 0 ? 174 : degree % 5 === 0 ? 182 : 190;
                    return (
                      <g key={degree}>
                        <line
                          x1={200 * Math.cos(angle)}
                          y1={200 * Math.sin(angle)}
                          x2={inner * Math.cos(angle)}
                          y2={inner * Math.sin(angle)}
                          stroke="#0c4a6e"
                          strokeWidth={degree % 10 === 0 ? 1.5 : 0.7}
                        />
                        {degree % 10 === 0 ? (
                          <>
                            <text
                              x={158 * Math.cos(angle)}
                              y={158 * Math.sin(angle) + 4}
                              textAnchor="middle"
                              fontSize="12"
                              fill="#0c4a6e"
                            >
                              {degree}
                            </text>
                            <text
                              x={135 * Math.cos(angle)}
                              y={135 * Math.sin(angle) + 4}
                              textAnchor="middle"
                              fontSize="10"
                              fill="#64748b"
                            >
                              {180 - degree}
                            </text>
                          </>
                        ) : null}
                      </g>
                    );
                  })}
                  <circle r="4" fill="#0c4a6e" />
                  <line
                    x1="0"
                    y1="0"
                    x2={195 * Math.cos((-instrument.angle * Math.PI) / 180)}
                    y2={195 * Math.sin((-instrument.angle * Math.PI) / 180)}
                    stroke="#d97706"
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="-20"
                    textAnchor="middle"
                    fontSize="20"
                    fontWeight="bold"
                    fill="#92400e"
                  >
                    {instrument.angle}°
                  </text>
                  {handle(
                    instrument,
                    "measure",
                    195 * Math.cos((-instrument.angle * Math.PI) / 180),
                    195 * Math.sin((-instrument.angle * Math.PI) / 180),
                    "Measure protractor angle",
                    scale,
                    "#d97706",
                  )}
                  {handle(
                    instrument,
                    "rotate",
                    225,
                    0,
                    "Rotate protractor",
                    scale,
                  )}
                  {handle(
                    instrument,
                    "resize",
                    -225,
                    0,
                    "Resize protractor",
                    scale,
                    "#64748b",
                  )}
                  {trace(
                    instrument,
                    { x: -instrument.size / 2, y: 0 },
                    { x: instrument.size / 2, y: 0 },
                    scale,
                  )}
                </>
              ) : (
                <>
                  <path
                    d="M 0 0 L 400 0 L 0 -400 Z M 60 -60 L 60 -255 L 255 -60 Z"
                    fill="rgba(20,184,166,0.14)"
                    fillRule="evenodd"
                    stroke="#115e59"
                    strokeWidth="2"
                    {...body}
                  />
                  <path
                    d="M 24 0 V -24 H 0"
                    fill="none"
                    stroke="#115e59"
                    strokeWidth="2"
                  />
                  <text x="45" y="-25" fontSize="16" fill="#115e59">
                    90°
                  </text>
                  {trace(
                    instrument,
                    { x: 0, y: 0 },
                    { x: instrument.size, y: 0 },
                    scale,
                  )}
                  {trace(
                    instrument,
                    { x: 0, y: 0 },
                    { x: 0, y: -instrument.size },
                    scale,
                  )}
                  {trace(
                    instrument,
                    { x: 0, y: -instrument.size },
                    { x: instrument.size, y: 0 },
                    scale,
                  )}
                  {handle(
                    instrument,
                    "rotate",
                    400,
                    30,
                    "Rotate set square",
                    scale,
                  )}
                  {handle(
                    instrument,
                    "resize",
                    0,
                    -400,
                    "Resize set square",
                    scale,
                    "#64748b",
                  )}
                </>
              )}
              <text
                x="10"
                y={instrument.kind === "ruler" ? 83 : 27}
                fontSize={12 / scale}
                fill="#334155"
                stroke="white"
                strokeWidth={3 / scale}
                paintOrder="stroke"
              >
                {owner ? "" : `${instrument.owner}: `}
                {GEOMETRY_LABELS[instrument.kind].split(" / ").pop()}
                {instrument.locked ? " (locked)" : ""}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

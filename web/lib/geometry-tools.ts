import type {
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
} from "@/lib/livekit/signals";

export type GeometryTool = "ruler" | "compass" | "protractor" | "set-square";
export type GeometryInstrument = {
  id: string;
  owner: "teacher" | "student";
  kind: GeometryTool;
  revision: number;
  x: number;
  y: number;
  size: number;
  radius: number;
  rotation: number;
  angle: number;
  sweep: number;
  locked: boolean;
  visible: boolean;
};

// Lengths use board-width units to preserve angles and circles when the view resizes.
export type GeometryConstruction =
  | { kind: "segment"; length: number; rotation: number }
  | { kind: "arc"; radius: number; startAngle: number; sweep: number }
  | { kind: "angle"; length: number; rotation: number; angle: number }
  | { kind: "triangle"; length: number; rotation: number };

export const GEOMETRY_LABELS: Record<GeometryTool, string> = {
  ruler: "Pembaris / Ruler",
  compass: "Jangka lukis / Compass",
  protractor: "Jangka sudut / Protractor",
  "set-square": "Sesiku / Set square",
};

export function isGeometryTool(
  tool: WhiteboardTool | string,
): tool is GeometryTool {
  return (
    tool === "ruler" ||
    tool === "compass" ||
    tool === "protractor" ||
    tool === "set-square"
  );
}

export function isGeometryInstrument(
  value: unknown,
): value is GeometryInstrument {
  if (!value || typeof value !== "object") return false;
  const item = value as GeometryInstrument;
  return (
    isGeometryTool(item.kind) &&
    (item.owner === "teacher" || item.owner === "student") &&
    item.id === `${item.owner}:${item.kind}` &&
    [
      item.x,
      item.y,
      item.size,
      item.radius,
      item.rotation,
      item.angle,
      item.sweep,
      item.revision,
    ].every(Number.isFinite) &&
    item.x >= 0 &&
    item.x <= 1 &&
    item.y >= 0 &&
    item.y <= 1 &&
    item.size >= 0.02 &&
    item.size <= 1 &&
    item.radius >= 0.01 &&
    item.radius <= 1 &&
    item.angle >= 0 &&
    item.angle <= 180 &&
    Math.abs(item.sweep) <= 360 &&
    Number.isSafeInteger(item.revision) &&
    item.revision >= 0 &&
    typeof item.locked === "boolean" &&
    typeof item.visible === "boolean"
  );
}

export function mergeGeometryInstrument(
  instruments: GeometryInstrument[],
  incoming: unknown,
) {
  if (!isGeometryInstrument(incoming)) return instruments;
  const previous = instruments.find((item) => item.id === incoming.id);
  if (previous && previous.revision >= incoming.revision) return instruments;
  return [...instruments.filter((item) => item.id !== incoming.id), incoming];
}

export function createGeometryInstrument(
  kind: GeometryTool,
  owner: GeometryInstrument["owner"],
  width: number,
  height: number,
  visibleArea = { left: 0, top: 0, width, height },
): GeometryInstrument {
  const available = Math.min(
    visibleArea.width * 0.65,
    visibleArea.height * (kind === "set-square" ? 0.5 : 0.65),
  );
  return {
    id: `${owner}:${kind}`,
    kind,
    owner,
    revision: 0,
    x: Math.min(
      0.85,
      Math.max(
        0.05,
        (visibleArea.left +
          visibleArea.width *
            (kind === "protractor" ? 0.5 : kind === "compass" ? 0.4 : 0.25)) /
          width,
      ),
    ),
    y: Math.min(
      0.85,
      Math.max(0.1, (visibleArea.top + visibleArea.height * 0.62) / height),
    ),
    size: Math.max(0.02, Math.min(0.8, available / width)),
    radius: Math.max(0.01, Math.min(0.4, available / width / 2)),
    rotation: 0,
    angle: 60,
    sweep: 90,
    locked: false,
    visible: true,
  };
}

export function rotateGeometryPoint(x: number, y: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}

export function angleDelta(previous: number, next: number) {
  return ((next - previous + 540) % 360) - 180;
}

export function instrumentPoint(
  instrument: GeometryInstrument,
  local: WhiteboardPoint,
  width: number,
  height: number,
) {
  const point = rotateGeometryPoint(local.x, local.y, instrument.rotation);
  return {
    x: instrument.x + point.x,
    y: instrument.y + (point.y * width) / height,
  };
}

export function constructionStroke(
  instrument: GeometryInstrument,
  color: string,
  size: number,
  action: "default" | "circle" = "default",
): WhiteboardStroke {
  const construction: GeometryConstruction =
    instrument.kind === "compass"
      ? {
          kind: "arc",
          radius: instrument.radius,
          startAngle: instrument.rotation,
          sweep: action === "circle" ? 360 : instrument.sweep,
        }
      : instrument.kind === "protractor"
        ? {
            kind: "angle",
            length: instrument.size / 2,
            rotation: instrument.rotation,
            angle: instrument.angle,
          }
        : instrument.kind === "set-square"
          ? {
              kind: "triangle",
              length: instrument.size,
              rotation: instrument.rotation,
            }
          : {
              kind: "segment",
              length: instrument.size,
              rotation: instrument.rotation,
            };
  return {
    id: crypto.randomUUID(),
    author: instrument.owner,
    color,
    size,
    tool: instrument.kind,
    points: [{ x: instrument.x, y: instrument.y }],
    construction,
  };
}

export function arcPath(
  centerX: number,
  centerY: number,
  radius: number,
  start: number,
  sweep: number,
) {
  if (!radius || Math.abs(sweep) < 0.05) return "";
  const point = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return `${centerX + radius * Math.cos(radians)} ${centerY + radius * Math.sin(radians)}`;
  };
  const direction = sweep >= 0 ? 1 : 0;
  if (Math.abs(sweep) >= 359.99) {
    return `M ${point(start)} A ${radius} ${radius} 0 1 ${direction} ${point(start + sweep / 2)} A ${radius} ${radius} 0 1 ${direction} ${point(start + sweep)}`;
  }
  return `M ${point(start)} A ${radius} ${radius} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${direction} ${point(start + sweep)}`;
}

import type { WhiteboardStroke } from "@/lib/livekit/signals";

export function drawGeometryStroke(
  context: CanvasRenderingContext2D,
  height: number,
  stroke: WhiteboardStroke,
  width: number,
  lineScale = 1,
) {
  if (stroke.construction && stroke.points[0]) {
    const shape = stroke.construction;
    context.save();
    context.translate(stroke.points[0].x * width, stroke.points[0].y * height);
    context.beginPath();
    if (shape.kind === "arc") {
      context.arc(0, 0, shape.radius * width, shape.startAngle * Math.PI / 180, (shape.startAngle + shape.sweep) * Math.PI / 180, shape.sweep < 0);
    } else {
      context.rotate(shape.rotation * Math.PI / 180);
      const length = shape.length * width;
      context.moveTo(0, 0);
      context.lineTo(length, 0);
      if (shape.kind === "triangle") {
        context.lineTo(0, -length);
        context.closePath();
      } else if (shape.kind === "angle") {
        const radians = -shape.angle * Math.PI / 180;
        context.moveTo(0, 0);
        context.lineTo(length * Math.cos(radians), length * Math.sin(radians));
        context.stroke();
        context.beginPath();
        const radius = Math.min(length * 0.3, 38 * lineScale);
        context.arc(0, 0, radius, 0, radians, true);
        context.fillStyle = stroke.color;
        context.font = `${Math.max(12, 13 * lineScale)}px sans-serif`;
        context.textAlign = "center";
        context.fillText(`${shape.angle}°`, (radius + 18 * lineScale) * Math.cos(radians / 2), (radius + 18 * lineScale) * Math.sin(radians / 2));
      }
    }
    context.stroke();
    context.restore();
    return true;
  }

  if (
    stroke.tool !== "ruler" &&
    stroke.tool !== "compass" &&
    stroke.tool !== "protractor" &&
    stroke.tool !== "set-square"
  ) {
    return false;
  }

  const firstPoint = stroke.points[0];
  const lastPoint = stroke.points[stroke.points.length - 1] ?? firstPoint;

  if (!firstPoint || !lastPoint) {
    return true;
  }

  const startX = firstPoint.x * width;
  const startY = firstPoint.y * height;
  const endX = lastPoint.x * width;
  const endY = lastPoint.y * height;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const length = Math.hypot(deltaX, deltaY);

  if (stroke.tool === "ruler") {
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);

    if (length > 0) {
      const tickCount = Math.max(1, Math.min(50, Math.floor(length / 24)));
      const normalX = -deltaY / length;
      const normalY = deltaX / length;

      for (let index = 0; index <= tickCount; index += 1) {
        const fraction = index / tickCount;
        const tickX = startX + deltaX * fraction;
        const tickY = startY + deltaY * fraction;
        const tickSize = (index % 5 === 0 ? 12 : 7) * lineScale;
        context.moveTo(
          tickX - (normalX * tickSize) / 2,
          tickY - (normalY * tickSize) / 2,
        );
        context.lineTo(
          tickX + (normalX * tickSize) / 2,
          tickY + (normalY * tickSize) / 2,
        );
      }
    }

    context.stroke();
    return true;
  }

  if (stroke.tool === "compass") {
    context.beginPath();
    context.arc(startX, startY, length, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(startX, startY, Math.max(2, context.lineWidth), 0, Math.PI * 2);
    context.fillStyle = stroke.color;
    context.fill();
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    return true;
  }

  if (stroke.tool === "protractor") {
    const angle = Math.atan2(deltaY, deltaX);
    const baselineLength = Math.max(length, 32 * lineScale);

    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(startX + baselineLength, startY);
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    const arcRadius = Math.min(Math.max(length * 0.28, 12 * lineScale), 38 * lineScale);
    context.beginPath();
    context.arc(startX, startY, arcRadius, 0, angle, angle < 0);
    context.stroke();

    const midpoint = angle / 2;
    const labelRadius = arcRadius + 12 * lineScale;
    const degrees = Math.round(Math.abs((Math.atan2(-deltaY, deltaX) * 180) / Math.PI));
    context.fillStyle = stroke.color;
    context.font = `${Math.max(12, 13 * lineScale)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      `${degrees}°`,
      startX + Math.cos(midpoint) * labelRadius,
      startY + Math.sin(midpoint) * labelRadius,
    );
    return true;
  }

  const cornerX = endX;
  const cornerY = startY;
  const markerSize = Math.min(14 * lineScale, Math.abs(deltaX) / 3, Math.abs(deltaY) / 3);

  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(cornerX, cornerY);
  context.lineTo(endX, endY);
  context.closePath();
  context.stroke();

  if (markerSize > 2) {
    const horizontalDirection = Math.sign(startX - cornerX);
    const verticalDirection = Math.sign(endY - cornerY);
    context.beginPath();
    context.moveTo(cornerX + horizontalDirection * markerSize, cornerY);
    context.lineTo(
      cornerX + horizontalDirection * markerSize,
      cornerY + verticalDirection * markerSize,
    );
    context.lineTo(cornerX, cornerY + verticalDirection * markerSize);
    context.stroke();
  }

  return true;
}

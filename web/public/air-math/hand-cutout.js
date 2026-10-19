const FINGERS = [
  { joints: [1, 2, 3, 4], radii: [.15, .13, .105, .085] },
  { joints: [5, 6, 7, 8], radii: [.105, .095, .08, .065] },
  { joints: [9, 10, 11, 12], radii: [.105, .095, .08, .065] },
  { joints: [13, 14, 15, 16], radii: [.105, .095, .08, .065] },
  { joints: [17, 18, 19, 20], radii: [.105, .095, .08, .065] },
];

function cross(origin, first, second) {
  return (first.x - origin.x) * (second.y - origin.y)
    - (first.y - origin.y) * (second.x - origin.x);
}

function convexHull(points) {
  const sorted = [...points].sort((first, second) => first.x - second.x || first.y - second.y);
  const lower = [];
  const upper = [];
  for (const point of sorted) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function addPolygon(path, points) {
  if (points.length < 3) return;
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  // Every subpath has positive winding, so overlaps form a union with nonzero fill.
  const ordered = twiceArea < 0 ? [...points].reverse() : points;
  path.moveTo(ordered[0].x, ordered[0].y);
  for (let index = 1; index < ordered.length; index += 1) path.lineTo(ordered[index].x, ordered[index].y);
  path.closePath();
}

function addCircle(path, point, radius) {
  path.moveTo(point.x + radius, point.y);
  path.arc(point.x, point.y, radius, 0, Math.PI * 2, false);
  path.closePath();
}

function addFingerSegment(path, first, second, firstRadius, secondRadius) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length < .001) return;
  const normal = { x: -dy / length, y: dx / length };
  addPolygon(path, [
    { x: first.x + normal.x * firstRadius, y: first.y + normal.y * firstRadius },
    { x: second.x + normal.x * secondRadius, y: second.y + normal.y * secondRadius },
    { x: second.x - normal.x * secondRadius, y: second.y - normal.y * secondRadius },
    { x: first.x - normal.x * firstRadius, y: first.y - normal.y * firstRadius },
  ]);
}

/** Build a camera-space hand silhouette and a strict wrist-to-palm half-plane. */
export function createHandCutout(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 21
    || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const points = [];
  for (let index = 0; index < 21; index += 1) {
    const landmark = landmarks[index];
    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) return null;
    const point = { x: landmark.x * width, y: landmark.y * height };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    points.push(point);
  }

  const wrist = points[0];
  const palmCenter = { x: 0, y: 0 };
  for (const index of [5, 9, 13, 17]) {
    palmCenter.x += points[index].x / 4;
    palmCenter.y += points[index].y / 4;
  }
  const length = Math.hypot(palmCenter.x - wrist.x, palmCenter.y - wrist.y);
  if (length < 4) return null;
  const axis = { x: (palmCenter.x - wrist.x) / length, y: (palmCenter.y - wrist.y) / length };
  const across = { x: -axis.y, y: axis.x };
  const palmWidth = Math.max(Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y), length * .35);
  const wristRadius = palmWidth * .42;
  const palm = convexHull([
    { x: wrist.x - across.x * wristRadius, y: wrist.y - across.y * wristRadius },
    { x: wrist.x + across.x * wristRadius, y: wrist.y + across.y * wristRadius },
    ...[1, 2, 5, 9, 13, 17].map((index) => points[index]),
  ]);
  const silhouette = new Path2D();
  addPolygon(silhouette, palm);
  const palmPadding = Math.max(1.5, palmWidth * .055);
  for (let index = 0; index < palm.length; index += 1) {
    addCircle(silhouette, palm[index], palmPadding);
    addFingerSegment(silhouette, palm[index], palm[(index + 1) % palm.length], palmPadding, palmPadding);
  }
  for (const finger of FINGERS) {
    const radii = finger.radii.map((radius) => Math.max(1.5, radius * palmWidth));
    for (let index = 0; index < finger.joints.length; index += 1) {
      const point = points[finger.joints[index]];
      addCircle(silhouette, point, radii[index]);
      if (index > 0) addFingerSegment(silhouette, points[finger.joints[index - 1]], point, radii[index - 1], radii[index]);
    }
  }

  const reach = Math.max(width, height) * 4;
  const wristClip = new Path2D();
  addPolygon(wristClip, [
    { x: wrist.x - across.x * reach, y: wrist.y - across.y * reach },
    { x: wrist.x + across.x * reach, y: wrist.y + across.y * reach },
    { x: wrist.x + across.x * reach + axis.x * reach * 2, y: wrist.y + across.y * reach + axis.y * reach * 2 },
    { x: wrist.x - across.x * reach + axis.x * reach * 2, y: wrist.y - across.y * reach + axis.y * reach * 2 },
  ]);
  return { silhouette, wristClip, wrist, axis };
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  angleDelta,
  arcPath,
  constructionStroke,
  createGeometryInstrument,
  instrumentPoint,
  isGeometryInstrument,
  mergeGeometryInstrument,
} from "../lib/geometry-tools.ts";
import { drawGeometryStroke } from "../lib/livekit/draw-geometry-stroke.ts";

test("instrument placement fits the visible part of a zoomed worksheet", () => {
  const tool = createGeometryInstrument("compass", "teacher", 2400, 1800, {
    left: 900,
    top: 500,
    width: 400,
    height: 600,
  });
  assert.equal(isGeometryInstrument(tool), true);
  assert.ok(tool.x * 2400 >= 900 && tool.x * 2400 <= 1300);
  assert.ok(tool.y * 1800 >= 500 && tool.y * 1800 <= 1100);
  assert.ok(tool.radius * 2400 < 200);
});

test("compass ink contains an arc without stamping the guide or radius", () => {
  const tool = {
    ...createGeometryInstrument("compass", "teacher", 1000, 800),
    radius: 0.2,
    rotation: 350,
    sweep: 35,
  };
  const stroke = constructionStroke(tool, "#165dff", 4);
  assert.deepEqual(stroke.construction, {
    kind: "arc",
    radius: 0.2,
    startAngle: 350,
    sweep: 35,
  });
  assert.equal(
    constructionStroke(tool, "#165dff", 4, "circle").construction.sweep,
    360,
  );
  assert.equal(stroke.points.length, 1);
});

test("sweeping a compass across zero degrees keeps the correct direction", () => {
  assert.equal(angleDelta(179, -179), 2);
  assert.equal(angleDelta(-179, 179), -2);
  assert.equal(angleDelta(350, 10), 20);
});

test("full circle previews use two SVG arcs so they remain visible", () => {
  assert.equal((arcPath(100, 100, 50, 0, 360).match(/ A /g) ?? []).length, 2);
  assert.equal((arcPath(100, 100, 50, 90, -360).match(/ A /g) ?? []).length, 2);
  assert.equal(arcPath(100, 100, 50, 0, 0), "");
});

test("straightedge endpoints rotate in the same coordinate space as the ink", () => {
  const tool = {
    ...createGeometryInstrument("ruler", "student", 1000, 500),
    x: 0.2,
    y: 0.3,
    rotation: 90,
  };
  const endpoint = instrumentPoint(tool, { x: 0.2, y: 0 }, 1000, 500);
  assert.ok(Math.abs(endpoint.x - 0.2) < 1e-10);
  assert.ok(Math.abs(endpoint.y - 0.7) < 1e-10);
});

test("late snapshots cannot overwrite a newer instrument movement or hide action", () => {
  const tool = {
    ...createGeometryInstrument("ruler", "teacher", 1000, 800),
    revision: 5,
    visible: false,
  };
  const state = [tool];
  assert.equal(
    mergeGeometryInstrument(state, { ...tool, revision: 4, visible: true }),
    state,
  );
  assert.equal(
    mergeGeometryInstrument(state, { ...tool, revision: 5, visible: true }),
    state,
  );
  const next = mergeGeometryInstrument(state, { ...tool, revision: 6, x: 0.7 });
  assert.equal(next[0].x, 0.7);
  assert.equal(next[0].visible, false);
});

test("invalid remote instruments are ignored", () => {
  const tool = createGeometryInstrument("protractor", "teacher", 1000, 800);
  for (const invalid of [
    null,
    {},
    { ...tool, radius: -1 },
    { ...tool, angle: 181 },
    { ...tool, x: NaN },
    { ...tool, owner: "student" },
  ]) {
    assert.equal(isGeometryInstrument(invalid), false);
    const state = [];
    assert.equal(mergeGeometryInstrument(state, invalid), state);
  }
});

test("compass circles stay circular at different board aspect ratios and zoom levels", () => {
  const tool = {
    ...createGeometryInstrument("compass", "teacher", 1000, 800),
    x: 0.4,
    y: 0.5,
    radius: 0.1,
  };
  const stroke = constructionStroke(tool, "#165dff", 4, "circle");
  for (const [width, height] of [
    [1000, 800],
    [500, 900],
    [2000, 800],
  ]) {
    const commands = [];
    const context = {
      save() {},
      restore() {},
      beginPath() {},
      stroke() {},
      translate(...args) {
        commands.push(["translate", ...args]);
      },
      arc(...args) {
        commands.push(["arc", ...args]);
      },
    };
    assert.equal(drawGeometryStroke(context, height, stroke, width), true);
    assert.deepEqual(commands[0], ["translate", width * 0.4, height * 0.5]);
    assert.equal(commands[1][3], width * 0.1);
    assert.equal(commands[1][5] - commands[1][4], Math.PI * 2);
  }
});
